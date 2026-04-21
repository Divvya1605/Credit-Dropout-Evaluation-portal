document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin('mentor')) return;
  fillSidebarUser();
  const g = document.getElementById('greeting');
  if (g) g.textContent = greeting();
  const user = Auth.user();
  const nameEl = document.getElementById('mentor-name');
  if (nameEl && user) nameEl.textContent = user.name || user.email || 'Mentor';
  try {
    const stats = await MentorAPI.stats();
    const mqsTotal = document.getElementById('mqs-total');
    const mqsRisk  = document.getElementById('mqs-risk');
    const mqsSgpi  = document.getElementById('mqs-sgpi');
    if (mqsTotal) mqsTotal.textContent = stats.totalStudents;
    if (mqsRisk)  mqsRisk.textContent  = (stats.riskBreakdown.high||0) + (stats.riskBreakdown.medium||0);
    if (mqsSgpi)  mqsSgpi.textContent  = stats.avgSGPI !== null ? stats.avgSGPI : 'KT';
  } catch(err) { showToast('Could not load stats: '+err.message, true); }
});
