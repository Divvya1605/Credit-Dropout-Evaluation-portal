document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin('mentor')) return;
  fillSidebarUser();
  const highList = document.getElementById('highRiskList');
  const medList  = document.getElementById('medRiskList');
  const highCount= document.getElementById('high-count');
  const medCount = document.getElementById('med-count');
  
  try {
    const students = await MentorAPI.atRisk();
    const high = students.filter(s=>s.riskLevel==='high');
    const med  = students.filter(s=>s.riskLevel==='medium');
    if (highCount) highCount.textContent = high.length;
    if (medCount)  medCount.textContent  = med.length;
    if (highList) highList.innerHTML = high.length ? high.map(card).join('') : '<p style="color:#aaa;font-weight:700;padding:16px">No high risk students 🎉</p>';
    if (medList)  medList.innerHTML  = med.length  ? med.map(card).join('') : '<p style="color:#aaa;font-weight:700;padding:16px">No medium risk students</p>';
  } catch(err) {
    if (highList) highList.innerHTML = `<p style="color:#e74c3c;font-weight:800;padding:16px">❌ ${err.message}</p>`;
    showToast(err.message, true);
  }
});

function card(s) {
  const safeId = 'btn-' + s.id;
  const col = riskColour(s.riskLevel);
  const ini = (s.name||'S').split(' ').map(x=>x[0]).join('').substring(0,2).toUpperCase();
  const factors = [];
  if (s.avgPercentage < 50) factors.push(`Avg Marks: ${s.avgPercentage}%`);
  if (s.ktCount > 0)        factors.push(`KT Subjects: ${s.ktCount}`);
  if (s.sgpi === null)      factors.push('SGPI Blocked');
  if (!factors.length)      factors.push(`Risk Score: ${s.riskScore}%`);
  const tags = factors.map(f=>`<span class="rf-tag" style="background:${col};border:2px solid #1A1A1A">${f}</span>`).join('');

  // FIX: pass s.email and s.id so backend can look up mentor and send email
  return `<div class="risk-card" style="margin-bottom:14px;flex-direction:column;align-items:stretch;background:var(--white)">
    <div style="display:flex;align-items:center;gap:12px;width:100%">
      <div class="rc-ava" style="background:${col}">${ini}</div>
      <div class="rc-info">
        <div class="rc-name">${s.name}</div>
        <div class="rc-detail">${s.prn} · Div ${s.division} · Batch ${s.batch} · Avg ${s.avgPercentage?s.avgPercentage.toFixed(1):'—'}% · SGPI ${s.sgpi!==null?s.sgpi:'KT'}</div>
      </div>
      <div class="rc-right">
        <div class="rc-pct" style="color:${col}">${s.riskScore}%</div>
        <button class="alert-pill" id="${safeId}" onclick="sendAtriskAlert('${s.name}','${s.email}',${s.id},'${safeId}')">Send Alert</button>
      </div>
    </div>
    <div class="rf-factors" style="margin-top:12px;padding-top:12px;border-top:2px dashed #e8ddd0">${tags}</div>
  </div>`;
}

// FIX: accepts email + student_id so they reach the backend
async function sendAtriskAlert(name, email, student_id, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

  try {
    const res = await fetch("http://localhost:3001/api/send-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        student_id,
        type: "risk"
      })
    });

    const data = await res.json();

    if (data.success) {
      if (btn) { btn.textContent = 'Sent ✓'; btn.classList.add('sent'); }
      showToast('📧 Risk alert sent to ' + name);
    } else {
      if (btn) { btn.textContent = 'Send Alert'; btn.disabled = false; }
      showToast('❌ Failed: ' + (data.reason || 'Unknown error'));
    }

  } catch (err) {
    console.error(err);
    if (btn) { btn.textContent = 'Send Alert'; btn.disabled = false; }
    showToast('❌ Server error');
  }
}