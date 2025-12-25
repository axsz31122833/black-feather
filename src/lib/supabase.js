// Minimal stub for Supabase client to allow build without actual Supabase configuration.
// If you later provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and install '@supabase/supabase-js',
// you can replace this stub with a real client creation.

export const supabase = {
  functions: {
    invoke: async () => {
      throw new Error('Supabase ???');
    },
  },
};

export default supabase;