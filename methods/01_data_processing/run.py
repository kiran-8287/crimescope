"""Run 01 data processing method."""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run 01 data processing")
    parser.add_argument("--config", required=True, help="Path to config.yaml")
    args = parser.parse_args(argv)
    print(f"Run 01 data processing with config: {args.config}")
    print("Not yet implemented.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
