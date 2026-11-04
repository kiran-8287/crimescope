"""Command-line entry point for CrimeScope analysis pipeline."""

from __future__ import annotations

import argparse
import sys
from typing import Optional


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="crimescope-build",
        description="CrimeScope analysis pipeline",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_ingest = sub.add_parser("ingest", help="Download/ingest raw source tables")
    p_ingest.add_argument("--config", required=True, help="Path to project.yaml")

    p_build = sub.add_parser("build-dataset", help="Build canonical dataset")
    p_build.add_argument("--config", required=True, help="Path to project.yaml")

    p_methods = sub.add_parser("run-methods", help="Run analytical methods")
    p_methods.add_argument("--profile", default="core", help="Method profile to run")

    p_publish = sub.add_parser("publish", help="Validate and publish a serving release")
    p_publish.add_argument("--config", required=True, help="Path to publication.yaml")

    p_verify = sub.add_parser("verify-release", help="Verify current serving release")
    p_verify.add_argument("--current", action="store_true", help="Verify current release")

    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "ingest":
        print(f"Ingest sources from config: {args.config}")
        return 0
    if args.command == "build-dataset":
        print(f"Build dataset from config: {args.config}")
        return 0
    if args.command == "run-methods":
        print(f"Run methods profile: {args.profile}")
        return 0
    if args.command == "publish":
        print(f"Publish release from config: {args.config}")
        return 0
    if args.command == "verify-release":
        print("Verify current serving release")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
