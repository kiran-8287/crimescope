"""Verify current serving release."""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify CrimeScope serving release")
    parser.add_argument("--current", action="store_true", help="Verify current release")
    args = parser.parse_args(argv)

    print("Verify current serving release")
    print("Verify script not yet implemented.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
