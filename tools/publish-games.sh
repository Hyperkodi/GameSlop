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
echo ""
echo "Verify once GitHub Pages has rebuilt (can take a minute or two):"
echo "  curl -sI https://hyperkodi.github.io/gameslop-games/_kit/shell.js   # expect: HTTP/2 200"
echo "  node tools/cdp-shot.js \"https://hyperkodi.github.io/gameslop-games/serpent/?debug=1\" \\"
echo "    1280 800 /tmp/serpent-live.png --script driver.js"
echo "  # driver.js: module.exports = async (cdp, evaluate) => evaluate(\"document.body.dataset.ready\");"
echo "  # expect the resolved value \"1\""
