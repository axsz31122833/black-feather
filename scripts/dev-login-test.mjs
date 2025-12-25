import axios from "axios";

// 以環境變數 PUBLIC_APP_URL 覆蓋，否則預設 3002
const BASE_URL = process.env.PUBLIC_APP_URL || "http://localhost:3002";
const phone = process.env.TEST_PHONE || "0999000001";
const role = process.env.TEST_ROLE || "passenger";
const name = process.env.TEST_NAME || "測試用戶";

async function main() {
  console.log("Base URL:", BASE_URL);
  console.log("Phone:", phone, "Role:", role, "Name:", name);
  try {
    // send-otp
    const otpRes = await axios.post(`${BASE_URL}/auth/send-otp`, { phone, role, name });
    console.log("send-otp:", otpRes.data);
    if (!otpRes.data?.success) throw new Error(otpRes.data?.error?.message || "send-otp failed");
    const code = otpRes.data?.data?.devCode;
    if (!code) throw new Error("No devCode returned");

    // verify-phone
    const verifyRes = await axios.post(`${BASE_URL}/auth/verify-phone`, { phone, verificationCode: code });
    console.log("verify-phone:", verifyRes.data);
    if (!verifyRes.data?.success) throw new Error(verifyRes.data?.error?.message || "verify-phone failed");

    // login
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, { phone, role, name });
    console.log("login:", loginRes.data);
    if (!loginRes.data?.success) throw new Error(loginRes.data?.error?.message || "login failed");

    const userData = loginRes.data.data;
    console.log("Token:", userData.token ? userData.token.slice(0, 16) + "..." : null);
    console.log("User:", { userId: userData.userId, role: userData.role, name: userData.name });

    console.log("\n✅ E2E 開發登入流程通過：send-otp → verify → login");
  } catch (err) {
    console.error("❌ 測試失敗:", err.message);
    process.exitCode = 1;
  }
}

main();