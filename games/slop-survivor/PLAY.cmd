@echo off
cd /d "%~dp0"
echo Slop Survivor - The Serpent Siege
echo Open http://localhost:8193 after the server starts.
echo Keep this window open while playing. Ctrl+C stops this game's server.
node server.mjs
pause
