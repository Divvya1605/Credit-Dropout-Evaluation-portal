const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

/**
 * Verifies JWT from Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user.
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Restricts a route to mentor role only.
 */
function requireMentor(req, res, next) {
  if (req.user?.role !== 'mentor') {
    return res.status(403).json({ error: 'Mentor access required' });
  }
  next();
}

/**
 * Restricts a route to student role only.
 */
function requireStudent(req, res, next) {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }
  next();
}

module.exports = { requireAuth, requireMentor, requireStudent };