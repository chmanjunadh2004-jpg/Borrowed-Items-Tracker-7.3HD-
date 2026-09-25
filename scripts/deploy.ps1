param(
    [ValidateSet('staging', 'production')]
    [string]$Target,

    [int]$Port
)

$ErrorActionPreference = 'Stop'

$base = Join-Path $env:ProgramData 'Jenkins\.jenkins\deployments\BorrowedItemsTracker'
$folder = Join-Path $base $Target
$pidFile = Join-Path $base "$Target.pid"
$package = Get-ChildItem $env:WORKSPACE -Filter 'borroweditemstracker-*.tgz' |
    Select-Object -First 1

if (-not $package) {
    throw 'Build package was not found.'
}

New-Item -ItemType Directory -Path $base -Force | Out-Null

# Stop the previous copy of this environment, if one is running.
if (Test-Path $pidFile) {
    $oldId = [int](Get-Content $pidFile)
    $oldProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $oldId"

    if ($oldProcess -and
        $oldProcess.Name -eq 'node.exe' -and
        $oldProcess.CommandLine -like "*$folder*") {
        Stop-Process -Id $oldId -Force
        Start-Sleep -Seconds 1
    }
}

# Install the package built by Jenkins into a separate folder.
if (Test-Path $folder) {
    Remove-Item $folder -Recurse -Force
}
New-Item -ItemType Directory -Path $folder -Force | Out-Null

& npm.cmd install --no-save --omit=dev --prefix $folder $package.FullName
if ($LASTEXITCODE -ne 0) {
    throw "Package installation failed for $Target."
}

$appFile = Join-Path $folder 'node_modules\borroweditemstracker\index.js'
if (-not (Test-Path $appFile)) {
    throw "Application file was not installed for $Target."
}

$env:PORT = [string]$Port
$env:DATA_FILE = Join-Path $base "$Target-items.json"
$env:NODE_ENV = 'production'
$env:JENKINS_NODE_COOKIE = 'dontKillMe'

$server = Start-Process -FilePath (Get-Command node.exe).Source `
    -ArgumentList ('"' + $appFile + '"') `
    -WorkingDirectory $folder `
    -RedirectStandardOutput (Join-Path $base "$Target-output.log") `
    -RedirectStandardError (Join-Path $base "$Target-error.log") `
    -PassThru

Set-Content -Path $pidFile -Value $server.Id

# Only pass the stage when this app responds successfully.
for ($attempt = 1; $attempt -le 10; $attempt++) {
    Start-Sleep -Seconds 1
    $server.Refresh()

    if ($server.HasExited) {
        throw "$Target application stopped unexpectedly."
    }

    try {
        $health = Invoke-RestMethod "http://localhost:$Port/health" -TimeoutSec 2
        if ($health.status -eq 'ok') {
            Write-Host "$Target is healthy at http://localhost:$Port"
            exit 0
        }
    }
    catch {
        # Give the app another moment to start.
    }
}

throw "$Target did not pass its health check on port $Port."