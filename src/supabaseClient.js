import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createFallbackClient() {
  const chain = () => ({
    select: async () => { throw new Error('Supabase 未設定'); },
    insert: async () => { throw new Error('Supabase 未設定'); },
    update: async () => { throw new Error('Supabase 未設定'); },
    delete: async () => { throw new Error('Supabase 未設定'); },
    eq: () => chain(),
    in: () => chain(),
    order: () => chain(),
    single: async () => { throw new Error('Supabase 未設定'); },
    maybeSingle: async () => { throw new Error('Supabase 未設定'); }
  });
  const channelObj = {
    on: () => channelObj,
    subscribe: () => ({ unsubscribe() {} })
  };
  return {
    functions: {
      invoke: async () => { throw new Error('Supabase 未設定'); }
    },
    from: () => chain(),
    channel: () => channelObj,
    removeChannel: () => {}
  };
}

let supabase;
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabaseClient] 環境變數未設定，請提供 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY');
  supabase = createFallbackClient();
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
