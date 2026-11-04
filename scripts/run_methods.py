"""Run analytical methods in dependency order."""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run CrimeScope analytical methods")
    parser.add_argument("--profile", default="core", help="Method profile to run")
    args = parser.parse_args(argv)

    print(f"Run methods profile: {args.profile}")
    print("Method runner not yet implemented.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
