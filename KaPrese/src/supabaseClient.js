import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isValidUrl(value) {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl)
);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing or invalid Supabase env vars. Create a .env file (see .env.example) with " +
      "real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values from your Supabase project " +
      "(not the https://YOUR-PROJECT-REF.supabase.co placeholder), or set them in your host's dashboard."
  );
}

// IMPORTANT: createClient() throws immediately if given an invalid URL (e.g. the
// unfilled-in placeholder from .env.example). Since this file runs at module-load
// time, an uncaught throw here crashes the entire app before React ever renders —
// which looks like a blank white screen with no on-screen explanation, only a
// console error. Falling back to harmless placeholder values means createClient()
// always succeeds and the app always renders; every real database call will still
// fail until real credentials are set, and that failure is what surfaces the
// "Could not connect to the database" banners already built into the app.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder-anon-key"
);
