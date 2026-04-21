document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin('student')) return;

  /* ── Greeting ── */
  const g = document.getElementById('greeting');
  if (g) g.textContent = greeting();

  fillSidebarUser();

  const user = Auth.user();

  /* ── Update name in topbar ── */
  const nameSpan = document.getElementById('student-name');
  if (nameSpan && user) nameSpan.textContent = user.name ? user.name.split(' ')[0] : 'Student';

  /* ── Update subtitle with division/batch ── */
  const subEl = document.getElementById('student-info');
  if (subEl && user) subEl.textContent = `Division ${user.division} · Batch ${user.batch}`;

  /* ── Load quick stats from API ── */
  try {
    const [risk, credits] = await Promise.all([
      StudentAPI.dropoutRisk(),
      StudentAPI.credits(),
    ]);

    const qsCredits = document.getElementById('qs-credits');
    const qsRisk    = document.getElementById('qs-risk');
    const qsSgpi    = document.getElementById('qs-sgpi');

    if (qsCredits) {
      const totalCr = (credits && (credits.totalEarned ?? credits.totalCredits)) || 0;
      qsCredits.textContent = totalCr + ' credits';
    }
    if (qsSgpi)    qsSgpi.textContent    = risk.sgpi !== null ? risk.sgpi : 'KT';
    if (qsRisk) {
      const lvl = risk.riskLevel;
      qsRisk.textContent  = lvl === 'high' ? '⚠ High Risk' : lvl === 'medium' ? '~ Medium Risk' : '✓ Low Risk';
      qsRisk.style.color  = riskColour(lvl);
    }
  } catch (err) {
    showToast('Could not load stats: ' + err.message, true);
  }
});