document.addEventListener('DOMContentLoaded', () => {
  fillSidebarUser && fillSidebarUser();
});

function authFetch(url, options = {}) {
  const token = localStorage.getItem("ep_token");

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      ...(options.headers || {})
    }
  });
}

// --- Update Batches ---
function updateBatches(){
  const div = document.getElementById("division").value;
  const batch = document.getElementById("batch");
  batch.innerHTML = '<option value="">Select Batch</option>';
  if(!div) return;

  for(let i=1;i<=3;i++){
    const opt = document.createElement("option");
    opt.value = div+i;
    opt.textContent = div+i;
    batch.appendChild(opt);
  }
}

// --- Load Students ---
async function loadStudents(){
  const div = document.getElementById("division").value;
  const batch = document.getElementById("batch").value;

  if(!div || !batch){
    alert("Select division & batch");
    return;
  }

  let students = [];
  let batchSubjects = [];

  try{
    const res = await authFetch(`http://localhost:3001/api/students-overview?division=${div}&batch=${batch}`);
    students = await res.json();

    const res2 = await authFetch(`http://localhost:3001/api/batch-subjects?division=${div}&batch=${batch}`);
    batchSubjects = await res2.json();

  }catch(e){
    showToast("Backend error");
    return;
  }

  renderStudents(students);
  renderCharts(students, batchSubjects);
  await loadAtRiskStudents(students);
}

// --- Render Students ---
function renderStudents(students){
  const tbody = document.getElementById("students");
  tbody.innerHTML = "";

  students.forEach(s=>{
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${s.prn}</td>
      <td>${s.name}</td>
      <td>${s.division}</td>
      <td>${s.batch}</td>
      <td>${createRingHTML(s.percentage || 0)}</td>
    `;

    tr.onclick = ()=>toggleSubjectsRow(tr, s.id);
    tbody.appendChild(tr);
  });
}

// --- Charts + Stats ---
function renderCharts(students, batchSubjects){

  const validStudents = students.filter(s => s.percentage != null && !isNaN(parseFloat(s.percentage)));
  const avg = validStudents.length
    ? Math.round(validStudents.reduce((a,b) => a + parseFloat(b.percentage||0), 0) / validStudents.length)
    : 0;

  const above = students.filter(s=>s.percentage>=75).length;
  const below = students.filter(s=>s.percentage<75).length;

  let bestSubject = { subject: '—', percent: 0 };
  if(batchSubjects.length){
    bestSubject = batchSubjects.reduce((best, s) => (s.percent||0) > (best.percent||0) ? s : best, batchSubjects[0]);
  }

  document.getElementById("stat-avg").textContent = avg + "%";
  document.getElementById("stat-above").textContent = above;
  document.getElementById("stat-below").textContent = below;
  document.getElementById("stat-best").textContent = bestSubject.subject;
  document.getElementById("stat-best").title = bestSubject.percent + "%";

  const bestCard = document.getElementById("stat-best").closest(".stat-card");
  if(bestCard){
    let sub = bestCard.querySelector(".stat-best-sub");
    if(!sub){
      sub = document.createElement("div");
      sub.className = "stat-lbl stat-best-sub";
      bestCard.querySelector(".stat-val").after(sub);
    }
    sub.textContent = bestSubject.percent + "% attendance";
  }

  const bars = document.getElementById("subject-bars");
  bars.innerHTML = "";

  batchSubjects.forEach(sub=>{
    const p = sub.percent;
    const color = p>=75 ? "#3ecfb2" : p>=50 ? "#f39c12" : "#e74c3c";

    bars.innerHTML += `
      <div class="subject-row-bar">
        <div class="subject-name">${sub.subject}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${p}%;background:${color}"></div>
        </div>
        <div class="subject-pct">${p}%</div>
      </div>
    `;
  });

  const chart = document.getElementById("bar-chart");
  chart.innerHTML = "";

  // BAR_H is the pure bar drawing zone — labels live outside this
  const BAR_H = 160;
  const PCT_H = 20;  // height reserved for % label above bar
  const LBL_H = 28;  // height reserved for subject label below bar

  // Wrapper: flex column, full chart area
  chart.style.cssText = "display:flex;align-items:flex-end;gap:10px;padding:0 4px;position:relative;height:" + (BAR_H + PCT_H + LBL_H) + "px;";

  // Inner bar-only zone — threshold line lives here
  const barZone = document.createElement("div");
  barZone.style.cssText = "position:absolute;left:0;right:0;bottom:" + LBL_H + "px;height:" + BAR_H + "px;pointer-events:none;z-index:10;";

  const lineTopPx = BAR_H * (1 - 75 / 100); // = BAR_H * 0.25 from top of bar zone
  const line = document.createElement("div");
  line.className = "threshold-line";
  line.style.top = lineTopPx + "px";
  barZone.appendChild(line);
  chart.appendChild(barZone);

  batchSubjects.forEach(sub => {
    const p = parseFloat(sub.percent) || 0;
    const barH = Math.round((p / 100) * BAR_H);

    const col = document.createElement("div");
    col.className = "bar-col";
    col.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:0;flex:1;min-width:0;height:" + (BAR_H + PCT_H + LBL_H) + "px;justify-content:flex-end;";
    col.innerHTML = `
      <div class="bar-col-pct" style="height:${PCT_H}px;display:flex;align-items:center;">${Math.round(p)}%</div>
      <div class="bar-col-fill" style="height:${barH}px;background:${p>=75?'#3ecfb2':'#e74c3c'}"></div>
      <div class="bar-col-lbl" style="height:${LBL_H}px;display:flex;align-items:center;justify-content:center;">${sub.subject}</div>
    `;
    chart.appendChild(col);
  });
}

// --- Subject Row ---
async function toggleSubjectsRow(row, studentId){
  const next = row.nextElementSibling;
  if(next && next.classList.contains("subject-row")){
    next.remove();
    return;
  }

  document.querySelectorAll(".subject-row").forEach(r=>r.remove());

  let subjects = [];
  try{
    const res = await authFetch(`http://localhost:3001/api/student-subjects/${studentId}`);
    subjects = await res.json();
  }catch(e){ return; }

  const newRow = document.createElement("tr");
  newRow.classList.add("subject-row");

  const td = document.createElement("td");
  td.colSpan = 5;

  td.innerHTML = `
    <div class="subject-container">
      ${subjects.map(sub=>`
          <div class="subject-box" onclick="loadDetails(this,${studentId},'${sub.subject}')">
          ${createRingHTML(sub.percentage || sub.percent)}
          <div>${sub.subject}</div>
        </div>
      `).join("")}
    </div>
    <div class="details-table-area"></div>
  `;

  newRow.appendChild(td);
  row.parentNode.insertBefore(newRow,row.nextSibling);
}

async function loadDetails(el, studentId, subject){
  document.querySelectorAll(".subject-box").forEach(b=>b.classList.remove("selected"));
  el.classList.add("selected");

  let data = [];
  try{
    const res = await authFetch(`http://localhost:3001/api/student-details/${studentId}?subject=${encodeURIComponent(subject)}`);
    data = await res.json();
  }catch(e){ return; }

  const td = el.closest("td");
  let detailsArea = td.querySelector(".details-table-area");
  if(!detailsArea){
    detailsArea = document.createElement("div");
    detailsArea.className = "details-table-area";
    td.appendChild(detailsArea);
  }
  detailsArea.innerHTML = "";

  if(!data || data.length === 0){
    detailsArea.innerHTML = `<div style="padding:12px;color:#aaa;font-weight:700;text-align:center;">No records found</div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;padding:0 8px 8px;";

  const chunkSize = 10;
  const sorted = [...data].sort((a,b) => new Date(b.date)-new Date(a.date));
  for(let i = 0; i < sorted.length; i += chunkSize){
    const chunk = sorted.slice(i, i + chunkSize);

    const card = document.createElement("div");
    card.style.cssText = `
      background:#fff;
      border:1.5px solid #eee;
      border-radius:10px;
      padding:0;
      overflow:hidden;
      box-shadow:0 2px 8px rgba(0,0,0,0.06);
      flex:1 1 180px;
      max-width:220px;
    `;

    card.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:6px 10px;text-align:left;font-weight:900;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:.4px;">Date</th>
            <th style="padding:6px 10px;text-align:center;font-weight:900;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:.4px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${chunk.map(d=>`
            <tr style="border-bottom:1px dashed #f0f0f0;">
              <td style="padding:5px 10px;font-weight:600;color:#333;">${new Date(d.date).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'})}</td>
              <td style="padding:5px 10px;text-align:center;font-weight:800;color:${d.status==='Present'?'#27ae60':'#e74c3c'};">${d.status}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    wrapper.appendChild(card);
  }

  detailsArea.appendChild(wrapper);
}

// --- Below 75 Alert Table ---
async function loadAtRiskStudents(students){
  const tbody = document.getElementById("attAlertBody");
  tbody.innerHTML = "";

  for(const s of students){
    const safeId = 'btn-att-' + s.id;
    let subjects = [];

    try{
      const res = await authFetch(`http://localhost:3001/api/student-subjects/${s.id}`);
      subjects = await res.json();
    }catch(e){}

    const lowSubjects = subjects
      .filter(sub => (sub.percent || sub.percentage) < 75)
      .map(sub => `${sub.subject} (${sub.percent || sub.percentage}%)`)
      .slice(0,2)
      .join(", ");

    if((s.percentage || 0) < 75 || subjects.some(sub => (sub.percent || sub.percentage) < 75)){
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${s.name}</td>
        <td>${s.prn}</td>
        <td>${createRingHTML(s.percentage,40)}</td>
        <td style="font-size:12px; max-width:140px;">${lowSubjects || '-'}</td>
        <td>
          <button class="alert-pill" id="${safeId}"
            onclick="sendAttendanceAlert('${s.name}', '${s.email || ''}', ${s.percentage || 0}, ${s.id}, '${safeId}')">
            Send Alert
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    }
  }
}

// --- Ring ---
function createRingHTML(p, size=52, lg=false){
  const pct = Math.round(p)||0;
  const r = (size/2)-6;
  const circ = 2*Math.PI*r;
  const dash = (pct/100)*circ;

  return `
  <svg width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="#eee" stroke-width="6" fill="none"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}"
      stroke="${pct>=75?'#27ae60':pct>=50?'#f39c12':'#e74c3c'}"
      stroke-width="6"
      stroke-dasharray="${dash} ${circ}"
      transform="rotate(-90 ${size/2} ${size/2})"
      fill="none"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" font-weight="bold">
      ${pct}%
    </text>
  </svg>`;
}

// --- Toast ---
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  t.style.opacity = "1";

  setTimeout(()=>{
    t.style.opacity = "0";
    setTimeout(()=>t.style.display="none",300);
  },2000);
}

// --- Send Attendance Alert ---
async function sendAttendanceAlert(name, email, attendance, student_id, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

  try {
    const res = await authFetch("http://localhost:3001/api/send-alert", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        attendance,
        student_id,
        type: "attendance"
      })
    });

    const data = await res.json();

    if (data.success) {
      if (btn) { btn.textContent = 'Sent ✓'; btn.classList.add('sent'); }
      showToast("📧 Attendance alert sent to " + name);
    } else {
      if (btn) { btn.textContent = 'Send Alert'; btn.disabled = false; }
      showToast("❌ Failed: " + (data.reason || 'Unknown error'));
    }

  } catch (err) {
    console.error(err);
    if (btn) { btn.textContent = 'Send Alert'; btn.disabled = false; }
    showToast("❌ Server error");
  }
}
function fillSidebarUser() {
  const token = localStorage.getItem("ep_token");
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    const nameEl = document.querySelector(".u-name");
    const roleEl = document.querySelector(".u-role");
    const avaEl  = document.querySelector(".u-ava");

    if (nameEl) nameEl.textContent = payload.name || "Unknown";
    if (roleEl) roleEl.textContent = payload.role === 'mentor' ? 'Mentor' : (payload.role || "User");
    if (avaEl && payload.name) {
      avaEl.textContent = payload.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    }

  } catch (err) {
    console.error("Sidebar user error:", err);
  }
}