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
geo_final <- geo_final %>% st_collection_extract("POLYGON") %>% st_make_valid()
geo_simplified <- ms_simplify(geo_final, keep = 0.8, keep_shapes = TRUE) %>%
  st_collection_extract("POLYGON") %>%
  st_make_valid()

out_dir <- "../terria_frontend/wwwroot/data"
if (!dir.exists(out_dir)) dir.create(out_dir, recursive = TRUE)
out_file <- file.path(out_dir, "secciones_unified.geojson")

st_write(geo_simplified, out_file, driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=5", delete_dsn = TRUE)
message("Exported: ", out_file)

# 5. 2011 Shapefile — process if present in data/
# The colleague's 2011 shapefile can have any filename; place it in data_pipeline/data/.
# It must contain CUSEC (9-digit section code), NMUN (municipality name), NPRO (province name).
# IP2011 values come from IP2011_RE.xlsx (column "IP2011", sheet 1).
shp_all <- list.files("data", pattern = "\\.shp$", full.names = TRUE)
shp_2011_candidates <- shp_all[!grepl("SECC_CE_20210101", shp_all, fixed = TRUE)]

if (length(shp_2011_candidates) == 0) {
  message("No 2011 shapefile found in data_pipeline/data/ — skipping secciones_2011.geojson")
  message("Place the 2011 shapefile (any name except SECC_CE_20210101.shp) in data_pipeline/data/")
} else {
  shp_2011_path <- shp_2011_candidates[1]
  if (length(shp_2011_candidates) > 1)
    message("Multiple 2011 candidates found — using: ", shp_2011_path)
  message("Processing 2011 shapefile: ", shp_2011_path)

  geo_11 <- st_read(shp_2011_path, quiet = TRUE) %>%
    st_transform(4326) %>%
    st_make_valid()
  geo_11$CUSEC <- trimws(as.character(geo_11$CUSEC))

  # Join IP2011 from IP2011_RE.xlsx (already loaded above as dt_11)
  dt_geo_11 <- as.data.table(st_drop_geometry(geo_11))
  dt_m11 <- merge(dt_geo_11, dt_11[, .(CUSEC, IP2011)], by = "CUSEC", all.x = TRUE)
  geo_11$IP2011 <- dt_m11[match(geo_11$CUSEC, dt_m11$CUSEC), IP2011]
  geo_11$IP2011 <- round(as.numeric(geo_11$IP2011), 3)

  joined_n <- sum(!is.na(geo_11$IP2011))
  message(sprintf("  Joined IP2011 for %d / %d sections", joined_n, nrow(geo_11)))
  if (joined_n == 0)
    stop("No CUSEC matches between 2011 shapefile and IP2011_RE.xlsx — check that both use the same CUSEC format")

  # Q11_Label — same national quintile labels as in the unified file
  geo_11$Q11_Label <- as.character(factor(ntile(geo_11$IP2011, 5), levels = 1:5, labels = etiquetas_11))
  geo_11[["stroke-width"]]   <- 0
  geo_11[["stroke-opacity"]] <- 0

  # If NMUN or NPRO are absent (some older INE shapefiles use different names),
  # rename the relevant column here before proceeding, e.g.:
  #   names(geo_11)[names(geo_11) == "NMU"] <- "NMUN"
  missing_cols <- setdiff(c("NMUN", "NPRO"), names(geo_11))
  if (length(missing_cols) > 0)
    message("  WARNING: expected columns missing from 2011 shapefile: ", paste(missing_cols, collapse = ", "),
            " — those fields will be absent from the output")

  cols_11 <- c("CUSEC", "NMUN", "NPRO", "IP2011", "Q11_Label", "stroke-width", "stroke-opacity")
  geo_11_final <- geo_11[, intersect(cols_11, names(geo_11))]

  message("  Simplifying geometry...")
  geo_11_simplified <- ms_simplify(geo_11_final, keep = 0.8, keep_shapes = TRUE)

  out_file_11 <- file.path(out_dir, "secciones_2011.geojson")
  st_write(geo_11_simplified, out_file_11, driver = "GeoJSON",
           layer_options = "COORDINATE_PRECISION=5", delete_dsn = TRUE)
  message("Exported: ", out_file_11)
}

# 6. Administrative boundary overlays (municipalities and provinces)
# Dissolved from the already-simplified 2021 sections so boundaries are
# geometrically consistent with the section data.
message("Dissolving administrative boundaries for navigation overlays...")

geo_s <- geo_simplified
geo_s$CPRO <- substr(formatC(as.character(geo_s$CUSEC), width = 9, flag = "0"), 1, 2)
geo_s$CMUN <- substr(formatC(as.character(geo_s$CUSEC), width = 9, flag = "0"), 1, 5)

# -- Municipalities: dissolve then convert to boundary lines.
#    Lines avoid polygon click-interception on the section data layer.
message("  Dissolving to municipalities...")
municipios_poly <- geo_s %>%
  group_by(CMUN) %>%
  summarise(NMUN = first(NMUN), NPRO = first(NPRO), CPRO = first(CPRO)) %>%
  st_make_valid() %>%
  st_collection_extract("POLYGON") %>%
  st_make_valid()

municipios_simp  <- ms_simplify(municipios_poly, keep = 0.03,
                                keep_shapes = TRUE)
municipios_lines <- st_cast(municipios_simp, "MULTILINESTRING") %>% st_make_valid()
municipios_lines$stroke           <- "#aaaaaa"
municipios_lines[["stroke-width"]]   <- 0.7
municipios_lines[["stroke-opacity"]] <- 0.45

st_write(municipios_lines, file.path(out_dir, "municipios.geojson"),
         driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=5", delete_dsn = TRUE)
message(sprintf("  Exported municipios.geojson (%d boundaries)", nrow(municipios_lines)))

# -- Provinces: dissolve to polygons (kept as polygons to support text labels).
#    Transparent fill; outline and label configured in the catalog.
message("  Dissolving to provinces...")
provincias_poly <- municipios_poly %>%
  group_by(CPRO) %>%
  summarise(NPRO = first(NPRO)) %>%
  st_make_valid() %>%
  st_collection_extract("POLYGON") %>%
  st_make_valid()

provincias_simp <- ms_simplify(provincias_poly, keep = 0.03, keep_shapes = TRUE)
provincias <- st_cast(provincias_simp, "MULTILINESTRING") %>% st_make_valid()
provincias$stroke                <- "#787878"
provincias[["stroke-width"]]     <- 1.5
provincias[["stroke-opacity"]]   <- 0.65

st_write(provincias, file.path(out_dir, "provincias.geojson"),
         driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=5", delete_dsn = TRUE)
message(sprintf("  Exported provincias.geojson (%d provinces)", nrow(provincias)))

# -- Demo subsets (Andalucía)
demo_provs <- c("04", "11", "14", "18", "21", "23", "29", "41")

st_write(municipios_lines %>% filter(CPRO %in% demo_provs),
         file.path(out_dir, "municipios_demo.geojson"),
         driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=5", delete_dsn = TRUE)
st_write(provincias %>% filter(CPRO %in% demo_provs),
         file.path(out_dir, "provincias_demo.geojson"),
         driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=5", delete_dsn = TRUE)
message("  Exported demo boundary files (Andalucía)")