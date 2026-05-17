#!/usr/bin/env python3
"""
Queries AWS Cost Explorer for all completed months from 2026-04 onward,
then adds any missing rows to the cost table in deploy/README.md.

Usage:
    python deploy/scripts/aws-cost-report.py [path/to/README.md]

The script is idempotent: existing rows are never modified or duplicated.
Requires AWS credentials with ce:GetCostAndUsage permission.
"""
import re
import sys
from datetime import date

import boto3  # type: ignore[import-not-found, import-untyped]

EARLIEST_MONTH = date(2026, 4, 1)
README_PATH = sys.argv[1] if len(sys.argv) > 1 else "deploy/README.md"

TABLE_HEADER = "| Month | Total (USD) | EC2 | Route 53 | S3 | CloudWatch | Other | SEK paid | Notes |"

SERVICE_MAP = {
    "Amazon Elastic Compute Cloud - Compute": "EC2",
    "EC2 - Other": "EC2",
    "Amazon Route 53": "Route 53",
    "Amazon Simple Storage Service": "S3",
    "Amazon CloudWatch": "CloudWatch",
}


def completed_months():
    today = date.today()
    last_year = today.year if today.month > 1 else today.year - 1
    last_month = today.month - 1 if today.month > 1 else 12

    months = []
    y, m = EARLIEST_MONTH.year, EARLIEST_MONTH.month
    while (y, m) <= (last_year, last_month):
        months.append((y, m))
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return months


def query_month(year, month):
    start = f"{year:04d}-{month:02d}-01"
    next_month = month + 1 if month < 12 else 1
    next_year = year if month < 12 else year + 1
    end = f"{next_year:04d}-{next_month:02d}-01"

    client = boto3.client("ce", region_name="us-east-1")
    response = client.get_cost_and_usage(
        TimePeriod={"Start": start, "End": end},
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    costs = {}
    for group in response["ResultsByTime"][0]["Groups"]:
        service = group["Keys"][0]
        amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
        if amount > 0.005:
            costs[service] = amount
    return costs


def bucket(costs):
    ec2 = route53 = s3 = cloudwatch = other = 0.0
    for service, amount in costs.items():
        col = SERVICE_MAP.get(service)
        if col == "EC2":
            ec2 += amount
        elif col == "Route 53":
            route53 += amount
        elif col == "S3":
            s3 += amount
        elif col == "CloudWatch":
            cloudwatch += amount
        else:
            other += amount
    total = ec2 + route53 + s3 + cloudwatch + other
    return total, ec2, route53, s3, cloudwatch, other


def fmt(value):
    return f"${value:.2f}" if value >= 0.01 else "—"


def build_row(year, month, total, ec2, route53, s3, cloudwatch, other):
    return (
        f"| {year:04d}-{month:02d} "
        f"| {fmt(total)} "
        f"| {fmt(ec2)} "
        f"| {fmt(route53)} "
        f"| {fmt(s3)} "
        f"| {fmt(cloudwatch)} "
        f"| {fmt(other)} "
        f"| | |"
    )


def existing_months(content):
    found = set()
    for line in content.splitlines():
        m = re.match(r"\|\s*(\d{4}-\d{2})\s*\|", line)
        if m:
            found.add(m.group(1))
    return found


def append_rows(content, new_rows):
    lines = content.splitlines(keepends=True)

    header_idx = next(
        (i for i, line in enumerate(lines) if TABLE_HEADER in line), None
    )
    if header_idx is None:
        raise ValueError(f"Cost table header not found in {README_PATH}")

    # Walk past the separator and any existing data rows to find insertion point.
    insert_at = header_idx + 2
    for i in range(header_idx + 2, len(lines)):
        if lines[i].strip().startswith("|"):
            insert_at = i + 1
        else:
            break

    new_lines = [row + "\n" for row in new_rows]
    lines = lines[:insert_at] + new_lines + lines[insert_at:]
    return "".join(lines)


def main():
    with open(README_PATH) as f:
        content = f.read()

    already_present = existing_months(content)
    months = completed_months()

    new_rows = []
    for year, month in months:
        if f"{year:04d}-{month:02d}" in already_present:
            continue
        print(f"Fetching {year:04d}-{month:02d}...")
        costs = query_month(year, month)
        total, ec2, route53, s3, cloudwatch, other = bucket(costs)
        new_rows.append(build_row(year, month, total, ec2, route53, s3, cloudwatch, other))

    if not new_rows:
        print("No missing months — README is up to date.")
        return

    updated = append_rows(content, new_rows)
    with open(README_PATH, "w") as f:
        f.write(updated)

    added = [r.split("|")[1].strip() for r in new_rows]
    print(f"Added {len(new_rows)} row(s): {', '.join(added)}")


if __name__ == "__main__":
    main()
