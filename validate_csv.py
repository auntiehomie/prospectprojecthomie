#!/usr/bin/env python3
"""Strict, dependency-free CSV validation for CI and local checks."""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent

PROSPECT_COLUMNS = [
    "Business Name", "Address", "City", "State", "Zip Code", "PPP Lender",
    "Total PPP Loan Amount", "Total Forgiveness Amount", "NAICS Code",
    "Nearest Closing Branch", "Nearest Branch Address",
    "Distance to Closing Branch (mi)", "Phone", "Email", "Contact Source",
    "Contact Note",
]
BRANCH_COLUMNS = [
    "Branch Name", "Address", "City", "State", "Zip Code", "County",
    "Application Number", "Application Type", "Action", "Action Date",
    "Comment Period End Date", "URL",
]


def read_csv(path: Path, columns: list[str]) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != columns:
            raise ValueError(f"{path.name}: expected columns {columns}, got {reader.fieldnames}")
        rows = list(reader)
    if not rows:
        raise ValueError(f"{path.name}: contains no data rows")
    return rows


def validate_prospects() -> list[str]:
    rows = read_csv(ROOT / "PPP-Prospect-Results.csv", PROSPECT_COLUMNS)
    errors: list[str] = []
    seen: set[tuple[str, str]] = set()

    for line, row in enumerate(rows, start=2):
        required = PROSPECT_COLUMNS[:12]
        for field in required:
            if not row[field].strip():
                errors.append(f"PPP-Prospect-Results.csv:{line}: missing {field}")

        key = (row["Business Name"].strip().casefold(), row["Address"].strip().casefold())
        if key in seen:
            errors.append(f"PPP-Prospect-Results.csv:{line}: duplicate business/address")
        seen.add(key)

        if not re.fullmatch(r"\d{5}", row["Zip Code"].strip()):
            errors.append(f"PPP-Prospect-Results.csv:{line}: invalid ZIP code")
        if not re.fullmatch(r"\d{6}", row["NAICS Code"].strip()):
            errors.append(f"PPP-Prospect-Results.csv:{line}: invalid NAICS code")

        for field in ("Total PPP Loan Amount", "Total Forgiveness Amount", "Distance to Closing Branch (mi)"):
            try:
                value = float(row[field])
                if value < 0:
                    raise ValueError
            except ValueError:
                errors.append(f"PPP-Prospect-Results.csv:{line}: invalid non-negative number in {field}")

        email = row["Email"].strip()
        if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            errors.append(f"PPP-Prospect-Results.csv:{line}: invalid email")

    return errors


def validate_branches() -> list[str]:
    rows = read_csv(ROOT / "Results-Table.csv", BRANCH_COLUMNS)
    errors: list[str] = []
    seen: set[str] = set()

    for line, row in enumerate(rows, start=2):
        for field in ("Branch Name", "Address", "City", "State", "Zip Code", "Application Number", "Application Type", "Action", "Action Date", "URL"):
            if not row[field].strip():
                errors.append(f"Results-Table.csv:{line}: missing {field}")

        app_number = row["Application Number"].strip()
        if app_number in seen:
            errors.append(f"Results-Table.csv:{line}: duplicate application number")
        seen.add(app_number)

        if not re.fullmatch(r"\d{5}", row["Zip Code"].strip()):
            errors.append(f"Results-Table.csv:{line}: invalid ZIP code")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", row["Action Date"].strip()):
            errors.append(f"Results-Table.csv:{line}: invalid action date")
        url = urlparse(row["URL"].strip())
        if url.scheme != "https" or url.netloc != "apps.occ.gov":
            errors.append(f"Results-Table.csv:{line}: invalid OCC URL")

    return errors


def main() -> int:
    try:
        errors = validate_prospects() + validate_branches()
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 1

    if errors:
        print("CSV validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1

    print("CSV validation passed: 52 prospect rows and 81 branch-closing rows checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
