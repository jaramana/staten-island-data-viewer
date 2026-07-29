# Data sources

Every number, polygon and point in this viewer traces back to a row in one of
the datasets below. Nothing is invented, simulated, or filled in. Presentation
is stylised (colour ramps, exaggerated marker sizes, a game-like camera); the
underlying values are not.

This file is **generated** by `pipeline/make_data_sources.py` from
`data/raw/_manifest.json`, which is itself written by `pipeline/download.py`.
Do not edit it by hand — re-run the pipeline instead.

All NYC datasets below are published on NYC Open Data under the
[NYC Open Data Terms of Use](https://www.nyc.gov/html/data/terms.html), which
permit reuse with attribution. Attribution appears in the app footer.


## Datasets in use

| Key | Dataset | Publisher | Publisher last updated | Staten Island filter | Rows |
|---|---|---|---|---|---|
| `borough_boundary` | [Borough Boundaries](https://data.cityofnewyork.us/d/gthc-hcne) | Department of City Planning (DCP) | 2026-05-26 | `borocode='5'` | 1 |
| `buildings` | [Building Footprints (BUILDING)](https://data.cityofnewyork.us/d/5zhs-2jue) | Department of Information Technology & Telecommunications (DOITT) | 2026-07-26 | `starts_with(base_bbl,'5')` | 142,455 |
| `pluto` | [Primary Land Use Tax Lot Output (PLUTO)](https://data.cityofnewyork.us/d/64uk-42ks) | Department of City Planning (DCP) | 2026-05-28 | `borough='SI'` | 125,692 |
| `streets` | [Street Centerline (CSCL Centerline)](https://data.cityofnewyork.us/d/inkn-q76z) | Department of Information Technology & Telecommunications (DOITT) | 2026-07-26 | `boroughcode='5'` | 16,714 |
| `parks` | [Parks Properties](https://data.cityofnewyork.us/d/enfh-gkve) | Department of Parks and Recreation (DPR) | 2026-07-17 | `borough='R'` | 161 |
| `police_precincts` | [Police Precincts](https://data.cityofnewyork.us/d/y76i-bdw7) | Department of City Planning (DCP) | 2026-05-26 | `precinct in ('120','121','122','123')` | 4 |
| `fire_companies` | [Fire Companies](https://data.cityofnewyork.us/d/bst7-5464) | Department of City Planning (DCP) | 2026-05-26 | `fire_div='8'` | 50 |
| `firehouses` | [FDNY Firehouse Listing](https://data.cityofnewyork.us/d/hc8x-tcnd) | Fire Department (FDNY) | 2022-04-08 | `borough='Staten Island'` | 20 |
| `crime` | [NYPD Complaint Data Current (Year To Date)](https://data.cityofnewyork.us/d/5uac-w243) | Police Department (NYPD) | 2026-07-27 | `boro_nm='STATEN ISLAND'` | 10,807 |
| `sr311` | [311 Service Requests (2020 to Present)](https://data.cityofnewyork.us/d/erm2-nwe9) | 311 / Department of Information Technology & Telecommunications | 2026-07-29 | `borough='STATEN ISLAND' AND created_date > '2025-07-29T00:00:00' AND latitude IS NOT NULL` | 153,330 |
| `trees` | [Forestry Tree Points](https://data.cityofnewyork.us/d/hn5i-inap) | Department of Parks and Recreation (DPR) | 2026-07-14 | `within_box(location,40.66,-74.28,40.47,-74.02)` | 172,172 |
| `budget` | [Expense Budget — Community Boards Geographic Report](https://data.cityofnewyork.us/d/f9xn-fiww) | Office of Management and Budget (OMB) | 2026-07-08 | `boro_nm='RICHMOND'` | 546 |
| `population` | [New York City Population by Borough, 1950–2040](https://data.cityofnewyork.us/d/xywu-7bv9) | Department of City Planning (DCP) | 2014-04-29 | _(whole dataset — 6 rows)_ | 6 |

## Per-dataset detail

### `borough_boundary` — Borough Boundaries

- **Role in this project:** Staten Island clip polygon; borough outline in the base map
- **Socrata asset:** [`gthc-hcne`](https://data.cityofnewyork.us/d/gthc-hcne)
- **Publisher:** Department of City Planning (DCP) (Department of City Planning (DCP))
- **Publisher last updated:** 2026-05-26T19:35:50+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `borocode='5'`
- **Fields pulled:** `borocode,boroname,the_geom`
- **Fetched:** 2026-07-29T15:50:56+00:00 — 1 rows, 0.4 MB raw

### `buildings` — Building Footprints (BUILDING)

- **Role in this project:** Real footprint polygons + real roof heights for the fill-extrusion city
- **Socrata asset:** [`5zhs-2jue`](https://data.cityofnewyork.us/d/5zhs-2jue)
- **Publisher:** Department of Information Technology & Telecommunications (DOITT) (Office of Technology and Innovation (OTI))
- **Publisher last updated:** 2026-07-26T04:55:57+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `starts_with(base_bbl,'5')`
- **Fields pulled:** `bin,base_bbl,mappluto_bbl,height_roof,ground_elevation,construction_year,feature_code,the_geom`
- **Fetched:** 2026-07-29T15:51:59+00:00 — 142,455 rows, 81.1 MB raw
- **Note:** Substituted for the '3-D Building Model' (tnru-abg2) named in PLAN.md §3. That asset was last updated 2016 and ships as per-tile multipatch/DWG files that a browser cannot consume; this is the same city building inventory, currently maintained, with height_roof + ground_elevation in feet and a base_bbl to join PLUTO on. See DATA_SOURCES.md.

### `pluto` — Primary Land Use Tax Lot Output (PLUTO)

- **Role in this project:** Land-use category per tax lot; drives the building colour ramp
- **Socrata asset:** [`64uk-42ks`](https://data.cityofnewyork.us/d/64uk-42ks)
- **Publisher:** Department of City Planning (DCP) (Department of City Planning (DCP))
- **Publisher last updated:** 2026-05-28T19:50:48+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `borough='SI'`
- **Fields pulled:** `bbl,borough,block,lot,address,landuse,bldgclass,zonedist1,ownertype,numfloors,numbldgs,unitsres,unitstotal,lotarea,bldgarea,yearbuilt,assesstot,cd,policeprct,firecomp`
- **Fetched:** 2026-07-29T15:52:12+00:00 — 125,692 rows, 48.5 MB raw

### `streets` — Street Centerline (CSCL Centerline)

- **Role in this project:** Road network for the base map, restyled from scratch
- **Socrata asset:** [`inkn-q76z`](https://data.cityofnewyork.us/d/inkn-q76z)
- **Publisher:** Department of Information Technology & Telecommunications (DOITT) (Office of Technology and Innovation (OTI))
- **Publisher last updated:** 2026-07-26T04:44:42+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `boroughcode='5'`
- **Fields pulled:** `physicalid,rw_type,trafdir,streetwidth,number_travel_lanes,posted_speed,status,segmentlength,the_geom`
- **Fetched:** 2026-07-29T15:52:19+00:00 — 16,714 rows, 6.3 MB raw
- **Note:** Substituted for LION (2v4z-66xt) named in PLAN.md §3. The LION Socrata asset is a stale (2013) zipped file geodatabase requiring GDAL; CSCL Centerline is the city's currently-maintained street centerline, served as queryable GeoJSON. Same role, same publisher, live vintage.

### `parks` — Parks Properties

- **Role in this project:** Green space polygons under the city (Staten Island is ~1/3 parkland)
- **Socrata asset:** [`enfh-gkve`](https://data.cityofnewyork.us/d/enfh-gkve)
- **Publisher:** Department of Parks and Recreation (DPR) (Department of Parks and Recreation (DPR))
- **Publisher last updated:** 2026-07-17T13:40:16+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `borough='R'`
- **Fields pulled:** `gispropnum,signname,typecategory,acres,borough,multipolygon`
- **Fetched:** 2026-07-29T15:52:22+00:00 — 161 rows, 0.9 MB raw

### `police_precincts` — Police Precincts

- **Role in this project:** Click-a-precinct-to-highlight boundaries (SI = 120, 121, 122, 123)
- **Socrata asset:** [`y76i-bdw7`](https://data.cityofnewyork.us/d/y76i-bdw7)
- **Publisher:** Department of City Planning (DCP) (Department of City Planning (DCP))
- **Publisher last updated:** 2026-05-26T19:46:58+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `precinct in ('120','121','122','123')`
- **Fields pulled:** `precinct,the_geom`
- **Fetched:** 2026-07-29T15:52:23+00:00 — 4 rows, 0.4 MB raw

### `fire_companies` — Fire Companies

- **Role in this project:** Click-a-fire-company-to-highlight boundaries
- **Socrata asset:** [`bst7-5464`](https://data.cityofnewyork.us/d/bst7-5464)
- **Publisher:** Department of City Planning (DCP) (Department of City Planning (DCP))
- **Publisher last updated:** 2026-05-26T19:37:21+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `fire_div='8'`
- **Fields pulled:** `fire_co_type,fire_co_num,fire_div,fire_bn,the_geom`
- **Fetched:** 2026-07-29T15:52:24+00:00 — 50 rows, 1.0 MB raw
- **Note:** FDNY Division 8 is Staten Island; verified against the borough clip anyway. Uses the tabular asset bst7-5464 rather than the map asset iiv7-jaj9 named in PLAN.md §3 — same DCP dataset and vintage, but the map asset returns empty properties and null geometry over SODA.

### `firehouses` — FDNY Firehouse Listing

- **Role in this project:** Firehouse point markers
- **Socrata asset:** [`hc8x-tcnd`](https://data.cityofnewyork.us/d/hc8x-tcnd)
- **Publisher:** Fire Department (FDNY) (Fire Department of New York City (FDNY))
- **Publisher last updated:** 2022-04-08T18:08:37+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `borough='Staten Island'`
- **Fields pulled:** `facilityname,facilityaddress,borough,postcode,latitude,longitude`
- **Fetched:** 2026-07-29T15:52:25+00:00 — 20 rows, 0.0 MB raw

### `crime` — NYPD Complaint Data Current (Year To Date)

- **Role in this project:** Crime data view, aggregated to precinct + hex grid (never plotted raw)
- **Socrata asset:** [`5uac-w243`](https://data.cityofnewyork.us/d/5uac-w243)
- **Publisher:** Police Department (NYPD) (Police Department (NYPD))
- **Publisher last updated:** 2026-07-27T15:31:19+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `boro_nm='STATEN ISLAND'`
- **Fields pulled:** `cmplnt_num,addr_pct_cd,cmplnt_fr_dt,rpt_dt,ofns_desc,law_cat_cd,prem_typ_desc,latitude,longitude`
- **Fetched:** 2026-07-29T16:34:40+00:00 — 10,807 rows, 3.0 MB raw
- **Note:** Both dates are pulled deliberately. `rpt_dt` is when the complaint was reported (the year-to-date window this file covers); `cmplnt_fr_dt` is when the incident is said to have occurred, and can be years earlier. Conflating them would misdescribe the dataset.

### `sr311` — 311 Service Requests (2020 to Present)

- **Role in this project:** 311 data view — a trailing 12-month window, a handful of complaint types
- **Socrata asset:** [`erm2-nwe9`](https://data.cityofnewyork.us/d/erm2-nwe9)
- **Publisher:** 311 / Department of Information Technology & Telecommunications (311)
- **Publisher last updated:** 2026-07-29T01:37:20+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `borough='STATEN ISLAND' AND created_date > '2025-07-29T00:00:00' AND latitude IS NOT NULL`
- **Fields pulled:** `unique_key,created_date,closed_date,complaint_type,descriptor,status,agency,incident_zip,latitude,longitude`
- **Fetched:** 2026-07-29T15:52:56+00:00 — 153,330 rows, 48.4 MB raw

### `trees` — Forestry Tree Points

- **Role in this project:** Street tree layer (thinned for render density, never resampled upward)
- **Socrata asset:** [`hn5i-inap`](https://data.cityofnewyork.us/d/hn5i-inap)
- **Publisher:** Department of Parks and Recreation (DPR) (Department of Parks and Recreation)
- **Publisher last updated:** 2026-07-14T14:13:57+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `within_box(location,40.66,-74.28,40.47,-74.02)`
- **Fields pulled:** `objectid,dbh,tpstructure,tpcondition,genusspecies,planteddate,location`
- **Fetched:** 2026-07-29T15:54:12+00:00 — 172,172 rows, 39.5 MB raw
- **Note:** No borough column; pre-filtered by bounding box server-side, then clipped precisely to the borough polygon locally. This is a rolling inventory keyed to planting spaces, not a dated tree census — labelled as such.

### `budget` — Expense Budget — Community Boards Geographic Report

- **Role in this project:** Budget panel: real dollars + headcount budgeted *within Staten Island*
- **Socrata asset:** [`f9xn-fiww`](https://data.cityofnewyork.us/d/f9xn-fiww)
- **Publisher:** Office of Management and Budget (OMB) (Mayor's Office of Management and Budget (OMB))
- **Publisher last updated:** 2026-07-08T14:18:25+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `boro_nm='RICHMOND'`
- **Fields pulled:** `pub_dt,fisc_yr,bud_phs_nm,agy_cd,agy_nm,ua_nm,boro_nm,sub_boro_nm,geo_prg_nm,lcl_serv_dist_nm,curr_amt,curr_pos,bud_amt,bud_pos`
- **Fetched:** 2026-07-29T15:54:13+00:00 — 546 rows, 0.2 MB raw
- **Note:** PLAN.md §3 left the budget source unresolved. The NYC Council budget dashboard publishes no public API; this OMB dataset is the fallback and is strictly better for this project because it is borough-scoped rather than citywide. 'RICHMOND' is Staten Island.

### `population` — New York City Population by Borough, 1950–2040

- **Role in this project:** Population headline number in the HUD strip
- **Socrata asset:** [`xywu-7bv9`](https://data.cityofnewyork.us/d/xywu-7bv9)
- **Publisher:** Department of City Planning (DCP) (Department of City Planning (DCP))
- **Publisher last updated:** 2014-04-29T14:39:28+00:00
- **Licence:** NYC Open Data Terms of Use
- **Access method:** SODA v2 REST, paged; `pipeline/download.py`
- **Staten Island filter:** `None`
- **Fields pulled:** `*`
- **Fetched:** 2026-07-29T15:54:14+00:00 — 6 rows, 0.0 MB raw
- **Note:** 1950–2020 columns are decennial Census counts; 2030/2040 columns are DCP projections and must be labelled as projections wherever shown. The Census Bureau ACS API now requires a registered key, which is a user action — see DATA_SOURCES.md, Open items.

## Open items (need a user decision or a user-owned account)

- **`mta_realtime`** — MTA GTFS-realtime (api.mta.info) — Phase 6, optional. Requires a free developer key registered under the user's own account.
- **`traffic_511ny`** — 511NY (511ny.org/developers) — Phase 6, optional. Requires a free developer key, 10 req/60s throttle.
- **`news`** — News box RSS. Two candidate feeds confirmed reachable and well-formed on 2026-07-29: SILive/Staten Island Advance (https://www.silive.com/arc/outboundfeeds/rss/?outputType=xml) and Gothamist (https://gothamist.com/feed). PLAN.md §3 requires user confirmation before building against a specific feed.
- **`audio`** — 2-3 freely licensed SC4-mood tracks. PLAN.md §5 requires the shortlist to be confirmed with the user before anything is committed.
