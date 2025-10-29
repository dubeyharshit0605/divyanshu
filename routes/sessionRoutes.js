const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { validate, validateParams, validateQuery, schemas } = require('../middleware/validation');

// POST /api/start-session
router.post('/start-session', 
  validate(schemas.startSession),
  sessionController.startSession
);

// POST /api/evaluate-answer
router.post('/evaluate-answer',
  validate(schemas.evaluateAnswer),
  sessionController.evaluateAnswer
);

// POST /api/end-session
router.post('/end-session',
  validate(schemas.endSession),
  sessionController.endSession
);

// GET /api/session/:session_id
router.get('/session/:session_id',
  validateParams(schemas.getSession),
  sessionController.getSession
);

// GET /api/candidate/:candidate_id/sessions
router.get('/candidate/:candidate_id/sessions',
  validateParams(schemas.getCandidate),
  validateQuery(require('joi').object({
    limit: require('joi').number().integer().min(1).max(100).default(10),
    offset: require('joi').number().integer().min(0).default(0)
  })),
  sessionController.getCandidateSessions
);

module.exports = router;
