// ─────────────────────────────────────────────────────────────────────────────
// Canonical Excel template for the registry.
// 87 columns — exactly matching the headers used in the N1/N2/N3/N5 data files.
// Provides:
//   • TEMPLATE_COLS  – ordered list of header titles (printed as-is in the .xlsx)
//   • COL_MAP        – header → patient-record key
//   • CODE_MAPS      – numeric codes used in the spreadsheet → human label
//   • parseRow(row, header)   – convert one Excel row into a normalised record
//   • buildTemplateWorkbook() – returns a SheetJS workbook for Download Template
//   • workbookToRecords(wb)   – ingest one uploaded .xlsx into normalised rows
// ─────────────────────────────────────────────────────────────────────────────
(function () {

  const TEMPLATE_COLS = [
    'Category', 'Name', 'Age at enrollment', 'Age at genetic test', 'Sex',
    'N num', 'UHID', 'Contact No', 'Unit', 'Place',
    'AAO (Age at Onset)', 'Sz Type', 'Sz Freq', 'Trigger',
    'Dev (1=Nl, 2=delayed, 3=Regression)', 'Cognition (1=Normal, 2=Abnormal)',
    'Cog Desc MMSE/IQ', 'Neurol comorb', 'Psychiatric/behavioural',
    'Systemic comorb', 'Dysmorph', 'Drugs Num', 'Drugs Types',
    'Lactate', 'Ammonia', 'TMS', 'Abnl metabolite Urine', 'Routine blood', 'Others',
    'EEG', 'VEEG Done (1=Yes, 0=No)', 'VEEG II', 'VEEG Sem', 'VEEG Ictal',
    'MEG', 'MRI', 'PET',
    'Duration of f/u', 'Sz outcome (1=Remission, 2=Persistent, 3=Worsening)',
    'Description', 'Dev (1=Stable, 2=Improved, 3=Declined)',
    'Consang (Y=1, N=0)', 'Degree', 'Family h/o', 'Suspected mode of Inh',
    'Aff family members', 'Pedigree (Y/N)',
    'Type of Gen Test', 'variant Detected (1/0)',
    'Gene', 'Location', 'Variant', 'ZYGOSITY (1-4)',
    'Disease', 'OMIM', 'INHERITANCE (1-4)', 'CLASSIFICATION (1-5)',
    'Basis of Classification', 'TYPE OF VAR (1-6)', 'TYPE OF VARIATION (1-2)',
    'Minor allele freq', 'Prediction deleterious (Y/N)', 'Tools',
    'Conserved (Y/N)', 'Functional Studies (Y/N)', 'Functional Studies description',
    'Pretest diagnosis', 'Genotype Phenotype match (Y/N)',
    'Impact of gen diagnosis (Y/N)', 'Modification', 'Follow up after modification',
    'Father tested (0/1)', 'Father report (0-3)',
    'Mother tested (0/1)', 'Mother report (0-2)',
    'MITOCHONDRIAL (0-1)', 'ABNORMALITY DETECTED (0/1)',
    'mito gene', 'Ensembl', 'ZYGOSITY (1-2)', 'CDNA', 'AMINOACID',
    'TYPE OF VARIATION (1-5)', 'TYPE OF VARIATION (1-2)2',
    'CLASSIFICATION (1-5)3', 'DISEASE ASSOCIATION', 'Remarks'
  ];

  // header (lowercase, trimmed) → record key
  const COL_MAP = {
    'category':'category','name':'name','age at enrollment':'age_enroll',
    'age at genetic test':'age_gentest','sex':'sex','n num':'nnum','uhid':'uhid',
    'contact no':'contact','unit':'unit','place':'place',
    'aao (age at onset)':'aao','sz type':'sz_type','sz freq':'sz_freq','trigger':'trigger',
    'dev (1=nl, 2=delayed, 3=regression)':'dev1',
    'cognition (1=normal, 2=abnormal)':'cog','cog desc mmse/iq':'cog_desc',
    'neurol comorb':'neuro_comorb','psychiatric/behavioural':'psych',
    'systemic comorb':'sys_comorb','dysmorph':'dysmorph',
    'drugs num':'drug_num','drugs types':'drug_types',
    'lactate':'lactate','ammonia':'ammonia','tms':'tms',
    'abnl metabolite urine':'urine_metab','routine blood':'blood','others':'others',
    'eeg':'eeg','veeg done (1=yes, 0=no)':'veeg_done',
    'veeg ii':'veeg_ii','veeg sem':'veeg_sem','veeg ictal':'veeg_ictal',
    'meg':'meg','mri':'mri','pet':'pet',
    'duration of f/u':'fudur',
    'sz outcome (1=remission, 2=persistent, 3=worsening)':'sz_outcome',
    'description':'description','dev (1=stable, 2=improved, 3=declined)':'dev2',
    'consang (y=1, n=0)':'consang','degree':'consang_deg',
    'family h/o':'family_hx','suspected mode of inh':'susp_inh',
    'aff family members':'aff_fam','pedigree (y/n)':'pedigree',
    'type of gen test':'type_test','variant detected (1/0)':'var_detected',
    'gene':'gene','location':'location','variant':'variant',
    'zygosity (1-4)':'zyg','disease':'disease','omim':'omim',
    'inheritance (1-4)':'inh','classification (1-5)':'classification',
    'basis of classification':'class_basis',
    'type of var (1-6)':'var_type','type of variation (1-2)':'var_variation',
    'minor allele freq':'maf','prediction deleterious (y/n)':'pred_del',
    'tools':'tools','conserved (y/n)':'conserved',
    'functional studies (y/n)':'func_studies',
    'functional studies description':'func_studies_desc',
    'pretest diagnosis':'pretest','genotype phenotype match (y/n)':'gp_match',
    'impact of gen diagnosis (y/n)':'impact_dx','modification':'modification',
    'follow up after modification':'fu_after_mod',
    'father tested (0/1)':'father_tested','father report (0-3)':'father_report',
    'mother tested (0/1)':'mother_tested','mother report (0-2)':'mother_report',
    'mitochondrial (0-1)':'mito','abnormality detected (0/1)':'mito_abn',
    'mito gene':'mito_gene','ensembl':'mito_ensembl',
    'zygosity (1-2)':'mito_zyg','cdna':'mito_cdna','aminoacid':'mito_aa',
    'type of variation (1-5)':'mito_var_type','type of variation (1-2)2':'mito_var_type2',
    'classification (1-5)3':'mito_class','disease association':'mito_disease',
    'remarks':'remarks'
  };

  const CODE_MAPS = {
    zyg:        {'1':'Heterozygous','2':'Heterozygous','3':'Homozygous','4':'Compound Heterozygous'},
    inh:        {'1':'AD','2':'AR','3':'XL','4':'De novo'},
    classification: {'1':'Pathogenic','2':'Likely Pathogenic','3':'VUS','4':'Likely Benign','5':'Benign'},
    consang:    {'1':'Yes','0':'No'},
    veeg_done:  {'1':'Yes','0':'No'},
    var_detected: {'1':'Yes','0':'No'},
    dev1:       {'1':'Normal','2':'Delayed','3':'Regression'},
    cog:        {'1':'Normal','2':'Abnormal'},
    sz_outcome: {'1':'Remission','2':'Persistent','3':'Worsening'},
    mito:       {'1':'Yes','0':'No'},
    mito_abn:   {'1':'Yes','0':'No'},
    mito_class: {'1':'Pathogenic','2':'Likely Pathogenic','3':'VUS','4':'Likely Benign','5':'Benign'},
    mito_zyg:   {'1':'Heteroplasmic','2':'Homoplasmic'}
  };

  // Sex normaliser
  function normSex(v){
    if(v==null) return '';
    const t = String(v).trim().toLowerCase();
    if(!t) return '';
    if(t.startsWith('m')) return 'Male';
    if(t.startsWith('f')) return 'Female';
    return String(v).trim();
  }

  function _str(v){
    if(v==null) return '';
    if(typeof v === 'number'){
      // openpyxl-like: keep ints clean
      if(Number.isInteger(v)) return String(v);
      return String(v);
    }
    return String(v).replace(/\s+/g,' ').trim();
  }

  function decode(key, val){
    const t = _str(val);
    if(!t) return '';
    const map = CODE_MAPS[key];
    if(!map) return t;
    // If the cell already contains a label like "1 (Pathogenic)" prefer the label.
    const m = t.match(/\((.+?)\)/);
    if(m && /[a-zA-Z]/.test(m[1])) return m[1].trim();
    // Else treat as bare code
    const code = (t.match(/^\d+/)||[])[0];
    if(code && map[code]) return map[code];
    // Some files use "Heterozygous" outright — pass through.
    return t;
  }

  // Convert one row (array of cell values) into a registry record.
  // headers must be the array of header strings in the same order as the row.
  function parseRow(row, headers, fallbackCategory){
    const rec = {};
    for(let i=0; i<headers.length; i++){
      const h = headers[i];
      if(!h) continue;
      const key = COL_MAP[String(h).trim().toLowerCase()];
      if(!key) continue;
      const raw = row[i];
      if(raw == null || raw === '') continue;
      let val = (key === 'sex') ? normSex(raw)
              : (CODE_MAPS[key]) ? decode(key, raw)
              : _str(raw);
      if(val && val.toLowerCase() !== 'n/a') rec[key] = val;
    }
    if(!rec.category && fallbackCategory) rec.category = fallbackCategory;
    if(!rec.name) return null;     // skip empty rows
    return rec;
  }

  // Build a SheetJS workbook with the canonical template.
  // Embeds 1 example row and a "Codes" sheet describing numeric codes.
  function buildTemplateWorkbook(){
    if(typeof XLSX === 'undefined') return null;
    const wb = XLSX.utils.book_new();
    // Main data sheet (header only)
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS]);
    // Set reasonable column widths
    ws['!cols'] = TEMPLATE_COLS.map(c => ({ wch: Math.max(12, Math.min(28, c.length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, 'N5 DATA');

    // Codes legend
    const legend = [
      ['Field','Code','Meaning'],
      ['ZYGOSITY','1','Heterozygous'],
      ['ZYGOSITY','2','Heterozygous'],
      ['ZYGOSITY','3','Homozygous'],
      ['ZYGOSITY','4','Compound Heterozygous'],
      ['INHERITANCE','1','AD'],
      ['INHERITANCE','2','AR'],
      ['INHERITANCE','3','XL'],
      ['INHERITANCE','4','De novo'],
      ['CLASSIFICATION','1','Pathogenic'],
      ['CLASSIFICATION','2','Likely Pathogenic'],
      ['CLASSIFICATION','3','VUS'],
      ['CLASSIFICATION','4','Likely Benign'],
      ['CLASSIFICATION','5','Benign'],
      ['Consang','1','Yes'], ['Consang','0','No'],
      ['VEEG Done','1','Yes'], ['VEEG Done','0','No'],
      ['Variant Detected','1','Yes'], ['Variant Detected','0','No'],
      ['Dev','1','Normal'], ['Dev','2','Delayed'], ['Dev','3','Regression'],
      ['Cognition','1','Normal'], ['Cognition','2','Abnormal'],
      ['Sz outcome','1','Remission'], ['Sz outcome','2','Persistent'], ['Sz outcome','3','Worsening'],
      ['MITOCHONDRIAL','1','Yes'], ['MITOCHONDRIAL','0','No'],
      ['Mito Zygosity','1','Heteroplasmic'], ['Mito Zygosity','2','Homoplasmic']
    ];
    const wsL = XLSX.utils.aoa_to_sheet(legend);
    wsL['!cols'] = [{wch:18},{wch:8},{wch:28}];
    XLSX.utils.book_append_sheet(wb, wsL, 'Codes');

    // "Missing" sheet — when present in uploads it is silently skipped
    const wsMiss = XLSX.utils.aoa_to_sheet([['Missing rows go here — this sheet is auto-skipped on upload.']]);
    XLSX.utils.book_append_sheet(wb, wsMiss, 'Missing');

    return wb;
  }

  // Walk every sheet in a workbook and return all parsed records.
  // Sheets called "Missing" are skipped (per registry convention).
  function workbookToRecords(wb, fallbackCategory){
    const out = [];
    if(!wb || !wb.SheetNames) return out;
    wb.SheetNames.forEach(name => {
      if(/^missing$/i.test(name.trim())) return;
      const ws = wb.Sheets[name];
      if(!ws) return;
      const aoa = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:true });
      if(!aoa.length) return;
      const headers = aoa[0].map(h => h==null ? '' : String(h));
      // Detect whether the sheet looks like our template — at least 5 known headers must match.
      const knownHits = headers.filter(h => COL_MAP[String(h).trim().toLowerCase()]).length;
      if(knownHits < 5) return; // not a registry sheet — skip silently
      // Auto-detect category from sheet name like "N5 DATA"
      const guess = (name.match(/N[1-9]/) || [])[0] || fallbackCategory || '';
      for(let r=1; r<aoa.length; r++){
        const rec = parseRow(aoa[r], headers, guess);
        if(rec) out.push(rec);
      }
    });
    return out;
  }

  // expose
  window.REGISTRY_TEMPLATE = {
    TEMPLATE_COLS, COL_MAP, CODE_MAPS,
    parseRow, buildTemplateWorkbook, workbookToRecords, normSex
  };
})();
