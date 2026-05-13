# Installer for the OpenCode fork CLI on Windows.
#
# Usage (one-liner):
#   iwr -useb https://github.com/alexyaroshuk/opencode/releases/latest/download/install-fork.ps1 | iex
#
# Behavior:
#   - Downloads opencode-fork-windows-x64.zip from the latest fork release
#     (override with -Version 'vX.Y.Z' to pin a release).
#   - Extracts to $env:LOCALAPPDATA\opencode-fork (override with -InstallDir).
#   - Adds the install dir to the user PATH if missing.
#   - Leaves upstream `opencode` untouched. Run the fork as `opencode-fork`.

[CmdletBinding()]
param(
    [string]$Repo = "alexyaroshuk/opencode",
    [string]$Version = "latest",
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "opencode-fork")
)

$ErrorActionPreference = "Stop"

$asset = "opencode-fork-windows-x64.zip"
$base = "https://github.com/$Repo/releases"
$url = if ($Version -eq "latest") {
    "$base/latest/download/$asset"
} else {
    "$base/download/$Version/$asset"
}

Write-Host "Installing opencode-fork from $url"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$tmp = Join-Path $env:TEMP "opencode-fork-$([guid]::NewGuid()).zip"
try {
    Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing

    # Wipe the install dir contents (keep the directory itself in case it is on PATH).
    Get-ChildItem -Path $InstallDir -Force | Remove-Item -Recurse -Force -ErrorAction Stop

    Expand-Archive -Path $tmp -DestinationPath $InstallDir -Force
} finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

$exe = Join-Path $InstallDir "opencode-fork.exe"
if (-not (Test-Path $exe)) {
    throw "Install failed: $exe not found after extraction."
}

# Prepend InstallDir to the user PATH if not already present.
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$parts = if ($userPath) { $userPath.Split(";") } else { @() }
if ($parts -notcontains $InstallDir) {
    $newPath = if ($userPath) { "$InstallDir;$userPath" } else { $InstallDir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Added $InstallDir to user PATH. Open a new shell to pick it up."
} else {
    Write-Host "$InstallDir already on user PATH."
}

Write-Host "Installed: $exe"
Write-Host "Run: opencode-fork --version"
