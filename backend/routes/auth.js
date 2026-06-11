const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ success: false, message: 'שם משתמש או סיסמה שגויים' });
  }

  const user = {
    userId:   1,
    fullName: process.env.ADMIN_FULLNAME || 'מנהל מערכת',
    role:     'admin',
  };

  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '12h' });

  res.json({ success: true, token, user, message: '' });
});

module.exports = router;
