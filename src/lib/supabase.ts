import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly and early rather than letting every query throw a cryptic
  // "Invalid URL" error deep inside supabase-js.
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to " +
      ".env and fill in your Supabase project credentials.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Supabase issues a real signed JWT (access_token) on sign in and stores
    // it (plus a refresh_token) in localStorage under this key. Every
    // supabase-js call automatically attaches it as `Authorization: Bearer
    // <jwt>`, and Postgres RLS policies read the caller's identity out of
    // that JWT via auth.uid(). Refresh happens transparently.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "expense-splitter-auth",
  },
});
