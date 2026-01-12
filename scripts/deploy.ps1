param(
  [string]$Message = "chore: deploy",
  [string]$Branch = "main",
  [string]$Hook = $env:DEPLOY_HOOK_URL,
  [switch]$SkipBuild
)
$repo = Split-Path -Parent $PSCommandPath
Set-Location $repo
$changes = git status --porcelain
if ($changes) {
  git add -A
  git commit -m $Message
}
git push origin $Branch
if (-not $SkipBuild) {
  Push-Location (Join-Path $repo "scripts")
  npm ci
  npm run build
  Pop-Location
}
if ($env:VERCEL_TOKEN) {
  npx vercel link --project black_feather --scope feng-jias-projects --yes | Out-Null
  npx vercel build --yes --scope feng-jias-projects --token $env:VERCEL_TOKEN
  npx vercel deploy --prod --prebuilt --yes --scope feng-jias-projects --token $env:VERCEL_TOKEN
} elseif ($Hook) {
  try { Invoke-WebRequest -Uri $Hook -Method POST | Out-Null } catch { }
} else {
  Write-Host "Set VERCEL_TOKEN or DEPLOY_HOOK_URL"
  exit 1
}
