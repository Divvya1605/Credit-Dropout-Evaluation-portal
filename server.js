require("dotenv").config();

const nodemailer = require("nodemailer");
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
const PORT = process.env.PORT || 3001;

// =======================
// DB CONNECTION
// =======================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err);
  } else {
    console.log("✅ MySQL connected successfully");
  }
});

// =======================
// MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// =======================
// ROUTES (EXISTING)
// =======================
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const mentorRoutes = require('./routes/mentor');

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/mentor', mentorRoutes);

// =======================
// SEND ALERT
// =======================
app.post("/api/send-alert", async (req, res) => {
  try {
    const { name, email, attendance, student_id, type } = req.body;

    // Log incoming body to help debug missing fields
    console.log("📩 Alert request received:", { name, email, student_id, type, attendance });

    if (!email || !student_id) {
      console.log("❌ Missing email or student_id — aborting");
      return res.status(400).json({ success: false, reason: "missing email or student_id" });
    }

    // FIX: fully qualified cross-DB query for mentor lookup
    const q = `
      SELECT m.mentor_name, m.email AS mentor_email
      FROM mentor_system.mentors m
      JOIN mentor_system.mentor_students ms ON m.mentor_id = ms.mentor_id
      WHERE ms.student_id = ?
      LIMIT 1
    `;

    db.query(q, [student_id], async (err, result) => {
      if (err) {
        console.log("❌ DB error during mentor lookup:", err);
        return res.status(500).json({ success: false });
      }

      const mentor      = result?.[0];
      const mentorName  = mentor ? mentor.mentor_name  : "Your Mentor";
      const mentorEmail = mentor ? mentor.mentor_email : null;

      console.log("👤 Mentor found:", mentorName, mentorEmail);

      // Email content
      let subject = "";
      let message = "";

      if (type === "attendance") {
        subject = "Low Attendance Alert";
        message = `<p>Your attendance is <b>${attendance}%</b>. Please improve it to avoid being marked short.</p>`;
      } else if (type === "risk") {
        subject = "High Dropout Risk Alert";
        message = `<p>You have been identified as a <b>high-risk student</b>. Please contact your mentor immediately.</p>`;
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,                                     // student receives the mail
        ...(mentorEmail ? { cc: mentorEmail } : {}),  // mentor gets CC'd
        subject,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #eee;border-radius:10px;padding:28px;">
            <h3 style="color:#e74c3c;">${subject}</h3>
            <p>Hi <b>${name}</b>,</p>
            ${message}
            <p>If you have any concerns, reach out to your mentor directly.</p>
            <br/>
            <p style="margin:0;">Regards,</p>
            <p style="margin:0;"><b>${mentorName}</b></p>
            <p style="margin:0;color:#aaa;font-size:12px;">EduPortal Mentorship System</p>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log("📧 Email sent to", email, mentorEmail ? `(CC: ${mentorEmail})` : "");
        res.json({ success: true });
      } catch (mailErr) {
        console.log("❌ Email send failed:", mailErr.message);
        res.status(500).json({ success: false, reason: mailErr.message });
      }
    });

  } catch (err) {
    console.log("❌ Server error:", err);
    res.status(500).json({ success: false });
  }
});

// =======================
// HEALTH CHECK
// =======================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// =======================
// ATTENDANCE VIEW
// =======================
app.get("/api/attendance-view", (req, res) => {
  const { month, subject } = req.query;

  let q = `
    SELECT 
      a.date,
      s.prn,
      s.name,
      s.division,
      s.batch,
      a.subject,
      a.type,
      a.status
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE 1=1
  `;

  if (month)   q += ` AND DATE_FORMAT(a.date, '%Y-%m') = '${month}'`;
  if (subject) q += ` AND a.subject = '${subject}'`;

  q += ` ORDER BY a.date DESC LIMIT 1000`;

  db.query(q, (err, data) => {
    if (err) {
      console.log("❌ ERROR:", err);
      return res.json(err);
    }
    res.json(data);
  });
});

// =======================
// STUDENTS OVERVIEW
// =======================
app.get("/api/students-overview", (req, res) => {
  const { division, batch } = req.query;

  const q = `
    SELECT 
      s.id,
      s.name,
      s.prn,
      s.email,
      s.division,
      s.batch,
      ROUND(
        IFNULL(
          (SELECT COUNT(*) FROM attendance a 
           WHERE a.student_id = s.id AND a.status='Present') * 100 /
          NULLIF(
            (SELECT COUNT(*) FROM attendance a 
             WHERE a.student_id = s.id),
          0),
        0)
      ) AS percentage
    FROM students s
    WHERE s.division = ? AND s.batch = ?
  `;

  db.query(q, [division, batch], (err, data) => {
    if (err) return res.json(err);
    res.json(data);
  });
});

// =======================
// SUBJECT WISE
// =======================
app.get("/api/student-subjects/:id", (req, res) => {
  const studentId = req.params.id;

  const q = `
    SELECT 
      subject,
      ROUND(SUM(status='Present')*100/COUNT(*)) AS percentage
    FROM attendance
    WHERE student_id = ?
    GROUP BY subject
  `;

  db.query(q, [studentId], (err, data) => {
    if (err) {
      console.log("❌ ERROR:", err);
      return res.json(err);
    }
    res.json(data);
  });
});

// =======================
// STUDENT DETAILS
// =======================
app.get("/api/student-details/:id", (req, res) => {
  const studentId = req.params.id;
  const subject = req.query.subject;

  const q = `
    SELECT date, status
    FROM attendance
    WHERE student_id = ? AND subject = ?
    ORDER BY date DESC
  `;

  db.query(q, [studentId, subject], (err, data) => {
    if (err) return res.json(err);
    res.json(data);
  });
});

// =======================
// BATCH SUBJECT AVERAGE
// =======================
app.get("/api/batch-subjects", (req, res) => {
  const { division, batch } = req.query;

  const q = `
    SELECT 
      a.subject,
      ROUND(SUM(a.status='Present') * 100 / COUNT(*)) AS percent
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE s.division = ? AND s.batch = ?
    GROUP BY a.subject
  `;

  db.query(q, [division, batch], (err, data) => {
    if (err) {
      console.log("❌ ERROR:", err);
      return res.json(err);
    }
    res.json(data);
  });
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});