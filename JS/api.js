/* ================================================================
   api.js  —  EduPortal shared API helper
   Must be loaded BEFORE any page JS via <script src="api.js">
   ================================================================ */

const API_BASE = 'http://localhost:3001/api';

/* ── Token / session helpers ───────────────────────────────── */
const Auth = {
  save(token, user, role) {
    localStorage.setItem('ep_token', token);
    localStorage.setItem('ep_user',  JSON.stringify(user));
    localStorage.setItem('ep_role',  role);
  },
  token() { return localStorage.getItem('ep_token'); },
  user()  { try { return JSON.parse(localStorage.getItem('ep_user')); } catch(e){ return null; } },
  role()  { return localStorage.getItem('ep_role'); },
  clear() { ['ep_token','ep_user','ep_role'].forEach(k => localStorage.removeItem(k)); },
  loggedIn() { return !!this.token(); },
};

/* ── Core fetch wrapper ────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token()) headers['Authorization'] = 'Bearer ' + Auth.token();
  let res;
  try {
    res = await fetch(API_BASE + path, { ...opts, headers });
  } catch (e) {
    throw new Error('Cannot reach server. Is the backend running on port 3001?');
  }
  if (res.status === 401) { Auth.clear(); window.location.href = '/HTML/login.html'; return; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

/* ── Auth ──────────────────────────────────────────────────── */
async function apiLogin(email) {
  const data = await apiFetch('/auth/login', {
    method: 'POST', body: JSON.stringify({ email })
  });
  Auth.save(data.token, data.user, data.role);
  return data;
}

/* ── Student API calls ─────────────────────────────────────── */
const StudentAPI = {
  me()          { return apiFetch('/student/me'); },
  marks()       { return apiFetch('/student/marks'); },
  credits()     { return apiFetch('/student/credits'); },
  dropoutRisk() { return apiFetch('/student/dropout-risk'); },
};

/* ── Mentor API calls ──────────────────────────────────────── */
const MentorAPI = {
  batch(params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch('/mentor/batch' + q);
  },
  student(id)  { return apiFetch('/mentor/batch/' + id); },
  atRisk()     { return apiFetch('/mentor/at-risk'); },
  stats(params){
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch('/mentor/stats' + q);
  },
};

/* ── Page guard ────────────────────────────────────────────── */
function requireLogin(role) {
  if (!Auth.loggedIn()) { window.location.href = '/HTML/login.html'; return false; }
  if (role && Auth.role() !== role) {
    window.location.href = Auth.role() === 'mentor' ? '/HTML/mentor-home.html' : '/HTML/home.html';
    return false;
  }
  return true;
}

/* ── Logout ────────────────────────────────────────────────── */
function doLogout() { Auth.clear(); window.location.href = '../HTML/login.html'; }

/* ── Time greeting ─────────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/* ── Grade colour ──────────────────────────────────────────── */
function gradeColour(g) {
  return {O:'#16a085','A+':'#27ae60',A:'#2980b9','B+':'#8e44ad',B:'#d4a017',C:'#e67e22',P:'#7f8c8d',F:'#e74c3c'}[g] || '#888';
}

/* ── Risk colour ───────────────────────────────────────────── */
function riskColour(level) {
  return level === 'high' ? '#E8856A' : level === 'medium' ? '#F5D547' : '#7ECAC8';
}

/* ── Toast ─────────────────────────────────────────────────── */
function showToast(msg, isError) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    Object.assign(t.style, {
      position:'fixed',bottom:'28px',right:'28px',zIndex:'9999',
      fontFamily:"'Nunito',sans-serif",fontWeight:'800',fontSize:'14px',
      padding:'13px 20px',borderRadius:'14px',maxWidth:'340px',display:'none',
    });
    document.body.appendChild(t);
  }
  const bc = isError ? '#E8856A' : '#F5D547';
  t.style.cssText += `;background:#1A1A1A;color:#fff;border:3px solid ${bc};box-shadow:4px 4px 0 ${bc}`;
  t.innerText = msg;
  t.style.display = 'block';
  clearTimeout(window._tt);
  window._tt = setTimeout(() => { t.style.display = 'none'; }, 3500);
}

/* ── Update sidebar user box with real data ────────────────── */
function fillSidebarUser() {
  const u = Auth.user();
  if (!u) return;
  const nameEl = document.querySelector('.u-name');
  const roleEl = document.querySelector('.u-role');
  const avaEl  = document.querySelector('.u-ava');
  if (nameEl) nameEl.textContent = u.name || u.email || 'User';
  if (roleEl) roleEl.textContent = u.division ? `Div ${u.division} · Batch ${u.batch}` : 'Mentor';
  if (avaEl)  avaEl.textContent  = (u.name || u.email || 'U').split(' ').map(x=>x[0]).join('').substring(0,2).toUpperCase();
}

/* ── Additional student endpoints ─────────────────────────── */
StudentAPI.marksAll    = () => apiFetch('/student/marks/all');
StudentAPI.attendance  = () => apiFetch('/student/attendance');

/* ── Additional mentor endpoints ──────────────────────────── */
MentorAPI.divisions = () => apiFetch('/mentor/divisions');