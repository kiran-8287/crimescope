"""Validate and publish a serving release."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Publish CrimeScope serving release")
    parser.add_argument("--config", required=True, help="Path to publication.yaml")
    args = parser.parse_args(argv)

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Config not found: {config_path}", file=sys.stderr)
        return 1
    print(f"Publish release from config: {config_path}")
    print("Publish script not yet implemented.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
