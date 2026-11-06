"""Tests for CrimeScope analysis pipeline."""

from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from crimescope_analysis.cleaning.canonical import (  # noqa: E402
    parse_table,
    clean_numeric,
    classify_region,
    stable_id,
    build_row_accounting,
)


def test_clean_numeric():
    assert clean_numeric("100") == (100, None)
    assert clean_numeric("") == (None, "not_reported")
    assert clean_numeric("NA") == (None, "not_reported")
    assert clean_numeric("1,234") == (1234, None)
    assert clean_numeric("abc") == (None, "unparseable:abc")


def test_classify_region():
    assert classify_region("Anantapur") == "administrative_district"
    assert classify_region("South Andaman") == "administrative_district"
    assert classify_region("Bengaluru Rural") == "administrative_district"
    assert classify_region("Total Districts") == "aggregate"
    # Railway
    assert classify_region("Guntakal Railway") == "railway"
    assert classify_region("GRP Raipur") == "railway"
    assert classify_region("SRP(Cuttack)") == "railway"
    # City police
    assert classify_region("Vijayawada City") == "city_police"
    assert classify_region("Ernakulam Commr") == "city_police"
    assert classify_region("Bhopal Commissionarate") == "city_police"
    assert classify_region("DCP BBSR") == "city_police"
    assert classify_region("CP Amritsar") == "city_police"
    # Other police units
    assert classify_region("Ahmedabad Rural") == "other_police_unit"
    assert classify_region("Cyber Ahmedabad Range") == "other_police_unit"
    assert classify_region("EOW") == "other_police_unit"
    assert classify_region("Spl Cell") == "other_police_unit"
    assert classify_region("STF") == "other_police_unit"
    assert classify_region("Baruipur Police") == "other_police_unit"
    assert classify_region("Sundarban Police") == "other_police_unit"


def test_stable_id():
    assert len(stable_id("a", "b")) == 24
    assert stable_id("a", "b") == stable_id("a", "b")


def test_parse_table_structure(tmp_path):
    csv_path = tmp_path / "test.csv"
    csv_path.write_text(
        "section,sl_no,State/UT/District,col_a|Murder (Sec.302 IPC),col_b|Rape (Sec.376 IPC)\n"
        ",1,2,\n"
        "State: Andhra Pradesh,1,Anantapur,107,68\n"
        "State: Andhra Pradesh,,Total Districts,956,112\n",
        encoding="utf-8",
    )

    observations = parse_table(csv_path, 2020, "test_source")
    assert len(observations) > 0

    # Check valid observations exist
    valid = [o for o in observations if o.quality_status == "valid"]
    assert len(valid) > 0

    # Check aggregate rows are quarantined
    aggregates = [o for o in observations if o.comparison_status == "aggregate_only"]
    assert len(aggregates) > 0


def test_build_row_accounting(tmp_path):
    csv_path = tmp_path / "test.csv"
    csv_path.write_text(
        "section,sl_no,State/UT/District,col_a|Murder (Sec.302 IPC)\n"
        ",1,2,\n"
        "State: Andhra Pradesh,1,Anantapur,107\n"
        "State: Andhra Pradesh,,Total Districts,956\n",
        encoding="utf-8",
    )

    observations = parse_table(csv_path, 2020, "test_source")
    accounting = build_row_accounting(csv_path, observations)

    assert accounting["source_rows"] >= 1
    assert accounting["canonical_observations"] >= 1
    assert accounting["eligible_for_comparison"] >= 1
    assert accounting["aggregate_rows"] >= 1
