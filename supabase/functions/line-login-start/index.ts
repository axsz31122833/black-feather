// Supabase Edge Function: line-login-start
// 產生 LINE 授權 URL 並回傳前端導向

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { redirectUri } = await req.json().catch(() => ({ redirectUri: undefined }));

    const lineChannelId = Deno.env.get('LINE_CHANNEL_ID');
    const defaultRedirect = Deno.env.get('LINE_REDIRECT_URI');
    const finalRedirect = redirectUri || defaultRedirect;

    if (!lineChannelId) {
      throw new Error('缺少 LINE_CHANNEL_ID 環境變數');
    }
    if (!finalRedirect) {
      throw new Error('缺少 redirectUri，請於請求 body 或 LINE_REDIRECT_URI 提供');
    }

    // 產生隨機 state 與 nonce
    const randomString = (len = 32) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const array = new Uint8Array(len);
      crypto.getRandomValues(array);
      return Array.from(array).map((x) => chars[x % chars.length]).join('');
    };

    const state = randomString(32);
    const nonce = randomString(32);

    const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', lineChannelId);
    authorizeUrl.searchParams.set('redirect_uri', finalRedirect);
    authorizeUrl.searchParams.set('scope', 'openid profile');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);
    authorizeUrl.searchParams.set('prompt', 'consent');

    return new Response(JSON.stringify({ success: true, url: authorizeUrl.toString(), state }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('line-login-start 錯誤:', error);
    return new Response(JSON.stringify({ success: false, error: { message: (error as any).message } }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});