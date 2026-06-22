"""Publish decoy_positions.jsonl to HuggingFace as a dataset."""

import argparse
import os
import sys
from pathlib import Path

from huggingface_hub import HfApi, login
from huggingface_hub.errors import RepositoryNotFoundError


REPO_ID = "simongilbertbrandow/chess-decoy-positions"
REPO_TYPE = "dataset"


def main() -> None:
    p = argparse.ArgumentParser(description="Publish decoy_positions.jsonl to HuggingFace")
    p.add_argument("--file", required=True, type=Path, help="Path to decoy_positions.jsonl")
    p.add_argument("--repo", default=REPO_ID, help=f"HuggingFace repo (default: {REPO_ID})")
    args = p.parse_args()

    if not args.file.exists():
        sys.exit(f"File not found: {args.file}")

    login(token=os.environ.get("HF_TOKEN"))  # uses HF_TOKEN env var or stored credentials

    api = HfApi()

    try:
        api.repo_info(repo_id=args.repo, repo_type=REPO_TYPE)
    except RepositoryNotFoundError:
        print(f"Creating dataset repo {args.repo} ...")
        api.create_repo(repo_id=args.repo, repo_type=REPO_TYPE, private=False)

    size_mb = args.file.stat().st_size // 1_000_000
    print(f"Uploading {args.file} ({size_mb} MB) → {args.repo} ...")
    api.upload_file(
        path_or_fileobj=str(args.file),
        path_in_repo="decoy_positions.jsonl",
        repo_id=args.repo,
        repo_type=REPO_TYPE,
        commit_message=f"Update decoy positions ({size_mb} MB)",
    )
    print(f"Done. https://huggingface.co/datasets/{args.repo}")


if __name__ == "__main__":
    main()
