Param(
  [string]$ProjectRoot = "$(Resolve-Path .)",
  [string]$FunctionsDir = "$ProjectRoot/supabase/functions"
)

Write-Host "開始部署 Supabase Edge Functions..." -ForegroundColor Green

function Deploy-Function($name) {
  $funcPath = Join-Path $FunctionsDir $name
  if (-Not (Test-Path $funcPath)) {
    Write-Host "跳過：未找到函式 $name 在 $funcPath" -ForegroundColor Yellow
    return
  }
  Write-Host "部署函式：$name" -ForegroundColor Cyan
  supabase functions deploy $name --project-ref $Env:SUPABASE_REF
}

if (-Not $Env:SUPABASE_REF) {
  Write-Host "缺少 SUPABASE_REF 環境變數（專案 ref）。" -ForegroundColor Red
  exit 1
}

# 部署需要的函式（依照資料夾名稱，使用底線版）
Deploy-Function "assign_driver"
Deploy-Function "auto-dispatch"
Deploy-Function "cancel_ride"
Deploy-Function "finish_ride"
Deploy-Function "request_ride"
Deploy-Function "schedule_checker"
Deploy-Function "start_ride"
Deploy-Function "update_location"

Write-Host "Supabase Edge Functions 部署流程完成。" -ForegroundColor Green
