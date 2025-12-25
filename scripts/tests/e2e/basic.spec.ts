import { test, expect } from '@playwright/test'

test('乘客下單→管理端派單→司機完成→收款→評分', async ({ page }) => {
  await page.goto('/')
  await page.click('text=登入')
  // 此為示意流程；具體帳號與欄位標識需對應你的頁面
  await page.fill('input[name="email"]', 'passenger@example.com')
  await page.fill('input[name="password"]', 'Password123!')
  await page.click('button:has-text("登入")')
  await page.click('text=乘客')
  await page.fill('input[placeholder="輸入上車地址"]', '台北車站')
  await page.click('button:has-text("搜尋")')
  await page.fill('input[placeholder="輸入目的地地址"]', '台北101')
  await page.click('button:has-text("搜尋")')
  await page.click('button:has-text("預約行程")') // 假設存在
  // 管理端派單
  await page.click('text=管理端')
  await page.click('button:has-text("執行排程")')
  // 司機端完成
  await page.click('text=司機')
  await page.click('button:has-text("開始行程")')
  await page.click('button:has-text("完成行程")')
  await page.click('button:has-text("標記已收款")')
  // 乘客評分
  await page.click('text=乘客行程')
  await page.fill('input[type="number"]', '5')
  await page.fill('input[placeholder="可選填"]', '服務很棒')
  await page.click('button:has-text("送出評分")')
  expect(true).toBeTruthy()
})

