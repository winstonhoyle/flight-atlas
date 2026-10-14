import logging

import geojson

logger = logging.getLogger(__name__)


def parse_wkt_point(wkt: str) -> tuple[float, float]:
    lon, lat = map(float, wkt.replace("POINT (", "").replace(")", "").split())
    return lon, lat


def airports_collection(rows: list[dict]) -> geojson.FeatureCollection:
    features = []
    for row in rows:
        try:
            if len(row["iata"]) != 3:
                continue
            features.append(
                geojson.Feature(
                    geometry=geojson.Point(parse_wkt_point(row["geometry"])),
                    properties={
                        # The scraper writes 0.0 where an airport has no FAA code.
                        "FAA": row.get("faa") if row.get("faa") != "0.0" else None,
                        "IATA": row["iata"],
                        "Name": row["title"],
                        "url": row["url"],
                        "destinations": int(row["destinations"]),
                    },
                )
            )
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Skipping invalid airport row: {e}")
    return geojson.FeatureCollection(features)


def routes_collection(rows: list[dict], airline: str | None = None) -> geojson.FeatureCollection:
    features = []
    for row in rows:
        try:
            if airline and row.get("airline_code") != airline:
                continue
            src, dst = row.get("src_airport", ""), row.get("dst_airport", "")
            if len(src) != 3 or len(dst) != 3:
                continue
            line = geojson.LineString(
                [
                    list(parse_wkt_point(row["src_geometry"])),
                    list(parse_wkt_point(row["dst_geometry"])),
                ]
            )
            features.append(
                geojson.Feature(
                    geometry=line,
                    properties={
                        "airline_code": row["airline_code"],
                        "src_airport": src,
                        "dst_airport": dst,
                    },
                )
            )
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Skipping invalid route row: {e}")
    return geojson.FeatureCollection(features)
