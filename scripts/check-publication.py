#!/usr/bin/env python3
"""Validate the landing-page Worker boundary before deployment."""

from __future__ import annotations

import argparse
import datetime
import json
import re
import stat
from pathlib import Path


EXPECTED_CONFIGURATION = {
    "$schema": "./node_modules/wrangler/config-schema.json",
    "name": "aros-site",
    "account_id": "9122b44fa4c05b23985d6a0b779caa01",
    "compatibility_date": "2026-09-04",
    "workers_dev": False,
    "preview_urls": False,
    "routes": [
        {
            "pattern": "aros.metaneutrons.cc/*",
            "zone_name": "metaneutrons.cc",
        }
    ],
    "assets": {
        "directory": "./dist",
        "html_handling": "auto-trailing-slash",
        "not_found_handling": "404-page",
    },
}


def fail(message: str) -> None:
    raise SystemExit(f"error: {message}")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    return parser.parse_args()


def validate_configuration(path: Path) -> None:
    try:
        configuration = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail(f"cannot read strict JSON Worker configuration {path}: {error}")
    if configuration != EXPECTED_CONFIGURATION:
        fail("Worker configuration differs from the static landing-page contract")
    compatibility_date = configuration["compatibility_date"]
    if re.fullmatch(r"20\d{2}-\d{2}-\d{2}", compatibility_date) is None:
        fail("Worker compatibility_date is malformed")
    try:
        datetime.date.fromisoformat(compatibility_date)
    except ValueError:
        fail("Worker compatibility_date is not a calendar date")


def validate_assets(root: Path) -> None:
    try:
        root_status = root.lstat()
    except OSError as error:
        fail(f"cannot inspect landing-page output {root}: {error}")
    if not stat.S_ISDIR(root_status.st_mode) or root.is_symlink():
        fail(f"landing-page output is not a real directory: {root}")
    files = 0
    pending = [root]
    while pending:
        directory = pending.pop()
        for entry in directory.iterdir():
            status = entry.lstat()
            if entry.is_symlink():
                fail(f"landing-page output contains a symbolic link: {entry}")
            if stat.S_ISDIR(status.st_mode):
                pending.append(entry)
            elif stat.S_ISREG(status.st_mode):
                files += 1
            else:
                fail(f"landing-page output contains a non-regular entry: {entry}")
    if files == 0:
        fail("landing-page output is empty")
    print(f"validated {files} regular assets for the landing-page Worker")


def main() -> None:
    arguments = parse_arguments()
    try:
        validate_configuration(arguments.configuration)
        validate_assets(arguments.assets)
    except (OSError, UnicodeError) as error:
        fail(f"cannot validate landing-page publication contract: {error}")


if __name__ == "__main__":
    main()
