/* ================================================================
   credits.js  —  EduPortal v2
   Credit Checker: semester-wise view + SGPI calculator (unchanged)
   ================================================================ */

let storedConvertedESE = 0;
let allCreditsData = null;
let currentCreditSem = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin('student')) return;
  fillSidebarUser();

  /* ── Load semester credit data ── */
  try {
    allCreditsData = await StudentAPI.credits();
    renderCreditSummary(currentCreditSem);
  } catch(err) {
    showToast('Could not load credit data: '+err.message, true);
  }

  /* ── Credit sem tab buttons ── */
  const creditTabs = document.getElementById('credit-sem-tabs');
  if (creditTabs) {
    creditTabs.querySelectorAll('.csem-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        creditTabs.querySelectorAll('.csem-tab').forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        currentCreditSem = btn.getAttribute('data-sem');
        renderCreditSummary(currentCreditSem);
      });
    });
  }

  /* ── Animate ring ── */
  const ring = document.getElementById('ringCircle');
  if (ring) {
    const circ = 2*Math.PI*50;
    ring.style.strokeDasharray  = circ;
    ring.style.strokeDashoffset = circ;
  }

  /* ── ESE converter ── */
  ['originalMax','originalObt','convertTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', convertMarks);
  });

  /* ── Progress bars ── */
  requestAnimationFrame(() => {
    document.querySelectorAll('.pbar-fill[data-w]').forEach(el => {
      el.style.width = el.getAttribute('data-w');
    });
  });
});

function renderCreditSummary(semFilter) {
  if (!allCreditsData) return;
  const { semesters, cgpi, totalEarned, totalPossible } = allCreditsData;

  /* ── Ring ── */
  const ring = document.getElementById('ringCircle');
  const ringPctEl = document.getElementById('ringPct');
  const reqEl  = document.getElementById('reqCredits');
  const earnEl = document.getElementById('earnedCredits');
  const remEl  = document.getElementById('remainingCredits');

  // For both "all" and individual semesters:
  // - totalPossible = sum of all subject credits considered
  // - selEarned     = sum of credits from subjects WITHOUT KT
  //   (so even if a semester has KT, already-cleared subjects still count)
  let selEarned = 0;
  let selPossible = 0;

  const semsForRing = semFilter === 'all'
    ? semesters
    : [semesters[parseInt(semFilter,10) - 1]].filter(Boolean);

  semsForRing.forEach(s => {
    if (!s) return;
    const totalCr  = s.subjects.reduce((a,x)=>a+x.credit,0);
    const passedCr = s.subjects.filter(x=>!x.kt).reduce((a,x)=>a+x.credit,0);
    selPossible += totalCr;
    selEarned   += passedCr;
  });

  const pct = selPossible > 0 ? selEarned/selPossible : 0;
  if (ring) {
    const circ = 2*Math.PI*50;
    ring.style.strokeDasharray  = circ;
    ring.style.strokeDashoffset = circ*(1-pct);
  }
  if (ringPctEl) ringPctEl.textContent = Math.round(pct*100) + '%';
  if (reqEl)  reqEl.textContent  = selPossible || 0;
  if (earnEl) earnEl.textContent = selEarned || 0;
  if (remEl)  remEl.textContent  = Math.max((selPossible - selEarned) || 0, 0);

  /* ── SGPI / CGPI display ── */
  const sgpiDisplay = document.getElementById('liveSGPI');
  if (sgpiDisplay) {
    if (semFilter === 'all') {
      sgpiDisplay.textContent = cgpi !== null ? cgpi : 'KT';
      const sgpiLabel = document.getElementById('sgpiLabel');
      if (sgpiLabel) sgpiLabel.textContent = 'CGPI (All Sems)';
    } else {
      const semIdx = parseInt(semFilter)-1;
      const sem = semesters[semIdx];
      sgpiDisplay.textContent = sem && sem.sgpi !== null ? sem.sgpi : sem ? 'KT' : '—';
      const sgpiLabel = document.getElementById('sgpiLabel');
      if (sgpiLabel) sgpiLabel.textContent = 'SGPI Sem '+semFilter;
    }
  }

  /* ── Credit table in sem history area ── */
  const histTable = document.getElementById('semHistoryBody');
  if (histTable) {
    histTable.innerHTML = [1,2,3].map(semNo => {
      const s = semesters.find(x => x.semester === semNo);
      if (!s) {
        return `<tr>
          <td><b>Semester ${semNo}</b></td>
          <td style="font-family:'Fredoka One',cursive">—</td>
          <td>—</td>
          <td><div style="width:80px;height:8px;background:#e8ddd0;border-radius:100px;overflow:hidden;border:1px solid #ccc">
            <div style="height:100%;width:0%;background:var(--teal);border-radius:100px"></div>
          </div></td>
          <td><span style="color:#aaa;font-weight:800">No data</span></td>
        </tr>`;
      }
      const passedCr = s.subjects.filter(x=>!x.kt).reduce((a,x)=>a+x.credit,0);
      const totalCr  = s.subjects.reduce((a,x)=>a+x.credit,0);
      const pctBar   = totalCr>0 ? (passedCr/totalCr*100).toFixed(0)+'%' : '0%';
      return `<tr>
        <td><b>Semester ${s.semester}</b></td>
        <td style="font-family:'Fredoka One',cursive">${s.sgpi!==null?s.sgpi:'KT'}</td>
        <td>${passedCr} / ${totalCr}</td>
        <td><div style="width:80px;height:8px;background:#e8ddd0;border-radius:100px;overflow:hidden;border:1px solid #ccc">
          <div style="height:100%;width:${pctBar};background:var(--teal);border-radius:100px"></div>
        </div></td>
        <td>${s.hasKT?'<span style="color:#e74c3c;font-weight:800">KT Present</span>':'<span style="color:#27ae60;font-weight:800">Clear ✓</span>'}</td>
      </tr>`;
    }).join('');
  }

  /* ── Subject detail table (per sem) ── */
  // Intentionally left empty: the SGPI calculator below is now
  // purely manual (add-your-own-subjects) and no longer shows
  // an automatic semester scorecard in its table.
}

/* ================================================================
   ESE MARK CONVERTER (unchanged from original)
   ================================================================ */
function convertMarks() {
  const om = parseFloat(document.getElementById('originalMax').value);
  const oo = parseFloat(document.getElementById('originalObt').value);
  const ct = parseFloat(document.getElementById('convertTo').value);
  if (isNaN(om)||isNaN(oo)||isNaN(ct)) return;
  const converted = (oo/om)*ct;
  storedConvertedESE = converted;
  document.getElementById('convertedResult').innerText = converted.toFixed(2);
  document.getElementById('convResultBox').style.display = 'flex';
  document.getElementById('storedBadge').style.display   = 'flex';
  document.getElementById('storedDisplay').innerText     = converted.toFixed(2);
}

function addTheory()    { createRow(false); }
function addPractical() { createRow(true);  }

function createRow(isPractical) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><span class="type-badge ${isPractical?'type-practical':'type-theory'}">${isPractical?'🔬 Practical':'📘 Theory'}</span></td>
    <td><input type="number" class="t-inp credit" placeholder="4" min="0"></td>
    <td><input type="number" class="t-inp eseMax" placeholder="60" min="0"></td>
    <td class="ese-obt-cell">
      <input type="number" class="t-inp eseObt" placeholder="—" min="0">
      <button type="button" class="use-btn" onclick="useStoredESE(this)">Use ↓</button>
    </td>
    <td><input type="number" class="t-inp iseMax" placeholder="—" min="0" ${isPractical?'disabled':''}></td>
    <td><input type="number" class="t-inp iseObt" placeholder="—" min="0" ${isPractical?'disabled':''}></td>
    <td><input type="number" class="t-inp mseMax" placeholder="—" min="0"></td>
    <td><input type="number" class="t-inp mseObt" placeholder="—" min="0"></td>
    <td class="grade-cell">—</td>
    <td class="cp-cell">—</td>
    <td><button type="button" class="del-btn" onclick="this.closest('tr').remove();calculateSGPI()">✕</button></td>`;
  
  document.getElementById('tableBody').appendChild(row);
  row.querySelectorAll('.t-inp').forEach(inp => inp.addEventListener('input', () => { autoFill(row); validateRow(row); calculateSGPI(); }));
}

function autoFill(row) {
  const eseMax = parseFloat(row.querySelector('.eseMax').value);
  if (!isNaN(eseMax)) {
    const sub = eseMax===60 ? 20 : eseMax===45 ? 15 : null;
    if (sub) {
      ['iseMax','mseMax'].forEach(cls => { const el=row.querySelector('.'+cls); if(el&&!el.disabled&&!el.value) el.value=sub; });
    }
  }
}

function validateRow(row) {
  row.querySelectorAll('.t-inp').forEach(inp => {
    if (inp.classList.contains('eseObt')||inp.classList.contains('iseObt')||inp.classList.contains('mseObt')) {
      const maxCls = inp.className.replace('Obt','Max');
      const maxEl  = row.querySelector('.'+maxCls.split(' ').find(c=>c.endsWith('Max')));
      if (maxEl && parseFloat(inp.value) > parseFloat(maxEl.value)) {
        inp.style.border='3px solid #e74c3c'; showToast('Obtained cannot exceed maximum!',true);
      } else { inp.style.border=''; }
    }
  });
}

function useStoredESE(btn) {
  const row = btn.closest('tr');
  const eseObt = row.querySelector('.eseObt');
  if (eseObt && storedConvertedESE) { eseObt.value = storedConvertedESE.toFixed(2); calculateSGPI(); }
}

function calculateSGPI() {
  const rows = document.querySelectorAll('#tableBody tr[data-api]') || document.querySelectorAll('#tableBody tr:not([style*="background:#f5"])');
  // Only run for calculator rows (if user added rows)
  const calcRows = Array.from(document.querySelectorAll('#tableBody tr')).filter(r => r.querySelector('.t-inp'));
  if (!calcRows.length) return;

  let totalCr=0, totalCP=0, hasKT=false;
  calcRows.forEach(row => {
    const cr   = parseFloat(row.querySelector('.credit')?.value)||0;
    const eseMx= parseFloat(row.querySelector('.eseMax')?.value)||0;
    const eseOb= parseFloat(row.querySelector('.eseObt')?.value)||0;
    const iseMx= parseFloat(row.querySelector('.iseMax')?.value)||0;
    const iseOb= parseFloat(row.querySelector('.iseObt')?.value)||0;
    const mseMx= parseFloat(row.querySelector('.mseMax')?.value)||0;
    const mseOb= parseFloat(row.querySelector('.mseObt')?.value)||0;

    const totalObt = eseOb+iseOb+mseOb;
    const totalMx  = eseMx+iseMx+mseMx;
    if (!totalMx) return;

    const intMx = iseMx+mseMx;
    let kt = false;
    if (intMx>0 && ((iseOb+mseOb)/intMx)*100<40) kt=true;
    if (eseMx>0 && (eseOb/eseMx)*100<40) kt=true;

    const gradeCell = row.querySelector('.grade-cell');
    const cpCell    = row.querySelector('.cp-cell');
    if (kt) {
      if(gradeCell) gradeCell.textContent='--'; if(cpCell) cpCell.textContent='--';
      hasKT=true; row.style.background='#fff0f0'; return;
    }
    row.style.background='';
    const pct  = (totalObt/totalMx)*100;
    const {grade,gradePoint} = getGradeLocal(pct);
    const cp = cr*gradePoint;
    if(gradeCell) gradeCell.textContent=grade; if(cpCell) cpCell.textContent=cp.toFixed(2);
    totalCr+=cr; totalCP+=cp;
  });

  const sgpiEl = document.getElementById('sgpi');
  const crEl   = document.getElementById('totalCredits');
  const cpEl   = document.getElementById('totalCP');
  // Only update if we have calc rows
  if (calcRows.length && sgpiEl) {
    sgpiEl.textContent = hasKT ? '--' : (totalCr>0 ? (totalCP/totalCr).toFixed(2) : '0');
    if(crEl) crEl.textContent = totalCr;
    if(cpEl) cpEl.textContent = totalCP.toFixed(2);
  }
}

function getGradeLocal(pct) {
  if(pct>=80) return{grade:'O',gradePoint:10};
  if(pct>=75) return{grade:'A+',gradePoint:9};
  if(pct>=70) return{grade:'A',gradePoint:8};
  if(pct>=60) return{grade:'B+',gradePoint:7};
  if(pct>=50) return{grade:'B',gradePoint:6};
  if(pct>=45) return{grade:'C',gradePoint:5};
  if(pct>=40) return{grade:'P',gradePoint:4};
  return{grade:'F',gradePoint:0};
}