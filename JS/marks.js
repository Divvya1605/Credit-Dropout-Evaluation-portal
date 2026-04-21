document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin('student')) return;
  fillSidebarUser();

  const SEMS = { 1:'Semester 1', 2:'Semester 2', 3:'Semester 3' };
  let currentSem = 1;
  let allData = null;

  const tbody      = document.getElementById('marks-tbody');
  const breakdown  = document.getElementById('marks-breakdown');
  const msAvg      = document.getElementById('ms-avg');
  const msSgpi     = document.getElementById('ms-sgpi');
  const msKt       = document.getElementById('ms-kt');
  const msGood     = document.getElementById('ms-good');
  const semTabsEl  = document.getElementById('sem-tabs');
  const marksTitle = document.getElementById('marksTitle');

  /* ── Build sem tab buttons ── */
  if (semTabsEl) {
    semTabsEl.innerHTML = [1,2,3].map(s =>
      `<button class="sem-tab ${s===1?'on':''}" data-sem="${s}">${SEMS[s]}</button>`
    ).join('');
    semTabsEl.querySelectorAll('.sem-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        semTabsEl.querySelectorAll('.sem-tab').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        currentSem = parseInt(btn.getAttribute('data-sem'));
        renderSem(currentSem);
      });
    });
  }

  function gradeClass(g) {
    return {O:'g-o','A+':'g-ap',A:'g-a','B+':'g-bp',B:'g-b',C:'g-c',P:'g-p',F:'g-f'}[g] || '';
  }

  const COLOURS = ['var(--yellow)','var(--teal)','var(--coral)','var(--purple)','var(--pink)','var(--peach)','#a8d8a8','#b8c0ff'];

  function renderSem(sem) {
    if (!allData) return;
    const d = allData.semesters[sem];
    if (!d) { if(tbody) tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:#aaa">No data</td></tr>'; return; }

    const subjects = d.subjects;

    // Update mark sheet title for selected semester
    if (marksTitle) {
      marksTitle.textContent = `${SEMS[sem]} — Mark Sheet 📋`;
    }
    const totalPct = subjects.length ? subjects.reduce((s,x)=>s+x.percentage,0)/subjects.length : 0;
    const ktCount  = subjects.filter(s=>s.kt).length;
    const goodCount= subjects.filter(s=>s.gradePoint>=8).length;

    if (msAvg)  msAvg.textContent  = totalPct.toFixed(1)+'%';
    if (msSgpi) msSgpi.textContent = d.sgpi !== null ? d.sgpi : 'KT';
    if (msKt)   msKt.textContent   = ktCount;
    if (msGood) msGood.textContent = goodCount;

    /* table */
    if (tbody) {
      tbody.innerHTML = subjects.map(s => {
        const isT = s.type === 'theory';
        const isL = s.type === 'lab2';
        const typeLabel = isT ? `<span style="background:var(--teal);border:2px solid #1A1A1A;border-radius:7px;padding:2px 8px;font-size:11px;font-weight:800">Theory</span>`
                        : isL ? `<span style="background:var(--purple);border:2px solid #1A1A1A;border-radius:7px;padding:2px 8px;font-size:11px;font-weight:800">Lab</span>`
                               : `<span style="background:var(--pink);border:2px solid #1A1A1A;border-radius:7px;padding:2px 8px;font-size:11px;font-weight:800">Practical</span>`;
        const eseCell = isT ? `${s.ese_obt??'—'}/${s.ese_max}` : '—';
        const iseCell = isT ? `${s.ise_obt??'—'}/${s.ise_max}` : '—';
        const mseCell = isT ? `${s.mse_obt??'—'}/${s.mse_max}`
                      : isL ? `CIAP ${s.ciap_obt??'—'} / ESEP ${s.esep_obt??'—'}`
                             : `${s.apl_obt??'—'}/${s.apl_max}`;
        const statusEl = s.kt
          ? `<span style="color:#e74c3c;font-weight:800">KT ✗</span>`
          : `<span style="color:#27ae60;font-weight:800">Pass ✓</span>`;
        return `<tr style="${s.kt?'background:#fff0f0':''}">
          <td><b>${s.subject_name}</b></td>
          <td>${typeLabel}</td>
          <td>${eseCell}</td><td>${iseCell}</td><td>${mseCell}</td>
          <td><b>${s.totalObt??'—'}/${s.totalMax}</b></td>
          <td>${s.percentage.toFixed(1)}%</td>
          <td><span class="grade ${gradeClass(s.grade)}" style="background:${gradeColour(s.grade)};color:#fff;border:2px solid #1A1A1A;border-radius:8px;padding:3px 10px;font-weight:800;font-size:13px">${s.grade}</span></td>
          <td>${statusEl}</td>
        </tr>`;
      }).join('');
    }

    /* visual breakdown */
    if (breakdown) {
      breakdown.innerHTML = subjects.map((s,i) => {
        const col = COLOURS[i%COLOURS.length];
        const totW = s.totalMax ? ((s.totalObt/s.totalMax)*100).toFixed(1) : 0;
        const eseW = s.ese_max  ? ((s.ese_obt/s.ese_max)*100).toFixed(1)  : 0;
        return `<div class="subj-detail">
          <div class="sd-top"><span class="sd-name">${s.subject_name}</span><span class="sd-score" style="color:${col}">${s.percentage.toFixed(1)}%</span></div>
          <div class="sd-bars">
            <div class="sd-bar-wrap">
              <div class="sd-bar-lbl">${s.type==='theory'?`ESE — ${s.ese_obt}/${s.ese_max}`:s.type==='lab2'?`CIAP ${s.ciap_obt} / ESEP ${s.esep_obt}`:`Marks — ${s.apl_obt}/${s.apl_max}`}</div>
              <div class="pbar-bg"><div class="pbar-fill" style="background:${col};width:0;transition:width 1s ease" data-w="${s.type==='theory'?eseW:totW}%"></div></div>
            </div>
            <div class="sd-bar-wrap">
              <div class="sd-bar-lbl">Total — ${s.totalObt}/${s.totalMax}</div>
              <div class="pbar-bg"><div class="pbar-fill" style="background:${col};opacity:0.5;width:0;transition:width 1s ease" data-w="${totW}%"></div></div>
            </div>
          </div>
        </div>`;
      }).join('');
      requestAnimationFrame(() => {
        document.querySelectorAll('.pbar-fill[data-w]').forEach(el => { el.style.width = el.getAttribute('data-w'); });
      });
    }
  }

  /* ── Load all data ── */
  try {
    allData = await StudentAPI.marksAll();
    renderSem(1);
  } catch(err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:#e74c3c;font-weight:800">❌ ${err.message}</td></tr>`;
    showToast(err.message, true);
  }
});