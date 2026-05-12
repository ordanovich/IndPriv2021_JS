library(sf)
library(data.table)
library(rmapshaper)
library(dplyr)

# --- Configuration ---
USE_REAL_DATA <- TRUE

# 1. Ingestion (Disable S2 for flat geometry)
sf_use_s2(FALSE)
geo <- st_read("data/SECC_CE_20210101.shp", quiet = TRUE) %>% 
  st_transform(4326) %>% 
  st_make_valid()

geo$CUSEC <- trimws(as.character(geo$CUSEC))

# 2. Integration
if (USE_REAL_DATA) {
  message("Loading REAL data from Excel files...")
  
  raw_xls_21 <- readxl::read_xlsx("data/T25_IP2021_ACP_C_[i2_29]_v1.xlsx", sheet = 3)
  dt_21 <- as.data.table(raw_xls_21)
  dt_21[, CUSEC := trimws(as.character(CUSEC))]
  
  raw_xls_11 <- readxl::read_xlsx("data/IP2011_RE.xlsx", sheet = 1)
  dt_11 <- as.data.table(raw_xls_11)
  dt_11[, CUSEC := trimws(as.character(CUSEC))]
  
  dt_geo <- as.data.table(st_drop_geometry(geo))
  
  dt_merged <- merge(dt_geo, dt_21[, .(CUSEC, IP21_i2_29_cpa_Cna_df)], by="CUSEC", all.x=TRUE)
  geo$IP2021 <- dt_merged[match(geo$CUSEC, dt_merged$CUSEC), IP21_i2_29_cpa_Cna_df]
  
  dt_merged_11 <- merge(dt_geo, dt_11[, .(CUSEC, IP2011)], by="CUSEC", all.x=TRUE)
  geo$IP2011 <- dt_merged_11[match(geo$CUSEC, dt_merged_11$CUSEC), IP2011]
  
  geo$IP2021 <- round(as.numeric(geo$IP2021), 3)
  geo$IP2011 <- round(as.numeric(geo$IP2011), 3)
  
} else {
  message("Loading FAKE data...")
  set.seed(2026) 
  geo$IP2021 <- round(runif(nrow(geo), min = -3, max = 3), 2)
  geo$IP2011 <- round(runif(nrow(geo), min = -3, max = 3), 2)
}

# 3. Categorical Labels
# 2011: Textos estáticos compactos (sin espacios alrededor del /)
etiquetas_11 <- c(
  "1. Inferior [-2,58/-0,86]",
  "2. Intermedio bajo [-0,87/-0,27]",
  "3. Intermedio [-0,28/-0,21]",
  "4. Intermedio alto [0,22/0,82]",
  "5. Superior [0,83/4,88]"
)
geo$Q11_Label <- as.character(factor(ntile(geo$IP2011, 5), levels = 1:5, labels = etiquetas_11))

# 2021: Quintil numérico para el pop-up
geo$Q21_num <- ntile(geo$IP2021, 5)

# CCAA from province code (first 2 digits of CUSEC)
prov_to_ccaa <- c(
  "04"="Andalucía",      "11"="Andalucía",      "14"="Andalucía",
  "18"="Andalucía",      "21"="Andalucía",      "23"="Andalucía",
  "29"="Andalucía",      "41"="Andalucía",
  "22"="Aragón",         "44"="Aragón",         "50"="Aragón",
  "33"="Principado de Asturias",
  "07"="Illes Balears",
  "35"="Canarias",       "38"="Canarias",
  "39"="Cantabria",
  "02"="Castilla-La Mancha", "13"="Castilla-La Mancha",
  "16"="Castilla-La Mancha", "19"="Castilla-La Mancha",
  "45"="Castilla-La Mancha",
  "05"="Castilla y León","09"="Castilla y León","24"="Castilla y León",
  "34"="Castilla y León","37"="Castilla y León","40"="Castilla y León",
  "42"="Castilla y León","47"="Castilla y León","49"="Castilla y León",
  "08"="Cataluña",       "17"="Cataluña",       "25"="Cataluña",       "43"="Cataluña",
  "51"="Ceuta",
  "06"="Extremadura",    "10"="Extremadura",
  "15"="Galicia",        "27"="Galicia",        "32"="Galicia",        "36"="Galicia",
  "26"="La Rioja",
  "28"="Comunidad de Madrid",
  "52"="Melilla",
  "30"="Región de Murcia",
  "31"="Comunidad Foral de Navarra",
  "01"="País Vasco",     "20"="País Vasco",     "48"="País Vasco",
  "03"="Comunitat Valenciana","12"="Comunitat Valenciana","46"="Comunitat Valenciana"
)
prov_code <- substr(formatC(geo$CUSEC, width = 9, flag = "0"), 1, 2)
geo$CCAA <- prov_to_ccaa[prov_code]

# 2021: Etiquetas con rangos reales de quintiles
breaks_21 <- quantile(geo$IP2021, probs = seq(0, 1, 0.2), na.rm = TRUE)
fmt <- function(x) gsub("\\.", ",", sprintf("%.2f", x))
etiquetas_21 <- c(
  paste0("1. Inferior [",        fmt(breaks_21[1]), "/", fmt(breaks_21[2]), "]"),
  paste0("2. Intermedio bajo [", fmt(breaks_21[2]), "/", fmt(breaks_21[3]), "]"),
  paste0("3. Intermedio [",      fmt(breaks_21[3]), "/", fmt(breaks_21[4]), "]"),
  paste0("4. Intermedio alto [", fmt(breaks_21[4]), "/", fmt(breaks_21[5]), "]"),
  paste0("5. Superior [",        fmt(breaks_21[5]), "/", fmt(breaks_21[6]), "]")
)
geo$Q21_Label <- as.character(factor(geo$Q21_num, levels = 1:5, labels = etiquetas_21))

# Print labels so simple.json enumColors can be updated
message("--- Q21_Label values for simple.json ---")
for (l in etiquetas_21) message("  ", l)
message("----------------------------------------")

geo[["stroke-width"]] <- 0
geo[["stroke-opacity"]] <- 0

cols <- c("CUSEC", "CCAA", "NMUN", "NPRO", "IP2021", "IP2011", "Q11_Label", "Q21_num", "Q21_Label", "stroke-width", "stroke-opacity")
geo_final <- geo[, intersect(cols, names(geo))]

# 4. Simplify & Export
message("Applying gentle geometry simplification...")
geo_simplified <- ms_simplify(geo_final, keep = 0.8, keep_shapes = TRUE)

out_dir <- "../terria_frontend/wwwroot/data"
if (!dir.exists(out_dir)) dir.create(out_dir, recursive = TRUE)
out_file <- file.path(out_dir, "secciones_unified.geojson")

st_write(geo_simplified, out_file, driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=5", delete_dsn = TRUE)