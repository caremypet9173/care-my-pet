param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Command
)

$ErrorActionPreference = "Stop"

$VercelDir = Join-Path $PSScriptRoot ".vercel"
$AuthDir = Join-Path $VercelDir "cli-auth"
$TokenFile = Join-Path $VercelDir "token"

if (-not (Test-Path -LiteralPath $AuthDir)) {
    New-Item -ItemType Directory -Force -Path $AuthDir | Out-Null
}

if ($Command.Count -eq 0) {
    Write-Host "CareMyPet Vercel CLI (izolowane konto projektu)"
    Write-Host "-----------------------------------------------"
    Write-Host "Konfiguracja sesji: $AuthDir (ignorowane przez Git)"
    Write-Host ""
    Write-Host "Pierwsza konfiguracja (konto caremypet9173@gmail.com):"
    Write-Host "  1) .\vercel-shell.ps1 login"
    Write-Host "     (albo zapisz Scoped Token z Vercel w .vercel\token)"
    Write-Host "  2) .\vercel-shell.ps1 link"
    Write-Host ""
    Write-Host "Przydatne komendy:"
    Write-Host "  .\vercel-shell.ps1 whoami"
    Write-Host "  .\vercel-shell.ps1 env ls"
    Write-Host "  .\vercel-shell.ps1 env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production"
    Write-Host "  .\vercel-shell.ps1 ls"
    Write-Host "  .\vercel-shell.ps1 logs care-my-pet-flax.vercel.app"
    exit 0
}

$ExtraArgs = @("--global-config", $AuthDir)

$Token = $null
if (Test-Path -LiteralPath $TokenFile) {
    $RawToken = (Get-Content -LiteralPath $TokenFile -Raw -ErrorAction SilentlyContinue)
    if ($null -ne $RawToken) {
        $Trimmed = $RawToken.Trim()
        if ($Trimmed.Length -gt 0) {
            $Token = $Trimmed
        }
    }
}

if ($null -ne $Token) {
    $ExtraArgs += @("--token", $Token)
}

$VercelBin = Get-Command vercel -ErrorAction SilentlyContinue

Push-Location $PSScriptRoot
try {
    if ($null -ne $VercelBin) {
        & $VercelBin.Source @ExtraArgs @Command
    }
    else {
        & npx --yes vercel @ExtraArgs @Command
    }

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
