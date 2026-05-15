# Issue Tracker: GitHub

This repository uses GitHub issues for tracking issues and product requirements documents. All operations use the `gh` CLI tool.

## Key Commands

**Creating issues**: Use `gh issue create --title "..." --body "..."` with heredocs for multi-line content.

**Viewing issues**: Run `gh issue view <number> --comments` to retrieve an issue with its comments and labels.

**Listing issues**: Filter open issues with `gh issue list --state open` plus JSON formatting to display numbers, titles, bodies, labels, and comments.

**Commenting**: Add responses via `gh issue comment <number> --body "..."`.

**Managing labels**: Apply or remove tags using `--add-label` or `--remove-label` flags with `gh issue edit`.

**Closing issues**: Use `gh issue close <number> --comment "..."`.

## Workflow Notes

The `gh` CLI automatically detects the repository from `git remote -v` output when run inside a cloned repo, so explicit repo specification isn't necessary.

When instructions reference "publishing to the issue tracker," create a GitHub issue. When they request "fetching the relevant ticket," execute `gh issue view <number> --comments`.
