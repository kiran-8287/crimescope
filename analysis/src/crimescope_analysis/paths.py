"""Canonical path configuration for CrimeScope analysis pipeline."""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]

DATA_RAW = REPO_ROOT / "data" / "raw"
DATA_EXTERNAL = REPO_ROOT / "data" / "external"
DATA_MAPPINGS = REPO_ROOT / "data" / "mappings"
DATA_INTERIM = REPO_ROOT / "data" / "interim"
DATA_PROCESSED = REPO_ROOT / "data" / "processed"
DATA_SERVING = REPO_ROOT / "data" / "serving"
DATA_SERVING_RELEASES = DATA_SERVING / "releases"
DATA_CURRENT_JSON = DATA_SERVING / "current.json"

CONFIG_DIR = REPO_ROOT / "config"
PROJECT_YAML = CONFIG_DIR / "project.yaml"
COHORTS_YAML = CONFIG_DIR / "cohorts.yaml"
FEATURES_YAML = CONFIG_DIR / "features.yaml"
PUBLICATION_YAML = CONFIG_DIR / "publication.yaml"
SOURCES_CSV = CONFIG_DIR / "sources.csv"

SCRIPTS_DIR = REPO_ROOT / "scripts"

METHODS_DIR = REPO_ROOT / "methods"

PROGRESS_DIR = REPO_ROOT / "progress"
