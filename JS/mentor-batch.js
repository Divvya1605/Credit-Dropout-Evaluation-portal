let ALL_STUDENTS = [];
let riskFilter = 'all', searchQ = '', viewDiv = '', viewBatch = '';

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin('mentor')) return;
  fillSidebarUser();

  /* ── Build division/batch filter dropdowns ── */
  try {
    const divMap = await MentorAPI.divisions();
    const divSel   = document.getElementById('divFilter');
    const batchSel = document.getElementById('batchFilter');

    if (divSel && batchSel) {
      // Populate division options
      Object.keys(divMap).sort().forEach(div => {
        const opt = document.createElement('option');
        opt.value = div; opt.textContent = 'Division ' + div;
        divSel.appendChild(opt);
      });

      divSel.addEventListener('change', () => {
        viewDiv   = divSel.value;
        viewBatch = '';
        batchSel.innerHTML = '<option value="">All Batches</option>';
        if (viewDiv && divMap[viewDiv]) {
          divMap[viewDiv].forEach(b => {
            const opt = document.createElement('option');
            opt.value = b; opt.textContent = 'Batch ' + b;
            batchSel.appendChild(opt);
          });
        }
        loadStudents();
      });

      batchSel.addEventListener('change', () => {
        viewBatch = batchSel.value;
        loadStudents();
      });
    }
  } catch(err) { showToast('Could not load divisions: '+err.message, true); }

  /* ── Search & risk filter ── */
  document.getElementById('searchInp').addEventListener('input', function() {
    searchQ = this.value.toLowerCase(); renderTable();
  });
  document.querySelectorAll('.ft').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.ft').forEach(b => b.classList.remove('on'));
      this.classList.add('on');
      riskFilter = this.getAttribute('data-risk');
      renderTable();
    });
  });

  loadStudents();
});

async function loadStudents() {
  const tbody = document.getElementById('stuBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:28px;color:#aaa;font-weight:700">
    <div style="display:inline-block;width:26px;height:26px;border:4px solid #e8ddd0;border-top-color:#1A1A1A;border-radius:50%;animation:spin 0.7s linear infinite"></div>
    <div style="margin-top:8px">Loading students...</div></td></tr>`;
  if (!document.getElementById('_spin')) {
    const s = document.createElement('style'); s.id='_spin';
    s.textContent='@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }
  try {
    const params = {};
    if (viewDiv)   params.division = viewDiv;
    if (viewBatch) params.batch    = viewBatch;
    ALL_STUDENTS = await MentorAPI.batch(params);
    renderTable();
  } catch(err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#e74c3c;font-weight:800">❌ ${err.message}</td></tr>`;
    showToast(err.message, true);
  }
}

function renderTable() {
  const tbody = document.getElementById('stuBody');
  if (!tbody) return;
  const filtered = ALL_STUDENTS.filter(s =>
    ((s.name||'').toLowerCase().includes(searchQ) || (s.prn||'').toLowerCase().includes(searchQ)) &&
    (riskFilter === 'all' || s.riskLevel === riskFilter)
  );
  document.getElementById('totalCount').textContent = filtered.length;
  document.getElementById('lowCount').textContent   = ALL_STUDENTS.filter(s=>s.riskLevel==='low').length;
  document.getElementById('medCount').textContent   = ALL_STUDENTS.filter(s=>s.riskLevel==='medium').length;
  document.getElementById('highCount').textContent  = ALL_STUDENTS.filter(s=>s.riskLevel==='high').length;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;font-weight:700;color:#aaa">No students found 🎈</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(s => {
    const ini = (s.name||'S').split(' ').map(x=>x[0]).join('').substring(0,2).toUpperCase();
    const rc  = riskColour(s.riskLevel);
    const rl  = s.riskLevel==='high'?'⚠ High':s.riskLevel==='medium'?'~ Medium':'✓ Low';
    const pct = s.avgPercentage||0;
    const ac  = pct<40?'#E8856A':pct<60?'#f0b96a':'#7ECAC8';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;background:${rc};border:2px solid #1A1A1A;border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:'Fredoka One',cursive;font-size:13px;flex-shrink:0">${ini}</div>
        <span style="font-weight:800">${s.name}</span>
      </div></td>
      <td style="font-size:12px;color:#888;font-weight:700">${s.prn}</td>
      <td><span style="font-weight:800">${s.division}</span></td>
      <td><span style="font-weight:800">${s.batch}</span></td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div style="width:60px;height:9px;background:#e8ddd0;border-radius:100px;border:2px solid #ccc;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${ac};border-radius:100px"></div>
        </div>
        <span style="font-family:'Fredoka One',cursive;color:${ac}">${pct.toFixed?pct.toFixed(1):pct}%</span>
      </div></td>
      <td style="font-family:'Fredoka One',cursive;font-size:17px;color:${rc}">${s.sgpi!==null?s.sgpi:'KT'}</td>
      <td><span class="risk-badge risk-${s.riskLevel}">${rl}</span></td>
      <td><button class="btn btn-white" style="padding:7px 14px;font-size:12px" onclick="viewStudent(${s.id},'${s.name}')">View →</button></td>
    </tr>`;
  }).join('');
}

function viewStudent(id, name) {
  sessionStorage.setItem('viewStudentId', id);
  sessionStorage.setItem('viewStudentName', name);
  window.location.href = 'mentor-student.html';
}