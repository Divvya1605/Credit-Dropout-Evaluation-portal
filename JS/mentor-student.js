let STUDENT_DATA = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin('mentor')) return;
  fillSidebarUser();

  const id   = sessionStorage.getItem('viewStudentId');
  const name = sessionStorage.getItem('viewStudentName');

  const titleEl = document.getElementById('stuTitle');
  const subEl   = document.getElementById('stuSub');

  if (!id) {
    if (titleEl) titleEl.textContent = 'Student Overview';
    if (subEl)   subEl.textContent   = 'No student selected. Please go back to the batch list.';
    return;
  }

  if (titleEl) titleEl.textContent = name ? name : 'Student Overview';

  try {
    STUDENT_DATA = await MentorAPI.student(id);
    renderStudent(STUDENT_DATA);
  } catch (err) {
    if (subEl) subEl.textContent = 'Could not load student data: ' + err.message;
    showToast(err.message, true);
  }
});

function renderStudent(data) {
  const { student, semesters, cgpi, riskScore, riskLevel, ktCount, avgPercentage } = data;

  const subEl = document.getElementById('stuSub');
  if (subEl && student) {
    subEl.textContent = `${student.prn} · Div ${student.division} · Batch ${student.batch}`;
  }

  // Quick stats
  const qCgpi  = document.getElementById('q-cgpi');
  const qCred  = document.getElementById('q-credits');
  const qRisk  = document.getElementById('q-risk');
  const qKt    = document.getElementById('q-kt');

  if (qCgpi) qCgpi.textContent = cgpi !== null ? cgpi : 'KT';

  let totalEarned = 0;
  semesters.forEach(s => {
    const earned = s.hasKT
      ? s.subjects.filter(x => !x.kt).reduce((a,x)=>a+x.credit,0)
      : s.totalCredits;
    totalEarned += earned;
  });
  if (qCred) qCred.textContent = totalEarned;

  if (qRisk) {
    const label = riskLevel === 'high' ? 'High' : riskLevel === 'medium' ? 'Medium' : 'Low';
    qRisk.textContent = label;
    qRisk.style.color = riskColour(riskLevel);
  }

  if (qKt) qKt.textContent = ktCount ?? 0;

  // Semester summary table
  const semBody = document.getElementById('semSummaryBody');
  if (semBody) {
    if (!semesters.length) {
      semBody.innerHTML = `<tr><td colspan="4" style="padding:14px;color:#aaa;font-weight:700">No semester data.</td></tr>`;
    } else {
      semBody.innerHTML = semesters.map(s => {
        const status = s.hasKT
          ? '<span class="pill pill-coral">KT Present</span>'
          : '<span class="pill pill-teal">Clear ✓</span>';
        return `<tr>
          <td><b>Semester ${s.semester}</b></td>
          <td>${s.totalCredits}</td>
          <td>${s.sgpi !== null ? s.sgpi : 'KT'}</td>
          <td>${status}</td>
        </tr>`;
      }).join('');
    }
  }

  // Latest semester subject details
  const latest = semesters[semesters.length - 1];
  const semTitle = document.getElementById('semDetailTitle');
  const semBody2 = document.getElementById('semDetailBody');

  if (semTitle && latest) {
    semTitle.textContent = `Semester ${latest.semester} — Subject Details`;
  }

  if (semBody2) {
    if (!latest || !latest.subjects.length) {
      semBody2.innerHTML = `<tr><td colspan="6" style="padding:14px;color:#aaa;font-weight:700">No subject data.</td></tr>`;
    } else {
      semBody2.innerHTML = latest.subjects.map(s => {
        const typeLabel =
          s.type === 'theory'
            ? 'Theory'
            : s.type === 'lab2'
              ? 'Lab'
              : 'Practical';
        const status = s.kt
          ? '<span style="color:#e74c3c;font-weight:800">KT ✗</span>'
          : '<span style="color:#27ae60;font-weight:800">Pass ✓</span>';
        const cpText = s.kt ? '--' : (s.creditPoints ?? '--');
        return `<tr style="${s.kt?'background:#fff0f0':''}">
          <td><b>${s.subject_name}</b></td>
          <td>${typeLabel}</td>
          <td>${s.credit}</td>
          <td><span class="grade" style="background:${gradeColour(s.grade)};color:#fff;border:2px solid #1A1A1A;border-radius:8px;padding:3px 10px;font-weight:800;font-size:13px">${s.grade}</span></td>
          <td>${cpText}</td>
          <td>${status}</td>
        </tr>`;
      }).join('');
    }
  }
}
