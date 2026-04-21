/**
 * routes/mentor.js  —  EduPortal v2
 * GET /api/mentor/batch?division=C&batch=C1   (filter by division and/or batch)
 * GET /api/mentor/batch/:studentId            (single student full detail)
 * GET /api/mentor/at-risk                     (medium + high risk only)
 * GET /api/mentor/stats                       (aggregate stats)
 * GET /api/mentor/divisions                   (list divisions and batches)
 */

const express = require('express');
const db      = require('../db');
const { requireAuth, requireMentor } = require('../middleware/auth');
const { evaluateSubject, calculateSGPI, calculateCGPI } = require('../gradeUtils');
const router  = express.Router();

async function studentFullResults(studentId) {
  const semData = [];
  for (const sem of [1,2,3]) {
    const [marks] = await db.query(
      `SELECT m.*, s.subject_code, s.subject_name, s.type,
              s.ese_max, s.mse_max, s.ise_max, s.apl_max, s.ciap_max, s.esep_max, s.credits
       FROM marks m JOIN subjects s ON s.id = m.subject_id
       WHERE m.student_id = ? AND m.semester = ?
       ORDER BY s.id`,
      [studentId, sem]
    );
    if (!marks.length) continue;
    const evaluated = marks.map(row => ({
      subject_code: row.subject_code, subject_name: row.subject_name,
      type: row.type, credit: row.credits,
      ese_obt: row.ese_obt, mse_obt: row.mse_obt, ise_obt: row.ise_obt,
      apl_obt: row.apl_obt, ciap_obt: row.ciap_obt, esep_obt: row.esep_obt,
      ese_max: row.ese_max, mse_max: row.mse_max, ise_max: row.ise_max,
      apl_max: row.apl_max, ciap_max: row.ciap_max, esep_max: row.esep_max,
      ...evaluateSubject(row, row, row.credits),
    }));
    semData.push({ semester: sem, subjects: evaluated, ...calculateSGPI(evaluated) });
  }
  return semData;
}

function computeRisk(semData) {
  let totalKT = 0, totalPct = 0, subjCount = 0, sgpiList = [];
  for (const d of semData) {
    totalKT += d.subjects.filter(s => s.kt).length;
    d.subjects.forEach(s => { totalPct += s.percentage; subjCount++; });
    if (d.sgpi !== null) sgpiList.push(d.sgpi);
  }
  const avgPct  = subjCount > 0 ? +(totalPct/subjCount).toFixed(2) : 0;
  const avgSGPI = sgpiList.length ? +(sgpiList.reduce((a,b)=>a+b,0)/sgpiList.length).toFixed(2) : null;

  let score = 0;
  if (totalKT >= 4)       score += 40;
  else if (totalKT >= 2)  score += 25;
  else if (totalKT === 1) score += 15;
  if (avgPct < 40)        score += 30;
  else if (avgPct < 50)   score += 20;
  else if (avgPct < 60)   score += 10;
  if (totalKT > 0)        score += 10;
  score = Math.min(score, 100);

  return {
    riskScore: score,
    riskLevel: score >= 66 ? 'high' : score >= 36 ? 'medium' : 'low',
    ktCount: totalKT, avgPercentage: avgPct, sgpi: avgSGPI,
  };
}

/* ── GET /api/mentor/divisions ── */
router.get('/divisions', requireAuth, requireMentor, async (req, res) => {
  try {
    // Only divisions/batches for students assigned to this mentor
    const [rows] = await db.query(
      `SELECT DISTINCT s.division, s.batch
       FROM mentor_system.mentor_students ms
       JOIN students s ON s.id = ms.student_id
       WHERE ms.mentor_id = ?
       ORDER BY s.division, s.batch`,
      [req.user.mentorId]
    );
    const divMap = {};
    for (const r of rows) {
      if (!divMap[r.division]) divMap[r.division] = [];
      divMap[r.division].push(r.batch);
    }
    res.json(divMap);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/mentor/batch ── */
router.get('/batch', requireAuth, requireMentor, async (req, res) => {
  try {
    const { division, batch } = req.query;
    let sql = `SELECT s.id, s.prn, s.division, s.batch, s.name, s.email
               FROM mentor_system.mentor_students ms
               JOIN students s ON s.id = ms.student_id
               WHERE ms.mentor_id = ?`;
    const args = [req.user.mentorId];
    if (division) { sql += ' AND s.division = ?'; args.push(division); }
    if (batch)    { sql += ' AND s.batch = ?';    args.push(batch); }
    sql += ' ORDER BY s.division, s.batch, s.prn';

    const [students] = await db.query(sql, args);
    const results = await Promise.all(students.map(async stu => {
      const semData = await studentFullResults(stu.id);
      return { ...stu, ...computeRisk(semData) };
    }));
    res.json(results);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/mentor/batch/:studentId ── */
router.get('/batch/:studentId', requireAuth, requireMentor, async (req, res) => {
  try {
    const sid = parseInt(req.params.studentId);
    // Ensure this student belongs to the logged-in mentor
    const [[stu]] = await db.query(
      `SELECT s.*
       FROM mentor_system.mentor_students ms
       JOIN students s ON s.id = ms.student_id
       WHERE ms.mentor_id = ? AND s.id = ?`,
      [req.user.mentorId, sid]
    );
    if (!stu) return res.status(404).json({ error: 'Not found' });
    const semData = await studentFullResults(sid);
    const risk    = computeRisk(semData);
    const cgpi    = calculateCGPI(semData);
    res.json({ student: stu, semesters: semData, cgpi, ...risk });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/mentor/at-risk ── */
router.get('/at-risk', requireAuth, requireMentor, async (req, res) => {
  try {
    const { division, batch } = req.query;
    let sql = `SELECT s.id, s.prn, s.division, s.batch, s.name, s.email
               FROM mentor_system.mentor_students ms
               JOIN students s ON s.id = ms.student_id
               WHERE ms.mentor_id = ?`;
    const args = [req.user.mentorId];
    if (division) { sql += ' AND s.division = ?'; args.push(division); }
    if (batch)    { sql += ' AND s.batch = ?';    args.push(batch); }
    sql += ' ORDER BY s.prn';
    const [students] = await db.query(sql, args);
    const results = await Promise.all(students.map(async stu => {
      const semData = await studentFullResults(stu.id);
      return { ...stu, ...computeRisk(semData) };
    }));
    const flagged = results.filter(s => s.riskLevel !== 'low').sort((a,b) => b.riskScore - a.riskScore);
    res.json(flagged);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/mentor/stats ── */
router.get('/stats', requireAuth, requireMentor, async (req, res) => {
  try {
    const { division, batch } = req.query;
    let sql = `SELECT s.id
               FROM mentor_system.mentor_students ms
               JOIN students s ON s.id = ms.student_id
               WHERE ms.mentor_id = ?`;
    const args = [req.user.mentorId];
    if (division) { sql += ' AND s.division = ?'; args.push(division); }
    if (batch)    { sql += ' AND s.batch = ?';    args.push(batch); }

    const [students] = await db.query(sql, args);
    const risk = { low:0, medium:0, high:0 };
    let sgpiSum = 0, sgpiCount = 0;

    await Promise.all(students.map(async ({ id }) => {
      const semData = await studentFullResults(id);
      const r = computeRisk(semData);
      risk[r.riskLevel]++;
      if (r.sgpi !== null) { sgpiSum += r.sgpi; sgpiCount++; }
    }));

    res.json({
      totalStudents: students.length,
      riskBreakdown: risk,
      avgSGPI: sgpiCount > 0 ? +(sgpiSum/sgpiCount).toFixed(2) : null,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;