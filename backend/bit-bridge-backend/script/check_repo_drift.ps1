param(
  [Parameter(Mandatory = $true)]
  [string]$CompareRoot,
  [string]$RepoRoot = (Get-Location).Path,
  [int]$SampleCount = 40
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-RelativePath {
  param([string]$PathValue)
  return $PathValue.Replace("/", "\")
}

function Get-RelativeFiles {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath
  )

  $fullRoot = (Resolve-Path $RootPath).Path
  $rgCmd = Get-Command rg -ErrorAction SilentlyContinue
  if ($null -ne $rgCmd) {
    Push-Location $fullRoot
    try {
      return @(rg --files | ForEach-Object { Normalize-RelativePath -PathValue $_ } | Sort-Object -Unique)
    }
    finally {
      Pop-Location
    }
  }

  $prefixLen = $fullRoot.Length + 1
  return @(Get-ChildItem -Path $fullRoot -Recurse -File |
    Where-Object { $_.FullName -notmatch '\\\.git\\' } |
    ForEach-Object { Normalize-RelativePath -PathValue $_.FullName.Substring($prefixLen) } |
    Sort-Object -Unique)
}

if (-not (Test-Path $CompareRoot -PathType Container)) {
  throw "CompareRoot does not exist or is not a directory: $CompareRoot"
}

if (-not (Test-Path $RepoRoot -PathType Container)) {
  throw "RepoRoot does not exist or is not a directory: $RepoRoot"
}

$compareRootFull = (Resolve-Path $CompareRoot).Path
$repoRootFull = (Resolve-Path $RepoRoot).Path

$compareFiles = Get-RelativeFiles -RootPath $compareRootFull
$repoFiles = Get-RelativeFiles -RootPath $repoRootFull

$comparison = Compare-Object -ReferenceObject $compareFiles -DifferenceObject $repoFiles -IncludeEqual
$overlap = @($comparison | Where-Object SideIndicator -eq "==" | Select-Object -ExpandProperty InputObject)
$onlyCompare = @($comparison | Where-Object SideIndicator -eq "<=" | Select-Object -ExpandProperty InputObject)
$onlyRepo = @($comparison | Where-Object SideIndicator -eq "=>" | Select-Object -ExpandProperty InputObject)

$sameContent = 0
$differentContent = 0
$differentFiles = [System.Collections.Generic.List[string]]::new()

foreach ($relPath in $overlap) {
  $comparePath = Join-Path $compareRootFull $relPath
  $repoPath = Join-Path $repoRootFull $relPath

  $compareHash = (Get-FileHash -Path $comparePath -Algorithm SHA256).Hash
  $repoHash = (Get-FileHash -Path $repoPath -Algorithm SHA256).Hash

  if ($compareHash -eq $repoHash) {
    $sameContent++
  }
  else {
    $differentContent++
    $differentFiles.Add($relPath)
  }
}

Write-Output "Compare root: $compareRootFull"
Write-Output "Repo root:    $repoRootFull"
Write-Output ""
Write-Output "COMPARE_TOTAL=$($compareFiles.Count)"
Write-Output "REPO_TOTAL=$($repoFiles.Count)"
Write-Output "OVERLAP_TOTAL=$($overlap.Count)"
Write-Output "ONLY_COMPARE_TOTAL=$($onlyCompare.Count)"
Write-Output "ONLY_REPO_TOTAL=$($onlyRepo.Count)"
Write-Output "IDENTICAL_CONTENT=$sameContent"
Write-Output "DIFFERENT_CONTENT=$differentContent"
Write-Output ""

Write-Output "--- ONLY_IN_COMPARE (sample) ---"
$onlyCompare | Select-Object -First $SampleCount | ForEach-Object { Write-Output $_ }
Write-Output ""

Write-Output "--- ONLY_IN_REPO (sample) ---"
$onlyRepo | Select-Object -First $SampleCount | ForEach-Object { Write-Output $_ }
Write-Output ""

Write-Output "--- SAME_PATH_DIFFERENT_CONTENT (sample) ---"
$differentFiles | Select-Object -First $SampleCount | ForEach-Object { Write-Output $_ }
