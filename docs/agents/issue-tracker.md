# Issue Tracker: GitHub

Issues and PRDs for this repo live in GitHub Issues for `gilbertbrandow/woodpecker`. All operations use the `gh` CLI tool.

## Key Commands

**Creating issues**: Use `gh issue create --title "..." --body "..."` with heredocs for multi-line content.

**Viewing issues**: Run `gh issue view <number> --comments` to retrieve an issue with its comments and labels.

**Listing issues**: Filter with `gh issue list --state open --json number,title,labels,body` and add `--label <label>` to filter by triage state.

**Commenting**: Add responses via `gh issue comment <number> --body "..."`.

**Managing labels**: Apply or remove labels with `gh issue edit <number> --add-label <label>` / `--remove-label <label>`.

**Closing issues**: `gh issue close <number> --comment "..."`.

## Workflow Notes

The `gh` CLI detects the repository from `git remote -v` when run inside a clone — no explicit `--repo` flag needed.

When a skill says "publish to the issue tracker," create a GitHub issue. When a skill says "fetch the relevant ticket," run `gh issue view <number> --comments`.
