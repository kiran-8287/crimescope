"""Download and validate indexed general districtwise IPC/BNS fragments.

Files are taken from the repository's raw GitHub URLs, not generated locally.
Existing files are never overwritten. Results, checksums, state/UT labels, and
per-file errors are written to data/raw/download_manifest_2021_2024.json.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


INDEX_URL = "https://raw.githubusercontent.com/reclaimchennai/NCRB/main/data/tables_index.csv"
RAW_BASE_URL = "https://raw.githubusercontent.com/reclaimchennai/NCRB/main/"
YEARS = (2021, 2022, 2023, 2024)
MANIFEST_PATH = Path("data/raw/download_manifest_2021_2024.json")
FRAGMENT_DIR = "districtwise_ipc_bns_fragments"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str, attempts: int = 3) -> tuple[bytes, str | None]:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = Request(url, headers={"User-Agent": "CrimeScope-source-downloader/1.0", "Accept": "text/csv,*/*"})
            with urlopen(request, timeout=45) as response:
                if response.status != 200:
                    raise OSError(f"HTTP status {response.status}")
                return response.read(), response.headers.get("Content-Type")
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(1.5 * (attempt + 1))
    assert last_error is not None
    raise last_error


def state_label(title: str, table_id: str = "") -> str | None:
    match = re.match(r"^State:\s*(.*?)\s*$", title, flags=re.IGNORECASE)
    if not match:
        # The first fragment in each configured general-table family contains
        # Andhra Pradesh; the index title is a table title rather than a state.
        if re.search(r"_t1$", table_id, flags=re.IGNORECASE) and title.casefold().startswith("districtwise ipc"):
            return "Andhra Pradesh"
        return None
    return re.sub(r"\s+#$", "", match.group(1)).strip()


def state_label_source(title: str, table_id: str = "") -> str | None:
    if re.match(r"^State:\s*", title, flags=re.IGNORECASE):
        return "tables_index.csv title"
    if re.search(r"_t1$", table_id, flags=re.IGNORECASE) and title.casefold().startswith("districtwise ipc"):
        return "fragment district rows (Andhra Pradesh)"
    return None


def validate_table(data: bytes, content_type: str | None, expected_rows: str, expected_cols: str) -> dict:
    prefix = data[:512].lstrip().lower()
    if not data:
        raise ValueError("empty response body")
    if "text/html" in (content_type or "").lower() or prefix.startswith((b"<!doctype html", b"<html", b"<head", b"<body")):
        raise ValueError("response is HTML, not a CSV table")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(f"response is not UTF-8 CSV text: {exc}") from exc
    try:
        rows = list(csv.reader(io.StringIO(text, newline="")))
    except csv.Error as exc:
        raise ValueError(f"CSV parse error: {exc}") from exc
    if len(rows) < 2:
        raise ValueError("CSV has no header plus data rows")
    header = [cell.strip() for cell in rows[0]]
    if len(header) < 4 or [v.casefold() for v in header[:2]] != ["section", "sl_no"]:
        raise ValueError(f"unexpected table header: {header[:5]!r}")
    if header[2].casefold() not in {"name", "state/ut/district"}:
        raise ValueError(f"unexpected geography column: {header[2]!r}")
    if len(rows) - 1 != int(expected_rows):
        raise ValueError(f"row count mismatch: index={expected_rows}, downloaded={len(rows) - 1}")
    # Index n_cols describes crime measures; the extracted CSV prepends section,
    # serial and geography columns.
    if len(header) != int(expected_cols) + 3:
        raise ValueError(f"column count mismatch: index measures={expected_cols}, CSV columns={len(header)}")
    if not any(any(cell.strip() for cell in row) for row in rows[1:]):
        raise ValueError("CSV contains no non-empty table records")
    return {"row_count": len(rows) - 1, "column_count": len(header), "measure_column_count": len(header) - 3, "header": header}


def read_source_families(sources_path: Path) -> dict[int, tuple[str, str]]:
    families: dict[int, tuple[str, str]] = {}
    with sources_path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                year = int(row["publication_year"])
            except (KeyError, ValueError):
                continue
            table_key = re.sub(r"[^a-z]", "", row.get("table_identifier", "").lower())
            if year not in YEARS or "districtwiseipccrimes" not in table_key:
                continue
            archive = Path(row["archive_path"])
            if archive.suffix.lower() != ".csv":
                continue
            stem = re.sub(r"_t1$", "", archive.stem, flags=re.IGNORECASE)
            families[year] = (archive.parent.as_posix(), stem)
    missing = sorted(set(YEARS) - set(families))
    if missing:
        raise ValueError(f"config/sources.csv has no general districtwise IPC source family for years: {missing}")
    return families


def select_fragments(index_bytes: bytes, families: dict[int, tuple[str, str]]) -> list[dict[str, str]]:
    try:
        text = index_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(f"index response is not UTF-8 CSV: {exc}") from exc
    reader = csv.DictReader(io.StringIO(text, newline=""))
    required = {"table_id", "publication", "year", "listing", "title", "n_rows", "n_cols", "csv"}
    if not reader.fieldnames or not required.issubset(reader.fieldnames):
        raise ValueError(f"index is missing required columns: {sorted(required - set(reader.fieldnames or []))}")
    selected: list[dict[str, str]] = []
    for row in reader:
        try:
            year = int(row["year"])
        except (TypeError, ValueError):
            continue
        if year not in YEARS or row["publication"].casefold() != "cii" or row["listing"].casefold() != "additional_table":
            continue
        directory, stem = families[year]
        index_path = Path(row["csv"]).as_posix()
        source_stem = Path(index_path).stem
        if Path(index_path).parent.as_posix() != directory:
            continue
        if not re.fullmatch(re.escape(stem) + r"_t\d+", source_stem, flags=re.IGNORECASE):
            continue
        # Reject unrelated serial/table families even if their title happens to
        # contain districtwise IPC wording.
        if not row["table_id"].startswith(f"cii/{year}/"):
            continue
        selected.append(row)
    selected.sort(key=lambda row: (int(row["year"]), int(Path(row["csv"]).stem.rsplit("_t", 1)[1])))
    for year in YEARS:
        count = sum(1 for row in selected if int(row["year"]) == year)
        if count == 0:
            raise ValueError(f"index contains no configured general IPC/BNS fragments for {year}")
    return selected


def write_preserving(path: Path, data: bytes) -> tuple[Path, str]:
    path.parent.mkdir(parents=True, exist_ok=True)
    digest = sha256(data)
    if path.exists():
        existing = path.read_bytes()
        if sha256(existing) == digest:
            return path, "already_present_verified"
        path = path.with_name(f"{path.stem}.{digest[:12]}{path.suffix}")
        if path.exists():
            if sha256(path.read_bytes()) == digest:
                return path, "already_present_verified"
            raise FileExistsError(f"preserving existing files; checksum-qualified path also differs: {path}")
    path.write_bytes(data)
    return path, "downloaded_verified"


def download_fragment(row: dict[str, str], root: Path) -> dict:
    year = int(row["year"])
    source_path = Path(row["csv"]).as_posix()
    url = RAW_BASE_URL + source_path
    output = root / "data" / "raw" / str(year) / FRAGMENT_DIR / Path(source_path).name
    entry = {
        "year": year,
        "table_id": row["table_id"],
        "table_title": row["title"],
        "state_ut_label": state_label(row["title"], row["table_id"]),
        "state_ut_label_source": state_label_source(row["title"], row["table_id"]),
        "index_source_path": source_path,
        "source_url": url,
        "local_path": output.relative_to(root).as_posix(),
        "expected_rows": int(row["n_rows"]),
        "expected_measure_columns": int(row["n_cols"]),
        "status": "pending",
        "sha256": None,
        "bytes": None,
        "validation": None,
        "error": None,
    }
    try:
        data, content_type = fetch(url)
        validation = validate_table(data, content_type, row["n_rows"], row["n_cols"])
        actual_path, status = write_preserving(output, data)
        entry.update({"local_path": actual_path.relative_to(root).as_posix(), "status": status, "sha256": sha256(data), "bytes": len(data), "content_type": content_type, "validation": validation})
    except Exception as exc:
        entry.update({"status": "failed", "error": str(exc)})
    return entry


def save_manifest(path: Path, manifest: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp_path.replace(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Download and validate the general districtwise IPC/BNS table fragments for 2021-2024.")
    parser.add_argument("--config", default="config/project.yaml", help="Project YAML path (used to locate config/sources.csv)")
    parser.add_argument("--index-url", default=INDEX_URL, help="tables_index.csv URL")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH), help="Download manifest output path")
    args = parser.parse_args(argv)

    config_path = Path(args.config).resolve()
    root = config_path.parent.parent if config_path.parent.name == "config" else config_path.parent
    sources_path = root / "config" / "sources.csv"
    manifest_path = root / args.manifest
    manifest: dict = {
        "schema_version": 1,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "index": {"url": args.index_url, "status": "pending", "sha256": None, "selected_fragments": 0},
        "scope": {"years": list(YEARS), "publication": "cii", "source_family": "general districtwise IPC/BNS", "output_root": "data/raw/<year>/" + FRAGMENT_DIR},
        "year_summary": {},
        "files": [],
    }

    try:
        families = read_source_families(sources_path)
        index_bytes, index_type = fetch(args.index_url)
        if "text/html" in (index_type or "").lower() or index_bytes.lstrip().lower().startswith((b"<!doctype html", b"<html")):
            raise ValueError("index URL returned HTML instead of CSV")
        manifest["index"].update({"status": "downloaded", "sha256": sha256(index_bytes), "content_type": index_type})
        fragments = select_fragments(index_bytes, families)
        manifest["index"]["selected_fragments"] = len(fragments)
    except Exception as exc:
        manifest["index"].update({"status": "failed", "error": str(exc)})
        save_manifest(manifest_path, manifest)
        print(f"FAILED {args.index_url}: {exc}", file=sys.stderr)
        print(f"Manifest: {manifest_path}", file=sys.stderr)
        return 1

    manifest["status"] = "downloading"
    save_manifest(manifest_path, manifest)
    processed = 0
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(download_fragment, row, root) for row in fragments]
        for future in as_completed(futures):
            entry = future.result()
            manifest["files"].append(entry)
            processed += 1
            if entry["status"] == "failed":
                print(f"FAILED {entry['source_url']}: {entry['error']}", file=sys.stderr)
            if processed % 12 == 0 or processed == len(fragments):
                print(f"Processed {processed} / {len(fragments)} fragments")
            save_manifest(manifest_path, manifest)

    manifest["files"].sort(key=lambda entry: (entry["year"], entry["table_id"]))
    for year in YEARS:
        year_entries = [entry for entry in manifest["files"] if entry["year"] == year]
        manifest["year_summary"][str(year)] = {
            "selected": len(year_entries),
            "successful": sum(entry["status"] in {"downloaded_verified", "already_present_verified"} for entry in year_entries),
            "downloaded": sum(entry["status"] == "downloaded_verified" for entry in year_entries),
            "already_present_verified": sum(entry["status"] == "already_present_verified" for entry in year_entries),
            "failed": sum(entry["status"] == "failed" for entry in year_entries),
        }
        print(f"{year}: {manifest['year_summary'][str(year)]['successful']} / {len(year_entries)} verified")

    all_ok = all(summary["failed"] == 0 for summary in manifest["year_summary"].values())
    manifest["status"] = "complete" if all_ok else "partial_failure"
    manifest["completed_at_utc"] = datetime.now(timezone.utc).isoformat()
    save_manifest(manifest_path, manifest)
    total_ok = sum(summary["successful"] for summary in manifest["year_summary"].values())
    print(f"Verified {total_ok} / {len(manifest['files'])} fragments. Manifest: {manifest_path}")
    return 0 if all_ok else 2


if __name__ == "__main__":
    sys.exit(main())
