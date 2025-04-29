#!/bin/bash

# Force Commit Script for MiCA EUR Project
# This script allows committing changes without running the pre-commit hooks,
# which is useful for initial setup or emergency fixes.

if [ $# -eq 0 ]
  then
    echo "Error: No commit message provided"
    echo "Usage: $0 \"your commit message\""
    exit 1
fi

COMMIT_MSG="$1"

# Check if there are staged changes
if [ -z "$(git diff --cached --name-only)" ]; then
  echo "No staged changes found. Use git add to stage files first."
  exit 1
fi

echo "WARNING: Bypassing pre-commit hooks for this commit!"
echo "Commit message: $COMMIT_MSG"
echo

# Give the user a chance to abort
read -p "Are you sure you want to proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Commit aborted."
    exit 1
fi

# Commit with the --no-verify flag to bypass pre-commit hooks
git commit --no-verify -m "$COMMIT_MSG"

echo
echo "Commit completed without pre-commit checks!"
echo "Please ensure your changes are properly tested." 