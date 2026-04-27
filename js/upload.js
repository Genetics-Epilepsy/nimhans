// ─────────────────────────────────────────────────────────────────────────────
// Upload Patient Records — template-driven importer.
//
//   • Parses .xlsx files row-by-row using REGISTRY_TEMPLATE
//   • Skips sheets named "Missing"
//   • Provides PDF / Word fallback (AI-extraction stub)
//   • Stages parsed rows in `extractedBuffer`, lets the user preview before save
//   • Save → updates the global `patients` array, re-renders dashboard, and
//     pushes to Supabase if configured.
// ─────────────────────────────────────────────────────────────────────────────
(function () {

  let uploadedFiles = [];
  let extractedBuffer = [];

  function el(id){ return document.getElementById(id); }

  function escHtml(s){
    return String(s==null?'':s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  }

  // -------- Drop zone wiring --------
  function handleFiles(files){
    uploadedFiles = [...files];
    renderFileList();
  }
  function handleDrop(e){
    e.preventDefault();
    const dz = el('drop-zone'); if(dz) dz.classList.remove('drag');
    handleFiles(e.dataTransfer.files);
  }
  function removeFile(i){ uploadedFiles.splice(i,1); renderFileList(); }

  function renderFileList(){
    const list = el('file-list');
    const wrap = el('extract-btn-wrap');
    if(!list) return;
    if(!uploadedFiles.length){ list.innerHTML=''; if(wrap) wrap.classList.add('hidden'); return; }
    if(wrap) wrap.classList.remove('hidden');
    list.innerHTML = uploadedFiles.map((f,i)=>{
      const ext = (f.name.split('.').pop()||'').toLowerCase();
      const icon = ext==='xlsx'||ext==='xls'?'📊':(ext==='pdf'?'📄':(ext==='docx'||ext==='doc'?'📝':'📁'));
      return `<div class="file-item">
        <span style="font-size:22px">${icon}</span>
        <div style="flex:1">
          <div class="file-name">${escHtml(f.name)}</div>
          <div class="file-size">${(f.size/1024).toFixed(1)} KB · ${ext.toUpperCase()}</div>
          <div class="progress-bar"><div class="progress-fill" id="pf-${i}" style="width:0"></div></div>
        </div>
        <button onclick="UPLOAD.removeFile(${i})" class="btn-x" title="Remove">✕</button>
      </div>`;
    }).join('');
  }

  function setProgress(i, pct){
    const e = el('pf-'+i); if(e) e.style.width = pct+'%';
  }

  // -------- Excel parsing --------
  function readXlsx(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result);
          const wb = XLSX.read(data, {type:'array', cellDates:false});
          resolve(wb);
        } catch (e) { reject(e); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  async function startExtraction(){
    if(!uploadedFiles.length) return;
    extractedBuffer = [];
    let overrideCat = (el('upload-category')||{}).value || '';
    for(let i=0; i<uploadedFiles.length; i++){
      const f = uploadedFiles[i];
      const ext = (f.name.split('.').pop()||'').toLowerCase();
      try {
        if(ext === 'xlsx' || ext === 'xls'){
          // animate
          for(let p=0;p<=100;p+=20){ setProgress(i,p); await new Promise(r=>setTimeout(r,30)); }
          const wb = await readXlsx(f);
          const records = window.REGISTRY_TEMPLATE.workbookToRecords(wb, overrideCat);
          if(overrideCat) records.forEach(r=>r.category = overrideCat);
          // assign provisional IDs (negative ints so they don't clash with seed IDs)
          records.forEach((r, idx) => { r.id = -1 * (Date.now() + extractedBuffer.length + idx); });
          extractedBuffer.push(...records);
          setProgress(i,100);
        } else {
          // PDF / DOCX — placeholder: we don't run real AI here, but preview a stub
          for(let p=0;p<=100;p+=10){ setProgress(i,p); await new Promise(r=>setTimeout(r,30)); }
          extractedBuffer.push({
            id: -1*(Date.now()+i), category: overrideCat||'', name:'(extracted from '+f.name+')',
            note:'PDF/Word extraction stub — review and edit before saving'
          });
        }
      } catch(e){
        console.error(e);
        toast('Failed to parse '+f.name, true);
      }
    }
    showExtracted();
  }

  function showExtracted(){
    const wrap = el('extraction-results');
    const tbody = el('ext-body');
    const title = el('ext-title');
    const sub = el('ext-sub');
    if(!tbody) return;
    if(!extractedBuffer.length){ tbody.innerHTML = `<tr><td colspan="11" class="empty-row">No rows parsed.</td></tr>`; }
    else {
      tbody.innerHTML = extractedBuffer.map(r=>`
        <tr>
          <td>${escHtml(r.category||'—')}</td>
          <td><b>${escHtml(r.name||'—')}</b></td>
          <td style="font-size:12px">${escHtml(r.nnum||'—')}</td>
          <td style="font-size:12px">${escHtml(r.uhid||'—')}</td>
          <td>${escHtml(r.sex||'—')}</td>
          <td style="font-family:monospace;font-size:12px">${escHtml(window.shortGene?window.shortGene(r.gene):(r.gene||'—'))}</td>
          <td style="font-family:monospace;font-size:11px">${escHtml((r.variant||'').slice(0,30))}</td>
          <td><span class="${window.classColor?window.classColor(r.classification):''}">${escHtml(r.classification||'—')}</span></td>
          <td>${escHtml(r.disease||'—')}</td>
          <td><span class="badge badge-pos">✓ Ready</span></td>
        </tr>`).join('');
    }
    if(title) title.textContent = `${extractedBuffer.length} record${extractedBuffer.length===1?'':'s'} parsed from ${uploadedFiles.length} file${uploadedFiles.length===1?'':'s'}`;
    if(sub) sub.textContent = 'Review the data below and click "Save to Registry" to commit.';
    if(wrap) wrap.classList.remove('hidden');
  }

  function cancelExtracted(){
    extractedBuffer = [];
    const wrap = el('extraction-results');
    if(wrap) wrap.classList.add('hidden');
  }

  function saveExtracted(){
    if(!extractedBuffer.length){ toast('Nothing to save'); return; }
    // Optional category override
    const overrideCat = (el('upload-category')||{}).value || '';
    let added = 0, replaced = 0;
    extractedBuffer.forEach(r => {
      if(overrideCat) r.category = overrideCat;
      // Generate stable ID
      r.id = Date.now() + Math.floor(Math.random()*100000) + added;
      // Replace if same nnum + variant exists
      const dup = window.patients.findIndex(x =>
        x.nnum && r.nnum && x.nnum === r.nnum &&
        ((x.variant||'') === (r.variant||'') || (x.gene||'')===(r.gene||''))
      );
      if(dup >= 0){ window.patients[dup] = r; replaced++; }
      else { window.patients.push(r); added++; }
      if(window.DB && window.DB.isOnline()) window.DB.savePatient(r);
    });
    toast(`Saved: ${added} added · ${replaced} replaced`, false);
    extractedBuffer = []; uploadedFiles = [];
    renderFileList();
    const wrap = el('extraction-results');
    if(wrap) wrap.classList.add('hidden');
    if(typeof window.refreshAll === 'function') window.refreshAll();
  }

  // -------- Wipe & reload --------
  async function wipeAndReloadSeed(){
    if(!confirm('Wipe all patient records and reload the bundled seed (370 rows from N1/N2/N3/N5)?\n\nThis cannot be undone.')) return;
    // Local
    window.patients = (window.REGISTRY_SEED||[]).map(r => ({...r}));
    // Remote (best-effort)
    if(window.DB && window.DB.isOnline()){
      const ok = await window.DB.wipeAllPatients();
      if(ok) for(const r of window.patients){ await window.DB.savePatient(r); }
    }
    toast(`Reloaded ${window.patients.length} records`, false);
    if(typeof window.refreshAll === 'function') window.refreshAll();
  }

  function downloadTemplate(){
    if(typeof XLSX === 'undefined'){ toast('Excel library not loaded yet', true); return; }
    const wb = window.REGISTRY_TEMPLATE.buildTemplateWorkbook();
    XLSX.writeFile(wb, 'NIMHANS_Registry_Template.xlsx');
  }

  function toast(msg, isErr){
    let t = document.querySelector('.toast');
    if(!t){
      t = document.createElement('div'); t.className='toast'; document.body.appendChild(t);
    }
    t.classList.toggle('error', !!isErr);
    t.classList.toggle('success', !isErr);
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>t.classList.remove('show'), 2200);
  }

  window.UPLOAD = {
    handleFiles, handleDrop, removeFile,
    startExtraction, cancelExtracted, saveExtracted,
    wipeAndReloadSeed, downloadTemplate, toast
  };

})();
