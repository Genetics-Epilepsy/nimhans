// ─────────────────────────────────────────────────────────────────────────────
// Thin data-access layer (Supabase or offline).
// Exposes window.DB.{init, isOnline, fetchPatients, savePatient,
//                    deletePatient, wipeAllPatients,
//                    fetchUsers, addUser, removeUser}
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const cfg = window.APP_CONFIG || {};
  const placeholder = !cfg.SUPABASE_URL ||
                      cfg.SUPABASE_URL.includes("YOUR-SUPABASE-URL") ||
                      !cfg.SUPABASE_ANON_KEY ||
                      cfg.SUPABASE_ANON_KEY.includes("YOUR-SUPABASE-ANON-KEY");

  let supa = null;
  if (!placeholder && window.supabase && window.supabase.createClient) {
    try {
      supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      console.info("[DB] Supabase client initialised.");
    } catch (e) {
      console.error("[DB] Failed to init Supabase:", e);
    }
  } else {
    console.warn("[DB] Running in OFFLINE mode (no Supabase config). Data is loaded from the bundled seed file.");
  }

  const TABLE_PATIENTS = "patient_variants";
  const TABLE_USERS    = "registry_users";

  // Top-level columns kept typed in Postgres for fast queries; everything else
  // is preserved in `ext` (JSONB) so the full 87-column template survives a
  // round-trip without schema migrations.
  const TYPED_KEYS = new Set([
    'id','category','name','age_enroll','sex','nnum','uhid',
    'gene','location','variant','zyg','disease','omim','inh',
    'classification','type_test','pretest','aao','sz_type','eeg','mri','consang'
  ]);

  function toRow(p){
    const row = {}, ext = {};
    Object.keys(p||{}).forEach(k=>{
      if(k === 'id' || k === 'created_at' || k === 'updated_at') { row[k] = p[k]; return; }
      if(TYPED_KEYS.has(k)) row[k] = p[k] == null ? null : String(p[k]);
      else if(p[k] != null && p[k] !== '') ext[k] = p[k];
    });
    if(Object.keys(ext).length) row.ext = ext;
    if(!row.name) row.name = p.name || '';
    return row;
  }
  function toObj(r){
    const o = Object.assign({}, r);
    if(o.ext && typeof o.ext === 'object'){ Object.assign(o, o.ext); delete o.ext; }
    return o;
  }

  async function fetchPatients() {
    if (!supa) return null;
    const { data, error } = await supa.from(TABLE_PATIENTS).select("*").order("id");
    if (error) { console.error(error); return null; }
    return data.map(toObj);
  }
  async function savePatient(p) {
    if (!supa) return false;
    const { error } = await supa.from(TABLE_PATIENTS).upsert(toRow(p), { onConflict: "id" });
    if (error) { console.error(error); return false; }
    return true;
  }
  async function deletePatient(id) {
    if (!supa) return false;
    const { error } = await supa.from(TABLE_PATIENTS).delete().eq("id", id);
    if (error) { console.error(error); return false; }
    return true;
  }
  async function wipeAllPatients() {
    if (!supa) return false;
    const { error } = await supa.from(TABLE_PATIENTS).delete().neq("id", 0);
    if (error) { console.error("[DB] wipe failed:", error); return false; }
    return true;
  }
  async function fetchUsers() {
    if (!supa) return null;
    const { data, error } = await supa.from(TABLE_USERS).select("*").order("id");
    if (error) { console.error(error); return null; }
    return data;
  }
  async function addUser(u) {
    if (!supa) return false;
    const { error } = await supa.from(TABLE_USERS).insert(u);
    if (error) { console.error(error); return false; }
    return true;
  }
  async function removeUser(id) {
    if (!supa) return false;
    const { error } = await supa.from(TABLE_USERS).delete().eq("id", id);
    if (error) { console.error(error); return false; }
    return true;
  }

  window.DB = {
    init: () => supa,
    isOnline: () => !!supa,
    fetchPatients, savePatient, deletePatient, wipeAllPatients,
    fetchUsers, addUser, removeUser
  };
})();
