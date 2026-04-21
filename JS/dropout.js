document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin('student')) return;
  fillSidebarUser();

  try {
    // Fetch both in parallel
    const [data, attData] = await Promise.all([
      StudentAPI.dropoutRisk(),
      StudentAPI.attendance().catch(() => null),  // graceful fallback if no data
    ]);
    const pct  = data.riskScore;
    const lvl  = data.riskLevel;
    const col  = riskColour(lvl);

    /* ── Gauge ── */
    const arc = document.getElementById('gaugeArc');
    if (arc) {
      arc.setAttribute('data-pct', pct);
      const total = 283;
      arc.style.strokeDasharray  = total;
      arc.style.strokeDashoffset = total * (1 - pct / 100);
    }

    const gaugeNum  = document.getElementById('gauge-num');
    const gaugeDesc = document.getElementById('gauge-desc');
    if (gaugeNum) { gaugeNum.textContent = pct + '%'; gaugeNum.style.color = col; }
    if (gaugeDesc) {
      const icons = { low:'🎉 Low Risk — You\'re on track!', medium:'⚠ Medium Risk — Needs attention', high:'🔴 High Risk — Take action now' };
      gaugeDesc.textContent = icons[lvl];
      gaugeDesc.style.color = lvl === 'low' ? '#27ae60' : lvl === 'medium' ? '#e67e22' : '#e74c3c';
    }

    /* ── Risk factor rows ── */
    const tips = [];
    const { factors } = data;
    const rfAtt  = document.getElementById('rf-att');
    const rfMarks = document.getElementById('rf-marks');
    const rfKt  = document.getElementById('rf-kt');
    const rfSgpi = document.getElementById('rf-sgpi');

    // Attendance row — from separate API call
    if (rfAtt) {
      if (attData && attData.overall && attData.overall.total > 0) {
        const attPct = attData.overall.percentage;
        const attOk  = attPct >= 75;
        rfAtt.textContent = attPct + '% overall ' + (attOk ? '✓ Good' : '✗ Below 75%');
        rfAtt.className   = attPct >= 75 ? 'rf-ok' : attPct >= 60 ? 'rf-warn' : 'rf-bad';

        // Also add attendance tip if low
        if (!attOk) {
          tips.unshift({
            title: '📅 Attendance Below 75%',
            text: `Your overall attendance is ${attPct}%. Falling below 75% bars you from sitting the ESE — which automatically results in a KT even without failing the exam.`,
          });
        }
      } else {
        rfAtt.textContent = 'No attendance data';
        rfAtt.className   = 'rf-warn';
      }
    }

    if (rfMarks) {
      const ok = factors.avgMarks >= 50;
      rfMarks.textContent = factors.avgMarks + '% ' + (ok ? '✓ Good' : '⚠ Needs work');
      rfMarks.className   = ok ? 'rf-ok' : 'rf-warn';
    }
    if (rfKt) {
      const ktOk = factors.ktSubjects === 0;
      rfKt.textContent = ktOk ? 'None ✓' : factors.ktSubjects + ' subject(s) KT ✗';
      rfKt.className   = ktOk ? 'rf-ok' : 'rf-warn';
    }
    if (rfSgpi) {
      rfSgpi.textContent = data.sgpi !== null ? 'SGPI: ' + data.sgpi + ' ✓' : 'KT present — SGPI blocked ✗';
      rfSgpi.className   = data.sgpi !== null ? 'rf-ok' : 'rf-warn';
    }

    // tips defined below
    if (factors.ktSubjects > 0) tips.push({
      title: '🚨 Clear Your KT Subjects',
      text: `You have ${factors.ktSubjects} subject(s) with KT. Clearing these is the highest priority — KTs block your SGPI and significantly raise your risk score.`
    });
    if (factors.avgMarks < 50) tips.push({
      title: '📖 Improve Your Average Marks',
      text: `Your average is ${factors.avgMarks}%. Focus on your weakest subjects first and aim for above 50% in each to bring your overall score up.`
    });
    if (factors.avgMarks >= 50 && factors.avgMarks < 65) tips.push({
      title: '📈 Push Your Marks Higher',
      text: `You're passing at ${factors.avgMarks}% average, but there's room to improve. Targeting 70%+ in your stronger subjects will help raise your SGPI.`
    });
    if (data.sgpi === null) tips.push({
      title: '🎯 Fix SGPI Calculation',
      text: 'Your SGPI cannot be calculated because of KT subjects. Once cleared, your SGPI will be calculated automatically.'
    });
    tips.push({
      title: '📅 Maintain Attendance',
      text: 'Keeping attendance above 75% is required to sit for exams. Consistent attendance directly lowers your risk score.'
    });
    if (tips.length < 4) tips.push({
      title: '✅ Keep It Up',
      text: 'Your academic performance looks reasonable. Stay consistent with submissions and attendance to keep your risk low.'
    });

    const tipsGrid = document.getElementById('tips-grid');
    if (tipsGrid) {
      tipsGrid.innerHTML = tips.slice(0, 4).map(t => `
        <div class="tip-card">
          <div class="tip-title">${t.title}</div>
          <div class="tip-text">${t.text}</div>
        </div>`).join('');
    }

  } catch (err) {
    showToast(err.message, true);
    const arc = document.getElementById('gaugeArc');
    if (arc) { arc.style.strokeDasharray = 283; arc.style.strokeDashoffset = 283; }
  }
});