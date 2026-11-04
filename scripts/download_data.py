"""Download pinned source data tables into data/raw/."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Download CrimeScope source data")
    parser.add_argument("--config", required=True, help="Path to project.yaml")
    args = parser.parse_args(argv)

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Config not found: {config_path}", file=sys.stderr)
        return 1
    print(f"Download sources from config: {config_path}")
    print("No source URLs configured yet — populate config/sources.csv first.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
