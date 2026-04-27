// ─────────────────────────────────────────────────────────────────────────────
// NIMHANS — Genetics in Epilepsy Registry
// Application shell: login / page routing / patient CRUD / user mgmt.
// Dashboard charts → js/dashboard.js (window.DASH)
// Upload importer → js/upload.js   (window.UPLOAD)
// Excel template  → js/template.js (window.REGISTRY_TEMPLATE)
// Seed data       → js/seed.js     (window.REGISTRY_SEED)
// Logo            → js/logo.js     (window.LOGO_B64)
// ─────────────────────────────────────────────────────────────────────────────

const USERS = [
  {id:'admin', pw:'273070', name:'Administrator', role:'admin', email:'admin@nimhans.ac.in', protected:true}
];

// Master patient list — replaced from window.REGISTRY_SEED on load.
window.patients = [];
let loggedUser = null, editPatientId = null;

function bootSeed(){
  const seed = window.REGISTRY_SEED || [];
  // Wipe local & reseed from the four uploaded Excel files.
  window.patients = seed.map(r => ({ ...r }));
  console.info(`[App] Loaded ${window.patients.length} patient/variant rows from registry seed.`);
}

window.onload = async function(){
  // Logo
  const logoEl = document.getElementById('login-logo');
  if(logoEl) logoEl.src = window.LOGO_B64 || '';

  // Bootstrap from the bundled seed first (so the offline app works immediately).
  bootSeed();

  // If Supabase is reachable, prefer remote rows (multi-user sync).
  if (window.DB && window.DB.isOnline()) {
    try {
      const remote = await window.DB.fetchPatients();
      if (remote && remote.length) {
        window.patients = remote;
        console.info('[App] Replaced with remote rows:', remote.length);
      }
      const ru = await window.DB.fetchUsers();
      if (ru && ru.length) {
        const ids = new Set(USERS.map(u=>u.id));
        ru.forEach(u => { if(!ids.has(u.id)) USERS.push(u); });
      }
    } catch(e){ console.warn('[App] Supabase load failed:', e); }
  }
};

function doLogin(){
  const id = document.getElementById('login-id').value.trim();
  const pw = document.getElementById('login-pw').value;
  const user = USERS.find(u => u.id===id && u.pw===pw);
  if(user){
    loggedUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sb-name').textContent = user.name;
    document.getElementById('sb-role').textContent = user.role.charAt(0).toUpperCase()+user.role.slice(1);
    document.getElementById('sb-av').textContent = user.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    document.getElementById('sb-logo').src = window.LOGO_B64 || '';
    if(user.role !== 'admin') document.getElementById('nav-users').classList.add('hidden');
    refreshAll();
  } else {
    document.getElementById('login-err').classList.remove('hidden');
  }
}
document.addEventListener('keydown', e => {
  if(e.key === 'Enter'){
    const lg = document.getElementById('login-screen');
    if(lg && !lg.classList.contains('hidden')) doLogin();
  }
});

function doLogout(){
  loggedUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-id').value = '';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-err').classList.add('hidden');
}

function showPage(name, navEl){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('page-'+name);
  if(target) target.classList.add('active');
  if(navEl) navEl.classList.add('active');
  // Re-render dashboard whenever it becomes visible (charts need a live DOM)
  if(name === 'dashboard' && window.DASH) window.DASH.render(window.patients);
}

function refreshAll(){
  if(window.DASH) window.DASH.render(window.patients);
  filterPatients();
  filterVariants();
  renderUsers();
}
window.refreshAll = refreshAll;

/* ───────── Patient registry ───────── */
function renderPatients(list){
  const tbody = document.getElementById('pt-body'); if(!tbody) return;
  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">No matching patients.</td></tr>`;
    const cnt = document.getElementById('pt-count');
    if(cnt) cnt.textContent = 0;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${window.catBadge ? window.catBadge(p.category) : (p.category||'—')}</td>
      <td><b>${esc(p.name)}</b></td>
      <td>${esc(p.nnum||'—')}</td>
      <td>${esc(p.uhid||'—')}</td>
      <td>${esc(p.age_enroll||'—')}</td>
      <td>${esc(p.sex||'—')}</td>
      <td style="font-family:monospace;font-size:12px">${esc(window.shortGene?window.shortGene(p.gene):(p.gene||'—'))}</td>
      <td><span class="${window.classColor?window.classColor(p.classification):''}">${esc(p.classification||'—')}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-view" onclick="viewPatient(${p.id})">View</button>
        <button class="btn btn-sm btn-edit" onclick="editPatient(${p.id})">Edit</button>
        ${loggedUser && loggedUser.role==='admin' ? `<button class="btn btn-sm btn-del" onclick="deletePatient(${p.id})">Del</button>` : ''}
      </td>
    </tr>`).join('');
  const cnt = document.getElementById('pt-count');
  if(cnt) cnt.textContent = list.length;
}

function filterPatients(){
  const q = ((document.getElementById('pt-search')||{}).value||'').toLowerCase();
  const cat = (document.getElementById('pt-cat-filter')||{}).value || '';
  const sex = (document.getElementById('pt-sex-filter')||{}).value || '';
  const cls = (document.getElementById('pt-class-filter')||{}).value || '';
  renderPatients(window.patients.filter(p =>
    (!q || (p.name||'').toLowerCase().includes(q) || (p.nnum||'').toLowerCase().includes(q) || (p.uhid||'').toLowerCase().includes(q) || (p.gene||'').toLowerCase().includes(q)) &&
    (!cat || p.category===cat) &&
    (!sex || p.sex===sex) &&
    (!cls || p.classification===cls)
  ));
}
window.filterPatients = filterPatients;

function viewPatient(id){
  const p = window.patients.find(x => x.id===id); if(!p) return;
  const same = window.patients.filter(x =>
    (p.uhid && x.uhid===p.uhid) || (p.nnum && x.nnum===p.nnum) || (x.name===p.name)
  );
  document.getElementById('modal-name').textContent = p.name || '—';
  document.getElementById('modal-sub').textContent =
    `N Num: ${p.nnum||'—'} · UHID: ${p.uhid||'—'} · Age: ${p.age_enroll||'—'} · ${p.sex||'—'} · ${p.category||'—'}`;

  function section(title, rows){
    const items = rows.filter(([_,v]) => v != null && v !== '').map(([l,v]) =>
      `<div class="detail-item"><label>${esc(l)}</label><span>${v}</span></div>`).join('');
    if(!items) return '';
    return `<div class="section-title">${title}</div><div class="detail-grid">${items}</div>`;
  }

  let body = '';
  body += section('🧾 Demographics', [
    ['Category', p.category], ['Age at enrollment', p.age_enroll],
    ['Age at genetic test', p.age_gentest], ['Sex', p.sex],
    ['Contact', p.contact], ['Unit', p.unit], ['Place', p.place]
  ]);
  body += section('🧬 Genetic finding', [
    ['Test type', p.type_test], ['Variant detected', p.var_detected],
    ['Gene (transcript)', p.gene], ['Location', p.location], ['Variant', p.variant],
    ['Zygosity', p.zyg], ['Disease', p.disease], ['OMIM', p.omim],
    ['Inheritance', p.inh],
    ['ACMG class', p.classification ? `<span class="${window.classColor?window.classColor(p.classification):''}">${esc(p.classification)}</span>` : ''],
    ['Basis of classification', p.class_basis], ['Type of variant', p.var_type],
    ['Type of variation', p.var_variation], ['MAF', p.maf],
    ['Prediction deleterious', p.pred_del], ['Tools', p.tools],
    ['Conserved', p.conserved], ['Functional studies', p.func_studies],
    ['Functional studies desc', p.func_studies_desc],
    ['Pretest diagnosis', p.pretest], ['Genotype-phenotype match', p.gp_match],
    ['Impact of dx', p.impact_dx], ['Modification', p.modification],
    ['Follow-up after mod', p.fu_after_mod]
  ]);
  body += section('🏥 Clinical profile', [
    ['Age at onset', p.aao], ['Seizure type', p.sz_type],
    ['Seizure freq', p.sz_freq], ['Trigger', p.trigger],
    ['Development', p.dev1], ['Cognition', p.cog],
    ['Cog desc / IQ', p.cog_desc], ['Neuro comorbidities', p.neuro_comorb],
    ['Psychiatric / behaviour', p.psych], ['Systemic comorb', p.sys_comorb],
    ['Dysmorphism', p.dysmorph], ['# AED', p.drug_num], ['Drugs', p.drug_types],
    ['Sz outcome', p.sz_outcome], ['Description', p.description],
    ['Dev trend', p.dev2], ['Duration of f/u', p.fudur]
  ]);
  body += section('🧠 Investigations', [
    ['EEG', p.eeg], ['VEEG done', p.veeg_done], ['VEEG II', p.veeg_ii],
    ['VEEG semiology', p.veeg_sem], ['VEEG ictal', p.veeg_ictal],
    ['MEG', p.meg], ['MRI', p.mri], ['PET', p.pet],
    ['Lactate', p.lactate], ['Ammonia', p.ammonia],
    ['TMS', p.tms], ['Urine metabolites', p.urine_metab],
    ['Routine blood', p.blood], ['Others', p.others]
  ]);
  body += section('👪 Family', [
    ['Consanguinity', p.consang], ['Degree', p.consang_deg],
    ['Family history', p.family_hx], ['Suspected mode of inh', p.susp_inh],
    ['Affected family members', p.aff_fam], ['Pedigree', p.pedigree],
    ['Father tested', p.father_tested], ['Father report', p.father_report],
    ['Mother tested', p.mother_tested], ['Mother report', p.mother_report]
  ]);
  body += section('🧬 Mitochondrial', [
    ['Done', p.mito], ['Abnormality detected', p.mito_abn],
    ['Mito gene', p.mito_gene], ['Ensembl', p.mito_ensembl],
    ['Zygosity', p.mito_zyg], ['cDNA', p.mito_cdna],
    ['Amino acid', p.mito_aa],
    ['Type of variation', p.mito_var_type], ['Type of variation 2', p.mito_var_type2],
    ['Classification', p.mito_class], ['Disease association', p.mito_disease]
  ]);
  if(p.remarks) body += section('📝 Remarks', [['Remarks', p.remarks]]);

  if(same.length > 1){
    body += `<div class="section-title">🔄 Multiple variants (${same.length} entries for this patient)</div>`;
    same.forEach(s => {
      body += `<div class="multi-var-row">
        <b style="color:var(--nim-gold)">${esc(window.shortGene?window.shortGene(s.gene):(s.gene||'—'))}</b>
        <span style="color:var(--nim-muted)"> · </span>${esc(s.variant||'—')}
        <span style="color:var(--nim-muted)"> · </span>
        <span class="${window.classColor?window.classColor(s.classification):''}">${esc(s.classification||'—')}</span>
        <span style="color:var(--nim-muted)"> · </span>${esc(s.disease||'—')}
      </div>`;
    });
  }

  document.getElementById('modal-body').innerHTML = body || '<div class="empty">No structured data on this record.</div>';
  document.getElementById('pt-modal').classList.remove('hidden');
}
window.viewPatient = viewPatient;

function editPatient(id){
  editPatientId = id;
  const p = window.patients.find(x => x.id===id); if(!p) return;
  document.getElementById('add-modal-title').textContent = 'Edit Patient Record';
  const fields = {
    'f-category':p.category,'f-name':p.name,'f-age-enroll':p.age_enroll,'f-age-gen':p.age_gentest,
    'f-nnum':p.nnum,'f-uhid':p.uhid,'f-contact':p.contact,'f-unit':p.unit,'f-place':p.place,
    'f-aao':p.aao,'f-sztype':p.sz_type,'f-szfreq':p.sz_freq,'f-trigger':p.trigger,
    'f-eeg':p.eeg,'f-mri':p.mri,'f-gene':p.gene,'f-loc':p.location,'f-variant':p.variant,
    'f-disease':p.disease,'f-omim':p.omim,'f-pretest':p.pretest
  };
  const selects = {
    'f-sex':p.sex,'f-zyg':p.zyg,'f-inh':p.inh,'f-class':p.classification,
    'f-testtype':p.type_test,'f-consang':p.consang,'f-cog':p.cog
  };
  Object.entries(fields).forEach(([k,v]) => { const e=document.getElementById(k); if(e) e.value = v||''; });
  Object.entries(selects).forEach(([k,v]) => { const e=document.getElementById(k); if(e&&v) e.value = v; });
  switchTabTo(0);
  document.getElementById('add-modal').classList.remove('hidden');
}
window.editPatient = editPatient;

function deletePatient(id){
  if(!confirm('Delete this patient record? This cannot be undone.')) return;
  window.patients = window.patients.filter(p => p.id !== id);
  if(window.DB && window.DB.isOnline()) window.DB.deletePatient(id);
  refreshAll();
}
window.deletePatient = deletePatient;

function openAddPatient(){
  editPatientId = null;
  document.getElementById('add-modal-title').textContent = 'Add Patient Record';
  document.querySelectorAll('#add-modal input, #add-modal select').forEach(el => {
    if(el.tagName === 'SELECT') { if(el.options.length) el.selectedIndex = 0; }
    else el.value = '';
  });
  switchTabTo(0);
  document.getElementById('add-modal').classList.remove('hidden');
}
window.openAddPatient = openAddPatient;

function savePatient(){
  const name = (document.getElementById('f-name').value||'').trim();
  if(!name){ alert('Patient name is required.'); return; }
  function val(id){ const e=document.getElementById(id); return e?e.value:''; }
  const rec = {
    id: editPatientId || (Date.now() + Math.floor(Math.random()*1000)),
    category: val('f-category'), name,
    age_enroll: val('f-age-enroll'), age_gentest: val('f-age-gen'),
    sex: val('f-sex'), nnum: val('f-nnum'), uhid: val('f-uhid'),
    contact: val('f-contact'), unit: val('f-unit'), place: val('f-place'),
    aao: val('f-aao'), sz_type: val('f-sztype'), sz_freq: val('f-szfreq'),
    trigger: val('f-trigger'), eeg: val('f-eeg'), mri: val('f-mri'),
    gene: val('f-gene'), location: val('f-loc'), variant: val('f-variant'),
    zyg: val('f-zyg'), disease: val('f-disease'), omim: val('f-omim'),
    inh: val('f-inh'), classification: val('f-class'),
    type_test: val('f-testtype'), pretest: val('f-pretest'),
    consang: val('f-consang'), cog: val('f-cog')
  };
  if(editPatientId){
    const idx = window.patients.findIndex(p => p.id===editPatientId);
    if(idx >= 0){
      // preserve any extra fields that aren't in the form
      window.patients[idx] = { ...window.patients[idx], ...rec };
    }
  } else {
    window.patients.push(rec);
  }
  if(window.DB && window.DB.isOnline()) window.DB.savePatient(rec);
  closeModal('add-modal');
  refreshAll();
}
window.savePatient = savePatient;

/* ───────── Variants page ───────── */
function renderVariants(list){
  const tbody = document.getElementById('var-body'); if(!tbody) return;
  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="17" class="empty-row">No variants — try clearing filters.</td></tr>`;
    const c = document.getElementById('var-count');
    if(c) c.textContent = 0;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${window.catBadge ? window.catBadge(p.category) : (p.category||'—')}</td>
      <td>${esc(p.name)}</td>
      <td>${esc(p.nnum||'—')}</td>
      <td>${esc(p.uhid||'—')}</td>
      <td>${esc(p.age_enroll||'—')}</td>
      <td>${esc(p.sex||'—')}</td>
      <td style="font-family:monospace;font-size:12px">${esc(p.gene||'—')}</td>
      <td style="font-size:12px">${esc(p.location||'—')}</td>
      <td style="font-family:monospace;font-size:12px">${esc(p.variant||'—')}</td>
      <td>${esc(p.zyg||'—')}</td>
      <td><span class="${window.classColor?window.classColor(p.classification):''}">${esc(p.classification||'—')}</span></td>
      <td>${esc(p.disease||'—')}</td>
      <td style="font-size:12px">${esc(p.omim||'—')}</td>
      <td>${esc(p.inh||'—')}</td>
      <td>${esc(p.type_test||'—')}</td>
      <td style="font-size:12px">${esc(p.aao||'—')}</td>
      <td style="font-size:12px">${esc(p.sz_type||'—')}</td>
    </tr>`).join('');
  const c = document.getElementById('var-count');
  if(c) c.textContent = list.length;
}

function filterVariants(){
  const q = ((document.getElementById('var-search')||{}).value||'').toLowerCase();
  const cat = (document.getElementById('var-cat-filter')||{}).value || '';
  const cls = (document.getElementById('var-class-filter')||{}).value || '';
  const tst = (document.getElementById('var-test-filter')||{}).value || '';
  renderVariants(window.patients.filter(p =>
    (!q || (p.name||'').toLowerCase().includes(q) ||
           (p.nnum||'').toLowerCase().includes(q) ||
           (p.gene||'').toLowerCase().includes(q) ||
           (p.variant||'').toLowerCase().includes(q) ||
           (p.disease||'').toLowerCase().includes(q)) &&
    (!cat || p.category===cat) &&
    (!cls || p.classification===cls) &&
    (!tst || p.type_test===tst)
  ));
}
window.filterVariants = filterVariants;

function exportVariantsCSV(){
  const cols = ['category','name','nnum','uhid','age_enroll','sex','gene','location','variant','zyg','classification','disease','omim','inh','type_test','aao','sz_type'];
  const head = cols.join(',');
  const body = window.patients.map(p => cols.map(c => {
    const v = p[c]==null ? '' : String(p[c]).replace(/"/g,'""');
    return /[",\n]/.test(v) ? '"'+v+'"' : v;
  }).join(',')).join('\n');
  const blob = new Blob([head+'\n'+body], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'nimhans_variants.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
window.exportVariantsCSV = exportVariantsCSV;

/* ───────── Users ───────── */
function renderUsers(){
  const list = document.getElementById('user-list'); if(!list) return;
  list.innerHTML = USERS.map(u => `
    <div class="user-card">
      <div class="user-av" style="width:40px;height:40px;font-size:14px">${u.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--nim-text)">${esc(u.name)}</div>
        <div style="font-size:12px;color:var(--nim-muted)">${esc(u.id)} · ${esc(u.email||'—')}</div>
      </div>
      <span class="role-badge rb-${u.role}">${u.role}</span>
      ${!u.protected && loggedUser && loggedUser.role==='admin'
        ? `<button class="btn btn-sm btn-del" onclick="removeUser('${u.id}')">Remove</button>`
        : '<span style="color:var(--nim-muted);font-size:11px">🔒 protected</span>'}
    </div>`).join('');
}

function showAddUser(){ document.getElementById('user-modal').classList.remove('hidden'); }
window.showAddUser = showAddUser;

function addUser(){
  const name=document.getElementById('u-name').value.trim();
  const id=document.getElementById('u-id').value.trim();
  const pw=document.getElementById('u-pw').value;
  const role=document.getElementById('u-role').value;
  const email=document.getElementById('u-email').value.trim();
  if(!name||!id||!pw){ alert('Name, User ID and password are required.'); return; }
  if(USERS.find(u=>u.id===id)){ alert('User ID already exists.'); return; }
  const _newU = {id,pw,name,role,email,protected:false};
  USERS.push(_newU);
  if(window.DB && window.DB.isOnline()) window.DB.addUser(_newU);
  closeModal('user-modal'); renderUsers();
  ['u-name','u-id','u-pw','u-email'].forEach(x => document.getElementById(x).value = '');
}
window.addUser = addUser;

function removeUser(id){
  if(!confirm('Remove this user?')) return;
  const i = USERS.findIndex(u=>u.id===id);
  if(i>=0) USERS.splice(i,1);
  if(window.DB && window.DB.isOnline()) window.DB.removeUser(id);
  renderUsers();
}
window.removeUser = removeUser;

/* ───────── Modal / tabs ───────── */
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }
window.closeModal = closeModal;

function switchTab(n, el){
  switchTabTo(n);
  document.querySelectorAll('#add-modal .tab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
}
function switchTabTo(n){
  document.querySelectorAll('.tab-pane').forEach((p,i) => p.classList.toggle('active', i===n));
  document.querySelectorAll('#add-modal .tab').forEach((t,i) => t.classList.toggle('active', i===n));
}
window.switchTab = switchTab;
window.switchTabTo = switchTabTo;

/* ───────── Wrappers exposed to inline onclick handlers in index.html ───────── */
window.showPage = showPage;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.handleFiles = (files)=> window.UPLOAD && window.UPLOAD.handleFiles(files);
window.handleDrop  = (e)=>     window.UPLOAD && window.UPLOAD.handleDrop(e);
window.startExtraction = ()=>  window.UPLOAD && window.UPLOAD.startExtraction();
window.cancelExtracted = ()=>  window.UPLOAD && window.UPLOAD.cancelExtracted();
window.saveExtracted   = ()=>  window.UPLOAD && window.UPLOAD.saveExtracted();
window.downloadTemplate= ()=>  window.UPLOAD && window.UPLOAD.downloadTemplate();
window.wipeAndReloadSeed=()=>  window.UPLOAD && window.UPLOAD.wipeAndReloadSeed();

/* ───────── Helpers ───────── */
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
window.esc = esc;
