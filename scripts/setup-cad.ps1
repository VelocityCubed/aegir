$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskVenv = Join-Path $taskRoot '.venv'
if (-not (Test-Path -LiteralPath (Join-Path $taskVenv 'Scripts\python.exe'))) {
  python -m venv $taskVenv
  if ($LASTEXITCODE -ne 0) { throw 'Python 3.11+ is required to create the optional CAD runtime.' }
}
& (Join-Path $taskVenv 'Scripts\python.exe') -m pip install -r (Join-Path $taskRoot 'cad\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'CadQuery installation failed.' }
Write-Output 'CAD runtime ready. Restart WaveLab to enable direct STEP export.'
