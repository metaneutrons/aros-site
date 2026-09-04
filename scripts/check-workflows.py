#!/usr/bin/env python3
"""Enforce immutable Actions and the site's credential boundary."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github/workflows"
PINNED_ACTION = re.compile(r"^[^/@\s]+/[^@\s]+@[0-9a-f]{40}$")
TRUSTED_ACTIONS = {
    "actions/checkout",
    "actions/download-artifact",
    "actions/setup-node",
    "actions/upload-artifact",
    "github/codeql-action/analyze",
    "github/codeql-action/init",
}


def fail(errors: list[str]) -> None:
    if not errors:
        return
    for error in errors:
        print(f"error: {error}")
    raise SystemExit(1)


def check_action_references(path: Path, text: str, errors: list[str]) -> None:
    lines = text.splitlines()
    for line_number, line in enumerate(lines, 1):
        match = re.match(r"^\s*-?\s*uses:\s*([^#]+?)\s*(?:#.*)?$", line)
        if match is None:
            continue
        reference = match.group(1).strip(" '\"")
        if reference.startswith("./"):
            continue
        if PINNED_ACTION.fullmatch(reference) is None:
            errors.append(f"{path}:{line_number}: action is not pinned: {reference}")
            continue
        action = reference.rsplit("@", 1)[0]
        if action not in TRUSTED_ACTIONS:
            errors.append(f"{path}:{line_number}: action is not trusted: {action}")
        if action == "actions/checkout":
            following = "\n".join(lines[line_number : line_number + 5])
            if "persist-credentials: false" not in following:
                errors.append(
                    f"{path}:{line_number}: checkout persists its credential"
                )


def main() -> None:
    errors: list[str] = []
    paths = sorted((*WORKFLOWS.glob("*.yml"), *WORKFLOWS.glob("*.yaml")))
    if not paths:
        errors.append("workflow directory contains no workflows")
    by_name: dict[str, str] = {}
    for path in paths:
        text = path.read_text(encoding="utf-8")
        by_name[path.name] = text
        check_action_references(path, text, errors)
        if "pull_request_target:" in text:
            errors.append(f"{path}: pull_request_target is forbidden")
        if "http://" in text:
            errors.append(f"{path}: insecure transport URL is forbidden")

    deploy = by_name.get("deploy.yml", "")
    ci = by_name.get("ci.yml", "")
    codeql = by_name.get("codeql.yml", "")
    if not all((deploy, ci, codeql)):
        errors.append("CI, deployment, and CodeQL workflows are all required")
    if deploy.count("secrets.CLOUDFLARE_API_TOKEN") != 1:
        errors.append("deployment must consume exactly one Cloudflare secret")
    if deploy.count("environment: site-publication") != 1:
        errors.append("deployment must enter site-publication exactly once")
    for marker in (
        "trap cleanup EXIT",
        "trap 'exit 130' HUP INT TERM",
        "unset CLOUDFLARE_API_TOKEN",
        "--proto '=https'",
        "--tlsv1.2",
        "https://aros.metaneutrons.cc/",
    ):
        if marker not in deploy:
            errors.append(f"deployment omits security marker: {marker}")
    for name, text in (("ci.yml", ci), ("codeql.yml", codeql)):
        if "secrets." in text or "environment:" in text:
            errors.append(f"{name} must remain credential-free")
    fail(errors)
    print(f"validated {len(paths)} immutable, credential-bounded workflows")


if __name__ == "__main__":
    main()
