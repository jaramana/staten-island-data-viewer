"""Single source of truth for every dataset this project pulls.

Nothing here invents data. Every entry points at a real, published, public
dataset; `download.py` records the vintage it actually received into
`data/raw/_manifest.json`, and `DATA_SOURCES.md` is generated from that.

Staten Island == Borough 5 == "Richmond County" == boro codes:
    numeric '5' | 'STATEN ISLAND' | 'SI' | 'R' | 'RICHMOND'
depending on which agency published the file. Each source below states the
filter it uses so the borough clip is auditable.
"""

DOMAIN = "https://data.cityofnewyork.us"

# Generous bounding box around Staten Island, used only where a dataset has no
# borough column and must be pre-filtered spatially before the precise clip.
# (north, west, south, east)
SI_BBOX = (40.66, -74.28, 40.47, -74.02)

# --------------------------------------------------------------------------
# Socrata (SODA v2) sources. Each is paged by download.py.
# --------------------------------------------------------------------------

SOURCES = {
    "borough_boundary": dict(
        id="gthc-hcne",
        title="Borough Boundaries",
        agency="Department of City Planning (DCP)",
        role="Staten Island clip polygon; borough outline in the base map",
        select="borocode,boroname,the_geom",
        where="borocode='5'",
        order="borocode",
        geo=True,
    ),
    "buildings": dict(
        id="5zhs-2jue",
        title="Building Footprints (BUILDING)",
        agency="Department of Information Technology & Telecommunications (DOITT)",
        role="Real footprint polygons + real roof heights for the fill-extrusion city",
        note=(
            "Substituted for the '3-D Building Model' (tnru-abg2) named in PLAN.md §3. "
            "That asset was last updated 2016 and ships as per-tile multipatch/DWG "
            "files that a browser cannot consume; this is the same city building "
            "inventory, currently maintained, with height_roof + ground_elevation in "
            "feet and a base_bbl to join PLUTO on. See DATA_SOURCES.md."
        ),
        select=(
            "bin,base_bbl,mappluto_bbl,height_roof,ground_elevation,"
            "construction_year,feature_code,the_geom"
        ),
        where="starts_with(base_bbl,'5')",
        order="bin",
        geo=True,
    ),
    "pluto": dict(
        id="64uk-42ks",
        title="Primary Land Use Tax Lot Output (PLUTO)",
        agency="Department of City Planning (DCP)",
        role="Land-use category per tax lot; drives the building colour ramp",
        select=(
            "bbl,borough,block,lot,address,landuse,bldgclass,zonedist1,ownertype,"
            "numfloors,numbldgs,unitsres,unitstotal,lotarea,bldgarea,yearbuilt,"
            "assesstot,cd,policeprct,firecomp"
        ),
        where="borough='SI'",
        order="bbl",
        geo=False,
    ),
    "streets": dict(
        id="inkn-q76z",
        title="Street Centerline (CSCL Centerline)",
        agency="Department of Information Technology & Telecommunications (DOITT)",
        role="Road network for the base map, restyled from scratch",
        note=(
            "Substituted for LION (2v4z-66xt) named in PLAN.md §3. The LION Socrata "
            "asset is a stale (2013) zipped file geodatabase requiring GDAL; CSCL "
            "Centerline is the city's currently-maintained street centerline, served "
            "as queryable GeoJSON. Same role, same publisher, live vintage."
        ),
        select=(
            "physicalid,rw_type,trafdir,streetwidth,number_travel_lanes,"
            "posted_speed,status,segmentlength,the_geom"
        ),
        where="boroughcode='5'",
        order="physicalid",
        geo=True,
    ),
    "parks": dict(
        id="enfh-gkve",
        title="Parks Properties",
        agency="Department of Parks and Recreation (DPR)",
        role="Green space polygons under the city (Staten Island is ~1/3 parkland)",
        select="gispropnum,signname,typecategory,acres,borough,multipolygon",
        where="borough='R'",
        order="gispropnum",
        geo=True,
        geom_field="multipolygon",
    ),
    "police_precincts": dict(
        id="y76i-bdw7",
        title="Police Precincts",
        agency="Department of City Planning (DCP)",
        role="Click-a-precinct-to-highlight boundaries (SI = 120, 121, 122, 123)",
        select="precinct,the_geom",
        where="precinct in ('120','121','122','123')",
        order="precinct",
        geo=True,
    ),
    "fire_companies": dict(
        id="bst7-5464",
        title="Fire Companies",
        agency="Department of City Planning (DCP)",
        role="Click-a-fire-company-to-highlight boundaries",
        select="fire_co_type,fire_co_num,fire_div,fire_bn,the_geom",
        where="fire_div='8'",
        order="fire_co_num",
        geo=True,
        note=(
            "FDNY Division 8 is Staten Island; verified against the borough clip anyway. "
            "Uses the tabular asset bst7-5464 rather than the map asset iiv7-jaj9 named "
            "in PLAN.md §3 — same DCP dataset and vintage, but the map asset returns "
            "empty properties and null geometry over SODA."
        ),
    ),
    "firehouses": dict(
        id="hc8x-tcnd",
        title="FDNY Firehouse Listing",
        agency="Fire Department (FDNY)",
        role="Firehouse point markers",
        select="facilityname,facilityaddress,borough,postcode,latitude,longitude",
        where="borough='Staten Island'",
        order="facilityname",
        geo=False,
    ),
    "crime": dict(
        id="5uac-w243",
        title="NYPD Complaint Data Current (Year To Date)",
        agency="Police Department (NYPD)",
        role="Crime data view, aggregated to precinct + hex grid (never plotted raw)",
        select=(
            "cmplnt_num,addr_pct_cd,cmplnt_fr_dt,rpt_dt,ofns_desc,law_cat_cd,"
            "prem_typ_desc,latitude,longitude"
        ),
        note=(
            "Both dates are pulled deliberately. `rpt_dt` is when the complaint was "
            "reported (the year-to-date window this file covers); `cmplnt_fr_dt` is "
            "when the incident is said to have occurred, and can be years earlier. "
            "Conflating them would misdescribe the dataset."
        ),
        where="boro_nm='STATEN ISLAND'",
        order="cmplnt_num",
        geo=False,
    ),
    "sr311": dict(
        id="erm2-nwe9",
        title="311 Service Requests (2020 to Present)",
        agency="311 / Department of Information Technology & Telecommunications",
        role="311 data view — a trailing 12-month window, a handful of complaint types",
        select=(
            "unique_key,created_date,closed_date,complaint_type,descriptor,"
            "status,agency,incident_zip,latitude,longitude"
        ),
        # `where` is filled in at download time with a rolling 12-month window.
        where=None,
        where_template=(
            "borough='STATEN ISLAND' AND created_date > '{since}' "
            "AND latitude IS NOT NULL"
        ),
        order="unique_key",
        geo=False,
    ),
    "trees": dict(
        id="hn5i-inap",
        title="Forestry Tree Points",
        agency="Department of Parks and Recreation (DPR)",
        role="Street tree layer (thinned for render density, never resampled upward)",
        select="objectid,dbh,tpstructure,tpcondition,genusspecies,planteddate,location",
        where=(
            "within_box(location,{n},{w},{s},{e})".format(
                n=SI_BBOX[0], w=SI_BBOX[1], s=SI_BBOX[2], e=SI_BBOX[3]
            )
        ),
        order="objectid",
        geo=False,
        note=(
            "No borough column; pre-filtered by bounding box server-side, then clipped "
            "precisely to the borough polygon locally. This is a rolling inventory "
            "keyed to planting spaces, not a dated tree census — labelled as such."
        ),
    ),
    "budget": dict(
        id="f9xn-fiww",
        title="Expense Budget — Community Boards Geographic Report",
        agency="Office of Management and Budget (OMB)",
        role="Budget panel: real dollars + headcount budgeted *within Staten Island*",
        select=(
            "pub_dt,fisc_yr,bud_phs_nm,agy_cd,agy_nm,ua_nm,boro_nm,sub_boro_nm,"
            "geo_prg_nm,lcl_serv_dist_nm,curr_amt,curr_pos,bud_amt,bud_pos"
        ),
        where="boro_nm='RICHMOND'",
        order="pub_dt,agy_cd",
        geo=False,
        note=(
            "PLAN.md §3 left the budget source unresolved. The NYC Council budget "
            "dashboard publishes no public API; this OMB dataset is the fallback and "
            "is strictly better for this project because it is borough-scoped rather "
            "than citywide. 'RICHMOND' is Staten Island."
        ),
    ),
    "population": dict(
        id="xywu-7bv9",
        title="New York City Population by Borough, 1950–2040",
        agency="Department of City Planning (DCP)",
        role="Population headline number in the HUD strip",
        select="*",
        where=None,
        order=None,
        geo=False,
        note=(
            "1950–2020 columns are decennial Census counts; 2030/2040 columns are DCP "
            "projections and must be labelled as projections wherever shown. The "
            "Census Bureau ACS API now requires a registered key, which is a user "
            "action — see DATA_SOURCES.md, Open items."
        ),
    ),
}


# --------------------------------------------------------------------------
# Sources deliberately NOT wired up yet (each needs a user decision first).
# --------------------------------------------------------------------------

PENDING_USER_DECISION = {
    "mta_realtime": (
        "MTA GTFS-realtime (api.mta.info) — Phase 6, optional. Requires a free "
        "developer key registered under the user's own account."
    ),
    "traffic_511ny": (
        "511NY (511ny.org/developers) — Phase 6, optional. Requires a free developer "
        "key, 10 req/60s throttle."
    ),
    "news": (
        "News box RSS. Two candidate feeds confirmed reachable and well-formed on "
        "2026-07-29: SILive/Staten Island Advance "
        "(https://www.silive.com/arc/outboundfeeds/rss/?outputType=xml) and Gothamist "
        "(https://gothamist.com/feed). PLAN.md §3 requires user confirmation before "
        "building against a specific feed."
    ),
    "audio": (
        "2-3 freely licensed SC4-mood tracks. PLAN.md §5 requires the shortlist to be "
        "confirmed with the user before anything is committed."
    ),
}
