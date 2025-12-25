$s = Get-Content -Path "src/pages/RegisterPage.jsx" -Raw
# Replace literal backtick-n with real newlines
$s = [regex]::Replace($s, "\x60n", [System.Environment]::NewLine)
Set-Content -Path "src/pages/RegisterPage.jsx" -Value $s -Encoding UTF8
Write-Host "Normalized `n sequences to real newlines."
