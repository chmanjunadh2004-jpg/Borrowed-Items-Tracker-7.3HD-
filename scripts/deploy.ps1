param(
    [ValidateSet('staging', 'production')]
    [string]$Target,

    [int]$Port
)

$ErrorActionPreference = 'Stop'

$base = Join-Path $env:ProgramData 'Jenkins\.jenkins\deployments\BorrowedItemsTracker'
$folder = Join-Path $base $Target
$appFile = Join-Path $folder 'node_modules\borroweditemstracker\index.js'
$dataFile = Join-Path $base "$Target-items.json"
$logFile = Join-Path $base "$Target-output.log"
$runnerFile = Join-Path $base "$Target-run.cmd"

New-Item -ItemType Directory -Path $base -Force | Out-Null

$package = Get-ChildItem -Path $env:WORKSPACE -Filter 'borroweditemstracker-*.tgz' |
    Select-Object -First 1

if (-not $package) {
    throw "No application package was found in the Jenkins workspace."
}

# Stop the previous copy of this app if it is using this port.
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($listener) {
    $oldProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"

    if (-not $oldProcess -or $oldProcess.CommandLine -notlike "*$appFile*") {
        throw "Port $Port is being used by another program. Deployment stopped safely."
    }

    Stop-Process -Id $listener.OwningProcess -Force
    Start-Sleep -Seconds 2
}

if (Test-Path $folder) {
    Remove-Item -Path $folder -Recurse -Force
}

New-Item -ItemType Directory -Path $folder -Force | Out-Null

& npm.cmd install --no-save --omit=dev --prefix $folder $package.FullName

if ($LASTEXITCODE -ne 0) {
    throw "Installing the application failed."
}

if (-not (Test-Path $appFile)) {
    throw "The application file was not found after installation."
}

$runnerLines = @(
    '@echo off'
    "set `"PORT=$Port`""
    "set `"DATA_FILE=$dataFile`""
    'set "NODE_ENV=production"'
    'set "JENKINS_NODE_COOKIE=dontKillMe"'
    "cd /d `"$folder`""
    "node.exe `"$appFile`" >> `"$logFile`" 2>&1"
)

Set-Content -Path $runnerFile -Value $runnerLines -Encoding ASCII

& cscript.exe //NoLogo (Join-Path $PSScriptRoot 'start-detached.js') $runnerFile

if ($LASTEXITCODE -ne 0) {
    throw "Starting the application failed."
}

for ($attempt = 1; $attempt -le 15; $attempt++) {
    Start-Sleep -Seconds 1

    try {
        $health = Invoke-RestMethod "http://localhost:$Port/health" -TimeoutSec 2

        if ($health.status -eq 'ok') {
            $newListener = Get-NetTCPConnection -LocalPort $Port -State Listen |
                Select-Object -First 1

            $newProcess = Get-CimInstance Win32_Process `
                -Filter "ProcessId = $($newListener.OwningProcess)"

            if ($newProcess.CommandLine -notlike "*$appFile*") {
                throw "Another program answered the health check."
            }

            Write-Host "$Target is healthy at http://localhost:$Port"
            exit 0
        }
    }
    catch {
        # Give the application another second to start.
    }
}

throw "$Target did not start correctly. Check $logFile"