/**
 * routes/student.js  —  EduPortal v2 (complete)
 */
const express = require('express');
const db      = require('../db');
const { requireAuth, requireStudent } = require('../middleware/auth');
const { evaluateSubject, calculateSGPI, calculateCGPI } = require('../gradeUtils');
const router  = express.Router();

/* ── Fetch all marks for one student (single query) ── */
async function getStudentMarks(studentId) {
  const [rows] = await db.query(
    `SELECT m.semester,
            s.subject_code, s.subject_name, s.type, s.credits,
            s.ese_max, s.mse_max, s.ise_max, s.apl_max, s.ciap_max, s.esep_max,
            m.ese_obt, m.mse_obt, m.ise_obt, m.apl_obt, m.ciap_obt, m.esep_obt
     FROM marks m
     JOIN subjects s ON s.id = m.subject_id
     WHERE m.student_id = ?
     ORDER BY m.semester, s.id`,
    [studentId]
  );

  // Group by semester
  const bySem = {};
  for (const row of rows) {
    const sem = row.semester;
    if (!bySem[sem]) bySem[sem] = [];
    bySem[sem].push(row);
  }

  const semData = {};
  for (const sem of [1,2,3]) {
    const rows = bySem[sem];
    if (!rows || !rows.length) { semData[sem] = null; continue; }
    const evaluated = rows.map(row => ({
      subject_code: row.subject_code,
      subject_name: row.subject_name,
      type:         row.type,
      credit:       row.credits,
      ese_obt: row.ese_obt, mse_obt: row.mse_obt, ise_obt: row.ise_obt,
      apl_obt: row.apl_obt, ciap_obt: row.ciap_obt, esep_obt: row.esep_obt,
      ese_max: row.ese_max, mse_max: row.mse_max, ise_max: row.ise_max,
      apl_max: row.apl_max, ciap_max: row.ciap_max, esep_max: row.esep_max,
      ...evaluateSubject(row, row, row.credits),
    }));
    semData[sem] = { semester: sem, subjects: evaluated, ...calculateSGPI(evaluated) };
  }
  return semData;
}

/* ── GET /api/student/me ── */
router.get('/me', requireAuth, requireStudent, async (req, res) => {
  try {
    const [[stu]] = await db.query(
      'SELECT id,prn,division,batch,name,email FROM students WHERE id=?',
      [req.user.studentId]
    );
    if (!stu) return res.status(404).json({ error: 'Not found' });
    res.json(stu);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/student/marks?sem=1 ── */
router.get('/marks', requireAuth, requireStudent, async (req, res) => {
  try {
    const sem  = parseInt(req.query.sem) || 1;
    const all  = await getStudentMarks(req.user.studentId);
    const data = all[sem];
    if (!data) return res.status(404).json({ error: 'No data for this semester' });
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/student/marks/all ── */
router.get('/marks/all', requireAuth, requireStudent, async (req, res) => {
  try {
    const semesters = await getStudentMarks(req.user.studentId);
    const cgpi = calculateCGPI(Object.values(semesters).filter(Boolean));
    res.json({ semesters, cgpi });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/student/credits ── */
router.get('/credits', requireAuth, requireStudent, async (req, res) => {
  try {
    const all = await getStudentMarks(req.user.studentId);
    const semData = Object.values(all).filter(Boolean).map(d => ({
      semester:          d.semester,
      sgpi:              d.sgpi,
      hasKT:             d.hasKT,
      totalCredits:      d.totalCredits,
      totalCreditPoints: d.totalCreditPoints,
      subjects: d.subjects.map(s => ({
        subject_name: s.subject_name,
        credit:       s.credit,
        grade:        s.grade,
        gradePoint:   s.gradePoint,
        creditPoints: s.creditPoints,
        kt:           s.kt,
      })),
    }));
    const cgpi = calculateCGPI(semData);
    // ✅ V1 fix: per-subject credit count — KT subject = 0, NOT the whole semester
    const totalEarned   = semData.reduce((a, s) =>
      a + s.subjects.reduce((b, x) => b + (x.kt ? 0 : x.credit), 0), 0);
    const totalPossible = semData.reduce((a, s) =>
      a + s.subjects.reduce((b, x) => b + x.credit, 0), 0);
    res.json({ semesters: semData, cgpi, totalEarned, totalPossible });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/student/dropout-risk ── */
router.get('/dropout-risk', requireAuth, requireStudent, async (req, res) => {
  try {
    const all = await getStudentMarks(req.user.studentId);
    let totalKT = 0, totalPct = 0, subjCount = 0, sgpiList = [];

    for (const d of Object.values(all).filter(Boolean)) {
      totalKT += d.subjects.filter(s => s.kt).length;
      d.subjects.forEach(s => { totalPct += s.percentage; subjCount++; });
      if (d.sgpi !== null) sgpiList.push(d.sgpi);
    }

    const avgPct  = subjCount > 0 ? +(totalPct / subjCount).toFixed(2) : 0;
    const avgSGPI = sgpiList.length
      ? +(sgpiList.reduce((a, b) => a + b, 0) / sgpiList.length).toFixed(2)
      : null;

    let score = 0;
    if      (totalKT >= 4)  score += 40;
    else if (totalKT >= 2)  score += 25;
    else if (totalKT === 1) score += 15;
    if      (avgPct < 40)   score += 30;
    else if (avgPct < 50)   score += 20;
    else if (avgPct < 60)   score += 10;
    if (totalKT > 0) score += 10;
    score = Math.min(score, 100);

    res.json({
      riskScore:     score,
      riskLevel:     score >= 66 ? 'high' : score >= 36 ? 'medium' : 'low',
      ktCount:       totalKT,
      avgPercentage: avgPct,
      sgpi:          avgSGPI,
      factors: { ktSubjects: totalKT, avgMarks: avgPct, hasKT: totalKT > 0 },
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/student/attendance ── */
router.get('/attendance', requireAuth, requireStudent, async (req, res) => {
  try {
    const studentId = req.user.studentId;

    // Overall attendance percentage
    const [[overall]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'Present') AS present,
         ROUND(SUM(status = 'Present') * 100 / NULLIF(COUNT(*), 0)) AS percentage
       FROM attendance
       WHERE student_id = ?`,
      [studentId]
    );

    // Per-subject breakdown
    const [subjects] = await db.query(
      `SELECT
         subject,
         COUNT(*) AS total,
         SUM(status = 'Present') AS present,
         ROUND(SUM(status = 'Present') * 100 / NULLIF(COUNT(*), 0)) AS percentage
       FROM attendance
       WHERE student_id = ?
       GROUP BY subject
       ORDER BY subject`,
      [studentId]
    );

    res.json({
      overall: {
        total:      overall.total      || 0,
        present:    overall.present    || 0,
        percentage: overall.percentage || 0,
      },
      subjects,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;