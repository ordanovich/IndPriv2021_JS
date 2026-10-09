library(sf)
library(data.table)
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

  n_na_21 <- sum(is.na(geo$IP2021))
  n_na_11 <- sum(is.na(geo$IP2011))
  if (n_na_21 > 0) message(sprintf("  NOTE: %d sections have no IP2021 value (no CUSEC match in Excel) — will render empty on map", n_na_21))
  if (n_na_11 > 0) message(sprintf("  NOTE: %d sections have no IP2011 value (section not in 2011 Excel) — will render empty on map", n_na_11))

} else {
  message("Loading FAKE data...")
  set.seed(2026)
  geo$IP2021 <- round(runif(nrow(geo), min = -3, max = 3), 2)
  geo$IP2011 <- round(runif(nrow(geo), min = -3, max = 3), 2)
}

# 3. Categorical Labels
# 2011: compute breaks from full national IP2011 distribution (dt_11), same approach as 2021
breaks_11 <- quantile(dt_11$IP2011, probs = seq(0, 1, 0.2), na.rm = TRUE)
fmt <- function(x) gsub("\\.", ",", sprintf("%.2f", x))
etiquetas_11 <- c(
  paste0("1. Inferior [",        fmt(breaks_11[1]), "/", fmt(breaks_11[2]), "]"),
  paste0("2. Intermedio bajo [", fmt(breaks_11[2]), "/", fmt(breaks_11[3]), "]"),
  paste0("3. Intermedio [",      fmt(breaks_11[3]), "/", fmt(breaks_11[4]), "]"),
  paste0("4. Intermedio alto [", fmt(breaks_11[4]), "/", fmt(breaks_11[5]), "]"),
  paste0("5. Superior [",        fmt(breaks_11[5]), "/", fmt(breaks_11[6]), "]")
)
message("--- Q11_Label values for simple.json ---")
for (l in etiquetas_11) message("  ", l)
message("----------------------------------------")
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

# 4. Export at original precision (no simplification)
message("Exporting geometry at original precision...")
geo_out <- geo_final %>%
  st_collection_extract("POLYGON") %>%
  st_make_valid() %>%
  st_collection_extract("POLYGON")

out_dir <- "../terria_frontend/wwwroot/data"
if (!dir.exists(out_dir)) dir.create(out_dir, recursive = TRUE)
out_file <- file.path(out_dir, "secciones_unified.geojson")

st_write(geo_out, out_file, driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=6", delete_dsn = TRUE)
message("Exported: ", out_file)

# 4b. 2021-only GeoJSON (no IP2011/Q11 columns)
cols_2021 <- c("CUSEC", "CCAA", "NMUN", "NPRO", "IP2021", "Q21_num", "Q21_Label", "stroke-width", "stroke-opacity")
geo_2021 <- geo_out[, intersect(cols_2021, names(geo_out))]
out_file_2021 <- file.path(out_dir, "secciones_2021.geojson")
st_write(geo_2021, out_file_2021, driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=6", delete_dsn = TRUE)
message("Exported: ", out_file_2021)

# 5. 2011 Shapefile
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

  dt_geo_11 <- as.data.table(st_drop_geometry(geo_11))
  dt_m11 <- merge(dt_geo_11, dt_11[, .(CUSEC, IP2011)], by = "CUSEC", all.x = TRUE)
  geo_11$IP2011 <- dt_m11[match(geo_11$CUSEC, dt_m11$CUSEC), IP2011]
  geo_11$IP2011 <- round(as.numeric(geo_11$IP2011), 3)

  joined_n <- sum(!is.na(geo_11$IP2011))
  message(sprintf("  Joined IP2011 for %d / %d sections", joined_n, nrow(geo_11)))
  if (joined_n == 0)
    stop("No CUSEC matches between 2011 shapefile and IP2011_RE.xlsx — check that both use the same CUSEC format")

  geo_11$Q11_Label <- as.character(factor(ntile(geo_11$IP2011, 5), levels = 1:5, labels = etiquetas_11))
  geo_11[["stroke-width"]]   <- 0
  geo_11[["stroke-opacity"]] <- 0

  missing_cols <- setdiff(c("NMUN", "NPRO"), names(geo_11))
  if (length(missing_cols) > 0)
    message("  WARNING: expected columns missing from 2011 shapefile: ", paste(missing_cols, collapse = ", "),
            " — those fields will be absent from the output")

  cols_11 <- c("CUSEC", "NMUN", "NPRO", "IP2011", "Q11_Label", "stroke-width", "stroke-opacity")
  geo_11_final <- geo_11[, intersect(cols_11, names(geo_11))]

  message("  Exporting 2011 geometry at original precision...")
  geo_11_out <- geo_11_final %>%
    st_collection_extract("POLYGON") %>%
    st_make_valid() %>%
    st_collection_extract("POLYGON")

  out_file_11 <- file.path(out_dir, "secciones_2011.geojson")
  st_write(geo_11_out, out_file_11, driver = "GeoJSON",
           layer_options = "COORDINATE_PRECISION=6", delete_dsn = TRUE)
  message("Exported: ", out_file_11)

  # Demo subset for 2011 (Andalucía, original precision)
  andalucia_provs <- c("04", "11", "14", "18", "21", "23", "29", "41")
  prov_code_11 <- substr(formatC(as.character(geo_11_out$CUSEC), width = 9, flag = "0"), 1, 2)
  demo_11 <- geo_11_out[prov_code_11 %in% andalucia_provs, ]
  out_file_11_demo <- file.path(out_dir, "secciones_2011_demo.geojson")
  st_write(demo_11, out_file_11_demo, driver = "GeoJSON",
           layer_options = "COORDINATE_PRECISION=9", delete_dsn = TRUE)
  message(sprintf("Exported: %s (%d sections)", out_file_11_demo, nrow(demo_11)))
}

# 6. Administrative boundary overlays — dissolved from original-precision sections
message("Dissolving administrative boundaries for navigation overlays...")

geo_s <- geo_out
geo_s$CPRO <- substr(formatC(as.character(geo_s$CUSEC), width = 9, flag = "0"), 1, 2)
geo_s$CMUN <- substr(formatC(as.character(geo_s$CUSEC), width = 9, flag = "0"), 1, 5)

# Municipalities: dissolve then convert to boundary lines
message("  Dissolving to municipalities...")
municipios_poly <- geo_s %>%
  group_by(CMUN) %>%
  summarise(NMUN = first(NMUN), NPRO = first(NPRO), CPRO = first(CPRO)) %>%
  st_make_valid() %>%
  st_collection_extract("POLYGON") %>%
  st_make_valid()

municipios_lines <- st_cast(municipios_poly, "MULTILINESTRING") %>% st_make_valid()
municipios_lines$stroke           <- "#aaaaaa"
municipios_lines[["stroke-width"]]   <- 0.7
municipios_lines[["stroke-opacity"]] <- 0.45

st_write(municipios_lines, file.path(out_dir, "municipios.geojson"),
         driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=6", delete_dsn = TRUE)
message(sprintf("  Exported municipios.geojson (%d boundaries)", nrow(municipios_lines)))

# Provinces: dissolve to polygons
message("  Dissolving to provinces...")
provincias_poly <- municipios_poly %>%
  group_by(CPRO) %>%
  summarise(NPRO = first(NPRO)) %>%
  st_make_valid() %>%
  st_collection_extract("POLYGON") %>%
  st_make_valid()

provincias <- st_cast(provincias_poly, "MULTILINESTRING") %>% st_make_valid()
provincias$stroke                <- "#787878"
provincias[["stroke-width"]]     <- 1.5
provincias[["stroke-opacity"]]   <- 0.65

st_write(provincias, file.path(out_dir, "provincias.geojson"),
         driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=6", delete_dsn = TRUE)
message(sprintf("  Exported provincias.geojson (%d provinces)", nrow(provincias)))

# -- Demo subsets at original precision (Andalucía)
demo_provs <- c("04", "11", "14", "18", "21", "23", "29", "41")
message("Building demo GeoJSONs from original-precision data...")

prov_code_final <- substr(formatC(as.character(geo_out$CUSEC), width = 9, flag = "0"), 1, 2)

# 2021-only demo — use COORDINATE_PRECISION=9 (sub-mm) to prevent GDAL from
# rounding tiny ring vertices to identical points (which produces GeometryCollection).
demo_2021_orig <- geo_out[prov_code_final %in% demo_provs,
                            intersect(cols_2021, names(geo_out))]
out_file_2021_demo <- file.path(out_dir, "secciones_2021_demo.geojson")
st_write(demo_2021_orig, out_file_2021_demo, driver = "GeoJSON",
         layer_options = "COORDINATE_PRECISION=9", delete_dsn = TRUE)
message(sprintf("Exported: %s (%d sections)", out_file_2021_demo, nrow(demo_2021_orig)))

# Unified demo (all columns, Andalucía)
demo_unified_orig <- geo_out[prov_code_final %in% demo_provs, ]
out_file_unified_demo <- file.path(out_dir, "secciones_unified_demo.geojson")
st_write(demo_unified_orig, out_file_unified_demo, driver = "GeoJSON",
         layer_options = "COORDINATE_PRECISION=9", delete_dsn = TRUE)
message(sprintf("Exported: %s (%d sections)", out_file_unified_demo, nrow(demo_unified_orig)))

# Demo administrative boundaries: dissolve from original-precision Andalucía sections
message("  Building demo boundary overlays from original-precision data...")
demo_geo_s <- geo_out[prov_code_final %in% demo_provs, ]
demo_geo_s$CPRO <- substr(formatC(as.character(demo_geo_s$CUSEC), width = 9, flag = "0"), 1, 2)
demo_geo_s$CMUN <- substr(formatC(as.character(demo_geo_s$CUSEC), width = 9, flag = "0"), 1, 5)

demo_muni_poly <- demo_geo_s %>%
  group_by(CMUN) %>%
  summarise(NMUN = first(NMUN), NPRO = first(NPRO), CPRO = first(CPRO)) %>%
  st_make_valid() %>%
  st_collection_extract("POLYGON") %>%
  st_make_valid()

demo_muni_lines <- st_cast(demo_muni_poly, "MULTILINESTRING") %>% st_make_valid()
demo_muni_lines$stroke               <- "#aaaaaa"
demo_muni_lines[["stroke-width"]]    <- 0.7
demo_muni_lines[["stroke-opacity"]]  <- 0.45

demo_prov_poly <- demo_muni_poly %>%
  group_by(CPRO) %>%
  summarise(NPRO = first(NPRO)) %>%
  st_make_valid() %>%
  st_collection_extract("POLYGON") %>%
  st_make_valid()

demo_prov_lines <- st_cast(demo_prov_poly, "MULTILINESTRING") %>% st_make_valid()
demo_prov_lines$stroke               <- "#787878"
demo_prov_lines[["stroke-width"]]    <- 1.5
demo_prov_lines[["stroke-opacity"]]  <- 0.65

st_write(demo_muni_lines, file.path(out_dir, "municipios_demo.geojson"),
         driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=6", delete_dsn = TRUE)
st_write(demo_prov_lines, file.path(out_dir, "provincias_demo.geojson"),
         driver = "GeoJSON", layer_options = "COORDINATE_PRECISION=6", delete_dsn = TRUE)
message("  Exported demo boundary files (Andalucía, original precision)")
