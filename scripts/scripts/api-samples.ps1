<#
API 測試樣本（PowerShell）

使用方式：
1) 在 PowerShell 執行：
   - $env:PUBLIC_APP_URL='http://localhost:3001'
   - .\scripts\api-samples.ps1

注意：此腳本會嘗試完整流程（健康檢查 → 乘客註冊/登入 → 司機註冊/登入 → 叫車 → 完成訂單）。
#>

param(
  [string]$BaseUrl = $env:PUBLIC_APP_URL
)

if (-not $BaseUrl) { $BaseUrl = 'http://localhost:3001' }
Write-Host "Base URL = $BaseUrl"

# Helpers
function Write-Json($label, $obj) {
  Write-Host "`n[$label]" -ForegroundColor Cyan
  $json = $obj | ConvertTo-Json -Depth 8
  Write-Output $json
}

$passengerPhone = $env:PASSENGER_PHONE
if (-not $passengerPhone) { $passengerPhone = '0987654001' }
if (-not $env:PASSENGER_NAME) { $env:PASSENGER_NAME = '乘客測試' }

$driverPhone = $env:DRIVER_PHONE
if (-not $driverPhone) { $driverPhone = '090000001' }
if (-not $env:DRIVER_NAME) { $env:DRIVER_NAME = '司機測試' }

try {
  # Health
  $health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method GET -ErrorAction Stop
  Write-Json 'Health' $health

  # Send OTP - Passenger
  $sendBodyP = @{ phone = $passengerPhone; role = 'passenger'; name = $env:PASSENGER_NAME } | ConvertTo-Json
  $sendResP = Invoke-RestMethod -Uri "$BaseUrl/auth/send-otp" -Method POST -ContentType 'application/json' -Body $sendBodyP -ErrorAction Stop
  Write-Json 'Passenger send-otp' $sendResP
  $pCode = $sendResP.verificationCode
  if (-not $pCode) { $pCode = $sendResP.code }

  # Verify - Passenger
  $verifyBodyP = @{ phone = $passengerPhone; verificationCode = $pCode } | ConvertTo-Json
  $verifyResP = Invoke-RestMethod -Uri "$BaseUrl/auth/verify-phone" -Method POST -ContentType 'application/json' -Body $verifyBodyP -ErrorAction Stop
  Write-Json 'Passenger verify-phone' $verifyResP

  # Login - Passenger
  $loginBodyP = @{ phone = $passengerPhone; role = 'passenger'; name = $env:PASSENGER_NAME } | ConvertTo-Json
  $loginResP = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $loginBodyP -ErrorAction Stop
  Write-Json 'Passenger login' $loginResP

  # Send OTP - Driver
  $sendBodyD = @{ phone = $driverPhone; role = 'driver'; name = $env:DRIVER_NAME } | ConvertTo-Json
  $sendResD = Invoke-RestMethod -Uri "$BaseUrl/auth/send-otp" -Method POST -ContentType 'application/json' -Body $sendBodyD -ErrorAction Stop
  Write-Json 'Driver send-otp' $sendResD
  $dCode = $sendResD.verificationCode
  if (-not $dCode) { $dCode = $sendResD.code }

  # Verify - Driver
  $verifyBodyD = @{ phone = $driverPhone; verificationCode = $dCode } | ConvertTo-Json
  $verifyResD = Invoke-RestMethod -Uri "$BaseUrl/auth/verify-phone" -Method POST -ContentType 'application/json' -Body $verifyBodyD -ErrorAction Stop
  Write-Json 'Driver verify-phone' $verifyResD

  # Login - Driver
  $loginBodyD = @{ phone = $driverPhone; role = 'driver'; name = $env:DRIVER_NAME } | ConvertTo-Json
  $loginResD = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $loginBodyD -ErrorAction Stop
  Write-Json 'Driver login' $loginResD

  # Request Ride
  $reqBody = @{ passengerPhone = $passengerPhone; pickup = @{ lat = 25.033964; lng = 121.564468 }; dropoff = @{ lat = 25.047759; lng = 121.531345 } } | ConvertTo-Json -Depth 5
  $reqRes = Invoke-RestMethod -Uri "$BaseUrl/ride/request" -Method POST -ContentType 'application/json' -Body $reqBody -ErrorAction Stop
  Write-Json 'ride/request' $reqRes
  $order = $reqRes.order
  if (-not $order -and $reqRes.data -and $reqRes.data.order) { $order = $reqRes.data.order }
  if (-not $order) { throw 'ride/request 未回傳 order' }

  # Choose driver phone for completion
  $driverPhoneForCompletion = $order.driverPhone
  if ($reqRes.driver -and $reqRes.driver.phone) { $driverPhoneForCompletion = $reqRes.driver.phone }
  if (-not $driverPhoneForCompletion) { $driverPhoneForCompletion = $driverPhone }
  Write-Host "Using driver phone for completion: $driverPhoneForCompletion" -ForegroundColor Yellow

  # Complete Ride
  $completeBody = @{ orderId = $order.id; driverPhone = $driverPhoneForCompletion } | ConvertTo-Json
  $completeRes = Invoke-RestMethod -Uri "$BaseUrl/ride/complete" -Method POST -ContentType 'application/json' -Body $completeBody -ErrorAction Stop
  Write-Json 'ride/complete' $completeRes

  Write-Host "`n✅ API 測試全部完成" -ForegroundColor Green
}
catch {
  Write-Host "`n❌ API 測試失敗: $_" -ForegroundColor Red
  exit 1
}