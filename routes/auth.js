/**
 * routes/auth.js
 * POST /api/auth/login
 * Accepts { email } — no password (email-only login as per the portal design).
 * Returns a JWT containing { studentId, prn, name, role: 'student' }.
 *
 * Mentor emails are checked against a hardcoded list (or a mentors table
 * if you add one later). For now, any @siesgst email NOT in students is
 * treated as a mentor.
 */

const express = require('express');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const router  = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET required");
const JWT_EXPIRES = '8h';

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalised = email.trim().toLowerCase();

  try {
    // 1) Check if a student with this email exists in eduportalv.students
    const [stuRows] = await db.query(
      'SELECT id, prn, name, division, batch FROM students WHERE LOWER(email) = ?',
      [normalised]
    );

    if (stuRows.length > 0) {
      const student = stuRows[0];
      const token   = jwt.sign(
        {
          studentId: student.id,
          prn:       student.prn,
          name:      student.name,
          division:  student.division,
          batch:     student.batch,
          role:      'student',
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res.json({
        role:     'student',
        token,
        user: {
          id:       student.id,
          prn:      student.prn,
          name:     student.name,
          division: student.division,
          batch:    student.batch,
        },
      });
    }

    // 2) Not a student — check mentors table in mentor_system
    const [mentorRows] = await db.query(
      'SELECT mentor_id, mentor_name, email FROM mentor_system.mentors WHERE LOWER(email) = ?',
      [normalised]
    );

    if (mentorRows.length > 0) {
      const mentor = mentorRows[0];
      const token  = jwt.sign(
        {
          mentorId:   mentor.mentor_id,
          name:       mentor.mentor_name,
          email:      mentor.email,
          role:       'mentor',
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res.json({
        role:  'mentor',
        token,
        user: {
          mentorId: mentor.mentor_id,
          name:     mentor.mentor_name,
          email:    mentor.email,
        },
      });
    }

    // 3) Email not recognised in either table
    return res.status(401).json({ error: 'Email not found in the system' });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;