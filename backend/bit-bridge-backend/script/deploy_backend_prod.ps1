param(
  [switch]$SkipPendingCheck
)

$ErrorActionPreference = "Stop"

Write-Host "==> Backend production deploy: bitbridgeglobal"

$branch = (git branch --show-current).Trim()
if ($branch -ne "production") {
  throw "Deploy blocked: current branch is '$branch'. Switch to 'production' first."
}

Write-Host "==> Pending commits (heroku/main..production)"
$pending = git log --oneline heroku/main..production
if (-not $pending) {
  Write-Host "No pending commits to deploy."
  exit 0
}

Write-Host $pending

if (-not $SkipPendingCheck) {
  $confirm = Read-Host "Continue deploy to Heroku? Type YES to proceed"
  if ($confirm -ne "YES") {
    throw "Deploy cancelled by user."
  }
}

Write-Host "==> Deploying: git push heroku production:main"
git push heroku production:main

Write-Host "==> Latest releases"
heroku releases -a bitbridgeglobal -n 3

Write-Host "==> Done"
