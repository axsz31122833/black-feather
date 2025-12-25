$s = Get-Content -Path "src/pages/RegisterPage.jsx" -Raw

# 1) Add inviteCode state
if ($s -notmatch 'inviteCode\s*:') {
    $s = [regex]::Replace($s, 'useState\(\{([\s\S]*?)\}\)', {
        param($m)
        $body = $m.Groups[1].Value
        if ($body -match 'inviteCode\s*:') { return $m.Value }
        $inserted = $body.TrimEnd()
        return 'useState({' + "`n    " + $inserted + ',`n    inviteCode: ''\''\''`n  })'
    }, 1)
}

# 2) Add inviteCode validation before setLoading(true)
if ($s -notmatch '请输入邀请码') {
    $s = $s -replace 'setLoading\(true\);\s*try\s*\{', 'if (formData.role !== ''super_admin'' && !formData.inviteCode.trim()) { `n      toast({ title: ''注册失败'', description: ''请输入邀请码'', variant: ''destructive'' }); `n      return; `n    } `n    setLoading(true); `n    try {'
}

# 3) Add inviteCode to payload
if ($s -notmatch 'inviteCode:\s*formData\.inviteCode') {
    $s = $s -replace 'remarks:\s*formData\.remarks(\s*[,}])', 'remarks: formData.remarks,`n        inviteCode: formData.inviteCode$1'
}

# 4) Rename admin to super_admin in Tabs
$s = $s -replace 'TabsTrigger value=\"admin\"', 'TabsTrigger value=\"super_admin\"'
$s = $s -replace '<TabsContent value=\"admin\"', '<TabsContent value=\"super_admin\"'

# 5) Insert invite code input after TabsList
if ($s -notmatch 'placeholder=\"请输入邀请码') {
    $s = $s -replace '</TabsList>', '</TabsList>`n`n                    <div>`n                      <label class="text-sm font-medium">邀请码 *</label>`n                      <Input type="text" placeholder="请输入邀请码（推荐人手机号）" value={formData.inviteCode} onChange={(e) => handleInputChange(''inviteCode'', e.target.value)} className="bg-background/50" disabled={loading} />`n                    </div>'
}

Set-Content -Path "src/pages/RegisterPage.jsx" -Value $s -Encoding UTF8
Write-Host "RegisterPage.jsx patched: invitation code added."
