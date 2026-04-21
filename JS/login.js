document.addEventListener('DOMContentLoaded', () => {
  /* ── Tab switcher ── */
  const slider = document.getElementById('tabSlider');
  const tS = document.getElementById('tStudent');
  const tM = document.getElementById('tMentor');
  const sP = document.getElementById('sPanel');
  const mP = document.getElementById('mPanel');

  tS.addEventListener('click', () => {
    slider.classList.remove('mentor-side');
    tS.classList.add('on');  tM.classList.remove('on');
    sP.classList.add('on');  mP.classList.remove('on');
  });
  tM.addEventListener('click', () => {
    slider.classList.add('mentor-side');
    tM.classList.add('on');  tS.classList.remove('on');
    mP.classList.add('on');  sP.classList.remove('on');
  });

  /* ── Student login ── */
  document.getElementById('studentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const emailInput = e.target.querySelector('input[type="email"]');
    const btn = e.target.querySelector('.fsub-btn');
    const email = emailInput.value.trim();

    btn.textContent = 'Checking...';
    btn.disabled = true;

    try {
      const data = await apiLogin(email);
      if (data.role !== 'student') {
        showToast('This email belongs to a mentor. Use the Mentor tab.', true);
        btn.textContent = 'Continue as Student 🚀';
        btn.disabled = false;
        return;
      }
      btn.textContent = 'Welcome! Redirecting...';
      // login.html and home.html are in the same HTML folder
      setTimeout(() => { window.location.href = 'home.html'; }, 600);
    } catch (err) {
      showToast('❌ ' + err.message, true);
      btn.textContent = 'Continue as Student 🚀';
      btn.disabled = false;
    }
  });

  /* ── Mentor login ── */
  document.getElementById('mentorForm').addEventListener('submit', async e => {
    e.preventDefault();
    const emailInput = e.target.querySelector('input[type="email"]');
    const btn = e.target.querySelector('.fsub-btn');
    const email = emailInput.value.trim();

    btn.textContent = 'Checking...';
    btn.disabled = true;

    try {
      const data = await apiLogin(email);
      
      if (data.role !== 'mentor') {
        showToast('This email belongs to a student. Use the Student tab.', true);
        btn.textContent = 'Continue as Mentor 🎯';
        btn.disabled = false;
        return;
      } 
      localStorage.setItem("token", data.token);
      localStorage.setItem("mentorName", data.user.name);
      btn.textContent = 'Welcome! Redirecting...';
      // login.html and mentor-home.html are in the same HTML folder
      setTimeout(() => { window.location.href = 'mentor-home.html'; }, 600);
    } catch (err) {
      showToast('❌ ' + err.message, true);
      btn.textContent = 'Continue as Mentor 🎯';
      btn.disabled = false;
    }
  });
});