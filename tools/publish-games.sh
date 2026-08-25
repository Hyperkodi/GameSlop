#!/usr/bin/env bash
# Publish games/ to the public mirror that GitHub Pages serves.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
REMOTE="${1:-https://github.com/Hyperkodi/gameslop-games.git}"
git branch -D games-mirror >/dev/null 2>&1 || true
git subtree split --prefix games -b games-mirror
git push -f "$REMOTE" games-mirror:main
git branch -D games-mirror
echo "published to $REMOTE (Pages: https://hyperkodi.github.io/gameslop-games/)"
