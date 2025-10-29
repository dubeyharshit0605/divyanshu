const express = require('express');
const router = express.Router();
const adaptiveConversationService = require('../services/adaptiveConversationService');

function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const key = (parts.shift() || '').trim();
    const value = decodeURIComponent((parts.join('=') || '').trim());
    if (key) list[key] = value;
  });
  return list;
}

function ensureSessionCookie(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  let sessionKey = cookies['adaptive_sid'];
  if (!sessionKey) {
    sessionKey = `ASID-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    // HttpOnly cookie for session continuity; 1 day expiry
    res.setHeader('Set-Cookie', `adaptive_sid=${encodeURIComponent(sessionKey)}; Path=/; HttpOnly; Max-Age=86400`);
  }
  return sessionKey;
}

// POST /api/adaptive
// Body: { answer?: string }
router.post('/adaptive', async (req, res) => {
  try {
    const sessionKey = ensureSessionCookie(req, res);
    const latestAnswerText = (req.body && typeof req.body.answer === 'string') ? req.body.answer : '';

    const result = await adaptiveConversationService.handleTurn(sessionKey, latestAnswerText);

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Adaptive route error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process adaptive turn',
      error: err.message
    });
  }
});

module.exports = router;


