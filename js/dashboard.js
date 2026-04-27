// ─────────────────────────────────────────────────────────────────────────────
// Clinical Dashboard — infographic build
// Inspired by EBRAINS Medical Analytics + neurology practice-management UIs.
//   • Hero KPI ring (animated SVG conic) — diagnostic yield
//   • Cohort matrix (N1 / N2 / N3 / N5) with click-to-filter
//   • ACMG funnel
//   • Top genes — bubble pack (D3-style) drawn on canvas
//   • Age-of-onset density area chart
//   • Inheritance pattern donut, sex donut, test-type bar, seizure radar
//   • Geographic place breakdown (top regions)
//   • Recent-entries patient grid with click-into-detail
// All charts read from the global `patients` array maintained by app.js.
// ─────────────────────────────────────────────────────────────────────────────
(function () {

  const PALETTE = {
    blue:'#1e4a8c', navy:'#003087', gold:'#b8923a', goldLight:'#dcb84a',
    green:'#22a05a', greenLight:'#5dd09a', purple:'#7e3fb1', purpleLight:'#b388d9',
    teal:'#1f8a8a', tealLight:'#5cc4c4', red:'#d24a3d', redLight:'#f08b80',
    orange:'#e2912b', rose:'#c8456e', slate:'#5c6f8c', muted:'#8b97ad',
    indigo:'#3742a3', cyan:'#1ea3c4'
  };

  const ACMG_COLORS = {
    'Pathogenic':PALETTE.red,
    'Likely Pathogenic':PALETTE.orange,
    'VUS':PALETTE.purple,
    'Likely Benign':PALETTE.greenLight,
    'Benign':PALETTE.teal
  };

  const CAT_COLORS = {
    'N1': '#3483d2', 'N2': '#22a05a', 'N3': '#e2912b', 'N5': '#7e3fb1'
  };

  // Chart.js instances — destroyed/rebuilt every render
  const charts = {};

  function destroyChart(id){
    if(charts[id]){ try{charts[id].destroy();}catch(e){} delete charts[id]; }
  }
  function ctx(id){ const el=document.getElementById(id); return el ? el.getContext('2d') : null; }
  function el(id){ return document.getElementById(id); }
  function txt(id, value){ const e=el(id); if(e) e.textContent = value; }
  function html(id, h){ const e=el(id); if(e) e.innerHTML = h; }

  function personKey(p){
    return (p.uhid && String(p.uhid).trim()) ||
           (p.nnum && String(p.nnum).trim()) ||
           (p.name && String(p.name).trim().toLowerCase()) ||
           ('row-'+p.id);
  }

  function parseAaoYears(raw){
    if(raw==null || raw==='') return null;
    if(typeof raw === 'number') return raw;
    const t = String(raw).toLowerCase();
    const m = t.match(/(\d+(?:\.\d+)?)/);
    if(!m) return null;
    const n = parseFloat(m[1]);
    if(t.includes('day')) return n/365;
    if(t.includes('week') || /\bwk\b/.test(t)) return n/52;
    if(t.includes('month') || /\bmo\b/.test(t)) return n/12;
    return n;
  }

  function shortGene(g){
    if(!g) return '';
    return String(g).split(/[ (]/)[0].trim();
  }

  function unique(arr){ return Array.from(new Set(arr)); }

  // animate a number from 0 → target over ms
  function animateNumber(id, target, suffix){
    const e = el(id); if(!e) return;
    const start = performance.now();
    const ms = 900;
    const fmt = v => Math.round(v) + (suffix||'');
    function step(t){
      const k = Math.min(1, (t-start)/ms);
      const eased = 1 - Math.pow(1-k, 3);
      e.textContent = fmt(target * eased);
      if(k < 1) requestAnimationFrame(step);
      else e.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }

  // Animated SVG conic ring used in the hero band
  function renderHeroRing(yieldPct){
    const e = el('hero-ring'); if(!e) return;
    const r = 80, c = 2*Math.PI*r;
    const offsetTarget = c - (c * (yieldPct/100));
    e.innerHTML = `
      <svg viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stop-color="#dcb84a"/>
            <stop offset="55%" stop-color="#b8923a"/>
            <stop offset="100%" stop-color="#003087"/>
          </linearGradient>
          <filter id="ring-glow"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>
        <circle cx="100" cy="100" r="${r}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="14"/>
        <circle id="hero-ring-fill" cx="100" cy="100" r="${r}" fill="none" stroke="url(#ring-grad)"
                stroke-width="14" stroke-linecap="round"
                stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}"
                transform="rotate(-90 100 100)"/>
        <text x="100" y="92" text-anchor="middle" font-size="40" font-weight="700" fill="#fff">${yieldPct}%</text>
        <text x="100" y="118" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.78)" letter-spacing="1.6">DIAGNOSTIC YIELD</text>
      </svg>`;
    // Animate dashoffset
    requestAnimationFrame(()=>{
      const fill = document.getElementById('hero-ring-fill');
      if(fill){
        fill.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.2,.6,.2,1)';
        fill.style.strokeDashoffset = offsetTarget;
      }
    });
  }

  function renderHeroSparkline(patients){
    const host = el('hero-spark'); if(!host) return;
    // Distribution by category for the spark
    const cats = ['N1','N2','N3','N5'];
    const counts = cats.map(c => unique(patients.filter(p=>p.category===c).map(personKey)).length);
    const max = Math.max(1, ...counts);
    host.innerHTML = `<div class="spark-grid">${
      cats.map((c,i)=>`<div class="spark-col" title="${c}: ${counts[i]} patients">
        <div class="spark-bar" style="height:${(counts[i]/max*100)|0}%; background:${CAT_COLORS[c]}"></div>
        <div class="spark-lbl">${c}</div>
        <div class="spark-num">${counts[i]}</div>
      </div>`).join('')
    }</div>`;
  }

  function renderCohortCards(patients){
    const wrap = el('cohort-cards'); if(!wrap) return;
    const cats = ['N1','N2','N3','N5'];
    const html = cats.map(c=>{
      const rows = patients.filter(p => p.category===c);
      const ppl = unique(rows.map(personKey)).length;
      const dx = unique(rows.filter(r=>r.classification==='Pathogenic'||r.classification==='Likely Pathogenic').map(personKey)).length;
      const yieldPct = ppl ? Math.round(dx/ppl*100) : 0;
      const genes = unique(rows.map(r=>shortGene(r.gene)).filter(Boolean)).length;
      return `<div class="cohort-card" data-cat="${c}" onclick="window.DASH.drilldownCohort('${c}')" style="--cat:${CAT_COLORS[c]}">
        <div class="cohort-head">
          <div class="cohort-tag">${c}</div>
          <div class="cohort-yield">${yieldPct}<small>%</small></div>
        </div>
        <div class="cohort-bar"><div class="cohort-bar-fill" style="width:${yieldPct}%"></div></div>
        <div class="cohort-stats">
          <div><b>${ppl}</b><span>patients</span></div>
          <div><b>${rows.length}</b><span>variants</span></div>
          <div><b>${genes}</b><span>genes</span></div>
          <div><b>${dx}</b><span>P / LP</span></div>
        </div>
        <div class="cohort-cta">View cohort →</div>
      </div>`;
    }).join('');
    wrap.innerHTML = html;
  }

  function renderACMGFunnel(patients){
    const e = el('acmg-funnel'); if(!e) return;
    const ppl = unique(patients.map(personKey)).length;
    const tested = unique(patients.filter(p=>p.type_test).map(personKey)).length;
    const variant = unique(patients.filter(p=>p.gene||p.variant).map(personKey)).length;
    const plp = unique(patients.filter(p=>p.classification==='Pathogenic'||p.classification==='Likely Pathogenic').map(personKey)).length;
    const path = unique(patients.filter(p=>p.classification==='Pathogenic').map(personKey)).length;
    const denom = Math.max(1, ppl);
    const rows = [
      ['Total enrolled', ppl, '#1e4a8c'],
      ['Genetically tested', tested, '#2266b8'],
      ['Variant detected', variant, '#b8923a'],
      ['Pathogenic / Likely Pathogenic', plp, '#d24a3d'],
      ['Pathogenic only', path, '#7e3fb1']
    ];
    e.innerHTML = rows.map(([label, n, col],i)=>{
      const w = Math.max(12, Math.round(n/denom*100));
      const pct = ppl ? Math.round(n/ppl*100) : 0;
      return `<div class="funnel-row" style="--w:${w}%;--col:${col}">
        <div class="funnel-bar"><span>${n}</span></div>
        <div class="funnel-meta"><b>${label}</b><i>${pct}% of enrolled</i></div>
      </div>`;
    }).join('');
  }

  // Bubble pack — top genes drawn as scaled circles
  function renderGeneBubbles(patients){
    const c = document.getElementById('gene-bubbles'); if(!c) return;
    const map = {};
    patients.forEach(p=>{ const g = shortGene(p.gene); if(g) map[g]=(map[g]||0)+1; });
    const data = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,18);
    const W = c.clientWidth || 600, H = 260;
    c.width = W * (window.devicePixelRatio||1);
    c.height = H * (window.devicePixelRatio||1);
    c.style.height = H+'px';
    const ctx2 = c.getContext('2d');
    ctx2.scale(window.devicePixelRatio||1, window.devicePixelRatio||1);
    ctx2.clearRect(0,0,W,H);
    if(!data.length){
      ctx2.fillStyle='#8b97ad'; ctx2.font="13px 'Segoe UI'"; ctx2.textAlign='center';
      ctx2.fillText('No gene data yet', W/2, H/2);
      return;
    }
    const max = data[0][1];
    const cells = [];
    data.forEach(([g,n],i)=>{
      const r = 14 + Math.sqrt(n/max) * 38;
      cells.push({g,n,r});
    });
    // simple circle pack — random + relax
    const cx0 = W/2, cy0 = H/2;
    cells.forEach((c,i)=>{
      c.x = cx0 + (Math.random()-0.5)*40;
      c.y = cy0 + (Math.random()-0.5)*40;
    });
    for(let iter=0; iter<160; iter++){
      for(let i=0;i<cells.length;i++){
        const a=cells[i];
        // gravity to centre
        a.x += (cx0 - a.x)*0.012;
        a.y += (cy0 - a.y)*0.012;
        for(let j=i+1;j<cells.length;j++){
          const b=cells[j];
          const dx=b.x-a.x, dy=b.y-a.y;
          const d=Math.sqrt(dx*dx+dy*dy)||0.01;
          const min=a.r+b.r+2;
          if(d<min){
            const push=(min-d)/2;
            const ux=dx/d, uy=dy/d;
            a.x -= ux*push; a.y -= uy*push;
            b.x += ux*push; b.y += uy*push;
          }
        }
        // bounds
        a.x = Math.max(a.r+4, Math.min(W-a.r-4, a.x));
        a.y = Math.max(a.r+4, Math.min(H-a.r-4, a.y));
      }
    }
    cells.forEach((cell,i)=>{
      const grad = ctx2.createRadialGradient(cell.x-cell.r/3, cell.y-cell.r/3, 2, cell.x, cell.y, cell.r);
      const base = [PALETTE.blue, PALETTE.gold, PALETTE.purple, PALETTE.teal, PALETTE.rose, PALETTE.orange, PALETTE.indigo, PALETTE.cyan][i % 8];
      grad.addColorStop(0, base + 'ee');
      grad.addColorStop(1, base + '55');
      ctx2.beginPath();
      ctx2.arc(cell.x, cell.y, cell.r, 0, Math.PI*2);
      ctx2.fillStyle = grad; ctx2.fill();
      ctx2.lineWidth=1; ctx2.strokeStyle = base; ctx2.stroke();
      // label
      ctx2.fillStyle = '#fff'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
      ctx2.font = `${Math.max(10, Math.min(14, cell.r/2.4))}px 'Segoe UI'`;
      ctx2.fillText(cell.g, cell.x, cell.y - 4);
      ctx2.font = `${Math.max(9, cell.r/3.2)}px 'Segoe UI'`;
      ctx2.fillText('×'+cell.n, cell.x, cell.y + cell.r/3.5);
    });
  }

  function renderACMGDonut(patients){
    destroyChart('chart-class');
    const c = ctx('chart-class'); if(!c) return;
    const cls={}; patients.forEach(p=>{ if(p.classification) cls[p.classification]=(cls[p.classification]||0)+1; });
    const keys = Object.keys(cls);
    if(!keys.length){ emptyChart('chart-class'); return; }
    charts['chart-class'] = new Chart(c, {
      type:'doughnut',
      data:{ labels:keys, datasets:[{
        data: keys.map(k=>cls[k]),
        backgroundColor: keys.map(k=>ACMG_COLORS[k]||PALETTE.muted),
        borderWidth:3, borderColor:'#fff'
      }]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'68%',
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:11, padding:8, font:{size:11} } } },
        animation:{ animateRotate:true, duration:900 }
      }
    });
  }

  function renderInheritance(patients){
    destroyChart('chart-inh');
    const c = ctx('chart-inh'); if(!c) return;
    const map={}; patients.forEach(p=>{ if(p.inh) map[p.inh]=(map[p.inh]||0)+1; });
    const keys = Object.keys(map);
    if(!keys.length){ emptyChart('chart-inh'); return; }
    const palette=[PALETTE.blue,PALETTE.gold,PALETTE.green,PALETTE.purple,PALETTE.teal,PALETTE.rose,PALETTE.orange,PALETTE.slate];
    charts['chart-inh'] = new Chart(c, {
      type:'polarArea',
      data:{ labels:keys, datasets:[{
        data:keys.map(k=>map[k]),
        backgroundColor: keys.map((_,i)=>palette[i%palette.length] + 'cc'),
        borderColor: keys.map((_,i)=>palette[i%palette.length]),
        borderWidth: 1.5
      }]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:11, padding:8, font:{size:11} } } },
        scales:{ r:{ ticks:{ display:false }, grid:{ color:'#eef1f7' } } }
      }
    });
  }

  function renderSex(patients){
    destroyChart('chart-sex');
    const c = ctx('chart-sex'); if(!c) return;
    const m = {}; patients.forEach(p=>{ const s = p.sex && String(p.sex).trim(); if(s) m[s]=(m[s]||0)+1; });
    const keys = Object.keys(m);
    if(!keys.length){ emptyChart('chart-sex'); return; }
    charts['chart-sex'] = new Chart(c,{
      type:'doughnut',
      data:{ labels:keys, datasets:[{ data:keys.map(k=>m[k]),
        backgroundColor:[PALETTE.blue,PALETTE.rose,PALETTE.gold,PALETTE.teal],
        borderWidth:3, borderColor:'#fff' }]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'70%',
        plugins:{ legend:{ position:'bottom', labels:{boxWidth:11,padding:8,font:{size:11}}}}}
    });
  }

  function renderTestType(patients){
    destroyChart('chart-test');
    const c = ctx('chart-test'); if(!c) return;
    const m = {}; patients.forEach(p=>{ const t = (p.type_test||'').trim(); if(t) m[t]=(m[t]||0)+1; });
    const keys = Object.keys(m).sort((a,b)=>m[b]-m[a]).slice(0,8);
    if(!keys.length){ emptyChart('chart-test'); return; }
    charts['chart-test'] = new Chart(c,{
      type:'bar',
      data:{ labels:keys.map(k=>k.length>34?k.slice(0,32)+'…':k),
             datasets:[{ data:keys.map(k=>m[k]), backgroundColor:PALETTE.gold, borderRadius:6 }]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:t=>t.parsed.x+' patients' } } },
        scales:{ x:{ beginAtZero:true, grid:{ color:'#eef1f7' } }, y:{ grid:{ display:false } } } }
    });
  }

  function renderAao(patients){
    destroyChart('chart-aao');
    const c = ctx('chart-aao'); if(!c) return;
    const buckets=[
      {label:'<1 mo', max:1/12},
      {label:'1–6 mo', max:0.5},
      {label:'6–12 mo', max:1},
      {label:'1–3 y', max:3},
      {label:'3–6 y', max:6},
      {label:'6–12 y', max:12},
      {label:'12–18 y', max:18},
      {label:'>18 y', max:200}
    ];
    let prev=0;
    buckets.forEach(b=>{ b.min=prev; prev=b.max; });
    const vals = patients.map(p=>parseAaoYears(p.aao)).filter(v=>v!=null && !isNaN(v));
    const counts = buckets.map(b => vals.filter(v=>v>=b.min && v<b.max).length);
    if(!counts.some(x=>x)){ emptyChart('chart-aao'); return; }
    charts['chart-aao'] = new Chart(c,{
      type:'line',
      data:{ labels:buckets.map(b=>b.label), datasets:[{
        data: counts, fill:true, tension:0.4,
        borderColor: PALETTE.teal, borderWidth:2,
        backgroundColor:(ctx)=>{
          const g = ctx.chart.ctx.createLinearGradient(0,0,0,260);
          g.addColorStop(0, 'rgba(31,138,138,.55)');
          g.addColorStop(1, 'rgba(31,138,138,0)');
          return g;
        },
        pointBackgroundColor: PALETTE.teal,
        pointRadius:3, pointHoverRadius:6
      }]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:t=>t.parsed.y+' patients' } } },
        scales:{ x:{ grid:{ display:false } }, y:{ beginAtZero:true, grid:{ color:'#eef1f7' }, ticks:{ precision:0 } } } }
    });
  }

  function renderSeizureRadar(patients){
    destroyChart('chart-sztype');
    const c = ctx('chart-sztype'); if(!c) return;
    const map = {};
    patients.forEach(p=>{
      if(!p.sz_type) return;
      String(p.sz_type).split(/[\/,;]+|\sand\s/i).map(s=>s.trim()).filter(Boolean).forEach(s=>{
        const k = s.length>22 ? s.slice(0,20)+'…' : s;
        map[k] = (map[k]||0)+1;
      });
    });
    const top = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
    if(!top.length){ emptyChart('chart-sztype'); return; }
    charts['chart-sztype'] = new Chart(c,{
      type:'radar',
      data:{ labels: top.map(t=>t[0]), datasets:[{
        label:'Patients', data: top.map(t=>t[1]),
        backgroundColor: 'rgba(126,63,177,.22)',
        borderColor: PALETTE.purple, borderWidth:2,
        pointBackgroundColor: PALETTE.purple, pointRadius:3, pointHoverRadius:6
      }]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales:{ r:{ beginAtZero:true, ticks:{ display:false }, pointLabels:{ font:{ size:11 } }, grid:{ color:'#eef1f7' }, angleLines:{ color:'#eef1f7' } } } }
    });
  }

  function renderPlaceBars(patients){
    const e = el('place-bars'); if(!e) return;
    const m = {};
    patients.forEach(p=>{
      const place = (p.place||'').replace(/^.*?,/,'').trim() || (p.place||'').trim();
      if(!place) return;
      m[place] = (m[place]||0)+1;
    });
    const top = Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8);
    if(!top.length){ e.innerHTML='<div class="empty">No location data</div>'; return; }
    const max = top[0][1];
    e.innerHTML = top.map(([place,n])=>`
      <div class="bar-row">
        <div class="bar-label" title="${place}">${place}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(n/max*100)|0}%; background:linear-gradient(90deg,${PALETTE.blue},${PALETTE.gold})"></div></div>
        <div class="bar-val">${n}</div>
      </div>`).join('');
  }

  function renderClinicalChips(patients){
    const e = el('clin-chips'); if(!e) return;
    const denom = patients.length;
    const hits = (predicate) => patients.filter(predicate).length;
    const consang = hits(p=>p.consang==='Yes');
    const refractory = hits(p=>/refract/i.test(p.sz_freq||p.sz_outcome||''));
    const dev = hits(p=>p.dev1==='Delayed' || p.dev1==='Regression');
    const cog = hits(p=>p.cog==='Abnormal');
    const veeg = hits(p=>p.veeg_done==='Yes');
    const mri = hits(p=>p.mri && !/^normal$/i.test(p.mri));
    const mito = hits(p=>p.mito==='Yes');
    const pretest = unique(patients.filter(p=>p.pretest).map(p=>p.pretest)).length;
    const items = [
      ['Consanguinity', consang, '#b8923a'],
      ['Refractory sz', refractory, '#d24a3d'],
      ['Dev delayed/regress', dev, '#7e3fb1'],
      ['Cognition abnormal', cog, '#1f8a8a'],
      ['VEEG performed', veeg, '#003087'],
      ['Abnormal MRI', mri, '#e2912b'],
      ['Mitochondrial work-up', mito, '#3742a3'],
      ['Pre-test diagnoses (unique)', pretest, '#22a05a']
    ];
    e.innerHTML = items.map(([lbl,n,col])=>`
      <div class="chip" style="--col:${col}">
        <div class="chip-num">${n}</div>
        <div class="chip-meta">
          <div class="chip-lbl">${lbl}</div>
          <div class="chip-pct">${denom?Math.round(n/denom*100):0}% of variant rows</div>
        </div>
      </div>`).join('');
  }

  function renderRecentEntries(patients){
    const tbody = el('recent-body'); if(!tbody) return;
    const recent = [...patients].slice(-12).reverse();
    if(!recent.length){
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No records yet — upload an Excel template to begin.</td></tr>`;
      return;
    }
    tbody.innerHTML = recent.map(p=>`
      <tr onclick="window.viewPatient && window.viewPatient(${p.id})" style="cursor:pointer">
        <td>${catBadge(p.category)}</td>
        <td><b>${esc(p.name)}</b></td>
        <td style="font-size:12px">${esc(p.nnum||'—')}</td>
        <td style="font-family:monospace;font-size:12px">${esc(shortGene(p.gene)||'—')}</td>
        <td><span class="${classColor(p.classification)}">${esc(p.classification||'—')}</span></td>
        <td style="font-family:monospace;font-size:11px">${esc((p.variant||'').slice(0,38))}${(p.variant||'').length>38?'…':''}</td>
        <td style="font-size:12px">${esc(p.disease || '—')}</td>
      </tr>`).join('');
  }

  function emptyChart(id){
    const c = ctx(id); if(!c) return;
    const cv = c.canvas; c.clearRect(0,0,cv.width,cv.height);
    c.save(); c.fillStyle='#8b97ad'; c.font="12px 'Segoe UI'";
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('No data yet', cv.width/2, cv.height/2); c.restore();
  }

  function classColor(c){
    if(!c) return '';
    if(c==='Pathogenic') return 'badge badge-path';
    if(c==='Likely Pathogenic') return 'badge badge-lp';
    if(c==='VUS') return 'badge badge-vus';
    if(c==='Likely Benign') return 'badge badge-lb';
    return 'badge badge-ben';
  }
  function catBadge(c){
    if(!c) return '<span style="color:var(--nim-muted);font-size:12px">—</span>';
    const cls = {'N1':'badge-n1','N2':'badge-n2','N3':'badge-n3','N5':'badge-n5'}[c]||'';
    return `<span class="badge ${cls}">${c}</span>`;
  }
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  }

  // Public render — called by app.js on initial load and after every mutation
  function render(patients){
    Chart.defaults.font.family="'Segoe UI',system-ui,sans-serif";
    Chart.defaults.color = '#3a455c';
    Chart.defaults.borderColor = '#dde3ee';

    const ppl = unique(patients.map(personKey)).length;
    const variantRows = patients.filter(p=>p.gene||p.variant).length;
    const dxPpl = unique(patients.filter(p=>p.classification==='Pathogenic'||p.classification==='Likely Pathogenic').map(personKey)).length;
    const yieldPct = ppl ? Math.round(dxPpl/ppl*100) : 0;
    const path = patients.filter(p=>p.classification==='Pathogenic').length;
    const genes = unique(patients.map(p=>shortGene(p.gene)).filter(Boolean)).length;
    const aao = patients.map(p=>parseAaoYears(p.aao)).filter(v=>v!=null && !isNaN(v)).sort((a,b)=>a-b);
    const median = aao.length ? aao[Math.floor(aao.length/2)] : null;

    // Hero band
    renderHeroRing(yieldPct);
    renderHeroSparkline(patients);
    txt('hero-total', ppl);
    txt('hero-variants', variantRows);
    txt('hero-genes', genes);
    txt('hero-path', path);
    txt('hero-aao', median==null ? '—' : (median<1 ? Math.round(median*12)+' mo' : median.toFixed(1)+' y'));
    txt('hero-update', new Date().toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'}));

    animateNumber('kpi-total', ppl);
    animateNumber('kpi-variants', variantRows);
    animateNumber('kpi-genes', genes);
    animateNumber('kpi-yield', yieldPct, '%');
    animateNumber('kpi-path', path);

    renderCohortCards(patients);
    renderACMGFunnel(patients);
    renderACMGDonut(patients);
    renderInheritance(patients);
    renderGeneBubbles(patients);
    renderAao(patients);
    renderSeizureRadar(patients);
    renderSex(patients);
    renderTestType(patients);
    renderClinicalChips(patients);
    renderPlaceBars(patients);
    renderRecentEntries(patients);
  }

  function drilldownCohort(cat){
    // Switch to patient registry filtered by category
    if(typeof window.showPage === 'function'){
      const navBtn = document.querySelector('[onclick*=patients]');
      window.showPage('patients', navBtn);
      const sel = document.getElementById('pt-cat-filter');
      if(sel){ sel.value = cat; }
      if(typeof window.filterPatients==='function') window.filterPatients();
    }
  }

  window.DASH = { render, drilldownCohort };
  // Also expose helpers used elsewhere
  window.classColor = classColor;
  window.catBadge = catBadge;
  window.shortGene = shortGene;
  window.parseAaoYears = parseAaoYears;
})();
