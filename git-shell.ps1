param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Command
)

$ErrorActionPreference = "Stop"

$ComposeFile = Join-Path $PSScriptRoot "docker-compose.git.yml"

if (-not (Test-Path $ComposeFile)) {
    Write-Error "Nie znaleziono pliku docker-compose.git.yml"
    exit 1
}

Push-Location $PSScriptRoot

try {
    if ($Command.Count -eq 0) {
        Write-Host "CareMyPet Git Environment"
        Write-Host "-------------------------"
        Write-Host "Repo: $PSScriptRoot"
        Write-Host ""

        docker compose -f $ComposeFile run --rm git
    }
    else {
        docker compose -f $ComposeFile run --rm git git @Command
    }

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}