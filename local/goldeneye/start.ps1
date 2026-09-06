$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$goldeneyeListener = Get-NetTCPConnection -State Listen -LocalPort 8777 -ErrorAction SilentlyContinue
if (-not $goldeneyeListener) {
    Start-Process -FilePath 'python' -ArgumentList 'serve.py' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput 'server.log' -RedirectStandardError 'server-error.log'
    Start-Sleep -Seconds 2
}
Start-Process 'http://127.0.0.1:8777/'
