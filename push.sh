#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# One-shot helper to commit the v2 changes (full 87-column upload,
# bundled N1/N2/N3/N5 cohort, infographic dashboard) and push to GitHub.
#
# Usage:   ./push.sh <github-remote-url>
# Example: ./push.sh https://github.com/yourname/nimhans-epilepsy-registry.git
#
# (Run from the project root in Git Bash on Windows or any *nix shell.)
# ─────────────────────────────────────────────────────────────────────
set -e

REMOTE_URL="${1:-}"

if [[ ! -d .git ]]; then
  echo "→ Initialising local repo …"
  git init -b main
fi

# Make sure user.name / user.email are set (git refuses to commit without them)
if [[ -z "$(git config user.name 2>/dev/null)" ]]; then
  git config user.name  "NIMHANS Registry"
  git config user.email "registry@nimhans.ac.in"
fi

git add -A
git commit -m "v2: full 87-column upload, infographic dashboard, bundled N1/N2/N3/N5 cohort" || echo "(nothing to commit)"

if [[ -n "$REMOTE_URL" ]]; then
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REMOTE_URL"
  else
    git remote add origin "$REMOTE_URL"
  fi
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "→ Pushing to $(git remote get-url origin) …"
  git branch -M main
  git push -u origin main
else
  echo
  echo "✋  No git remote configured."
  echo "    Run again with the GitHub URL:"
  echo "        ./push.sh https://github.com/<you>/<repo>.git"
fi
