# BF 黑羽 - 重新啟動聊天伺服器（示例腳本）
# 請依實際部署方式調整（PM2 / Docker / Windows 服務等）

Write-Host "[BF黑羽] 嘗試重新啟動聊天伺服器..."

# 示例：若使用 PM2 管理 Node 服務
# pm2 restart chat-server

# 示例：若為 Docker Compose
# docker compose restart chat-server

Write-Host "[BF黑羽] 已執行重啟命令（請確認實際環境）。"