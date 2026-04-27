// ─────────────────────────────────────────────────────────────────────────────
// NIMHANS — Genetics in Epilepsy Registry
// Front-end configuration. EDIT THE TWO VALUES BELOW after creating your
// Supabase project (Settings → API).
//
// 1. SUPABASE_URL    — e.g. "https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
// 2. SUPABASE_ANON_KEY — the public "anon" key. Safe to commit to a public
//    repo because Row-Level Security (RLS) on the database controls access.
//
// Leave them as the placeholder strings to run the app in OFFLINE / DEMO mode
// (data lives only in the current browser tab).
// ─────────────────────────────────────────────────────────────────────────────
window.APP_CONFIG = {
  SUPABASE_URL:     "YOUR-SUPABASE-URL",
  SUPABASE_ANON_KEY:"YOUR-SUPABASE-ANON-KEY",
  // When true, the app will fail loudly if Supabase is unreachable.
  // When false (default), it falls back to in-memory demo data.
  REQUIRE_SUPABASE: false
};
