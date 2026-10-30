param([switch]$RegisterCodex, [string]$ServerPath, [string]$CodexPath = 'codex')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (-not $ServerPath) {
    $packagedServer = Join-Path $projectRoot 'release\win-unpacked\resources\mcp\server.mjs'
    $ServerPath = if (Test-Path -LiteralPath $packagedServer) { $packagedServer } else { Join-Path $projectRoot 'mcp\server.mjs' }
}
$ServerPath = (Resolve-Path -LiteralPath $ServerPath).Path
$nodePath = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
if ($RegisterCodex) {
    & $CodexPath mcp add aegir -- $nodePath $ServerPath
    if ($LASTEXITCODE -ne 0) { throw 'Codex MCP registration failed.' }
    & $CodexPath mcp get aegir --json
    if ($LASTEXITCODE -ne 0) { throw 'Codex MCP configuration verification failed.' }
}
@{mcpServers = @{aegir = @{command = $nodePath; args = @($ServerPath)}}} | ConvertTo-Json -Depth 5
