const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Candidate = require('../models/Candidate');
const Question = require('../models/Question');
const Evaluation = require('../models/Evaluation');
const adaptiveEngine = require('../services/adaptiveEngine');
const reportService = require('../services/reportService');

class SessionController {
  async startSession(req, res) {
    try {
      const { candidate_id, name, email, experience_level, preferred_domains } = req.body;

      // Check if candidate exists, create if not
      let candidate = await Candidate.findOne({ candidate_id });
      if (!candidate) {
        candidate = new Candidate({
          candidate_id,
          name: name || 'Anonymous',
          email: email || '',
          experience_level: experience_level || 'junior',
          preferred_domains: preferred_domains || ['data_structures']
        });
        await candidate.save();
      }

      // Check for active sessions
      const activeSession = await Session.findOne({ 
        candidate_id, 
        status: 'active' 
      });

      if (activeSession) {
        return res.status(409).json({
          success: false,
          message: 'Candidate already has an active session',
          session_id: activeSession.session_id
        });
      }

      // Create new session
      const sessionId = `S${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const session = new Session({
        session_id: sessionId,
        candidate_id,
        current_difficulty: 'medium',
        current_domain: preferred_domains?.[0] || 'data_structures'
      });

      // Get first question
      const firstQuestion = await Question.getRandomQuestion({
        domain: session.current_domain,
        difficulty: session.current_difficulty
      });

      // Add first question to session
      session.questions_asked.push({
        question_id: firstQuestion.question_id,
        question_text: firstQuestion.question_text,
        difficulty: firstQuestion.difficulty,
        domain: firstQuestion.domain,
        asked_at: new Date()
      });

      session.current_question_index = 0;
      session.total_questions = 1;

      await session.save();

      res.status(201).json({
        success: true,
        message: 'Session started successfully',
        data: {
          session_id: sessionId,
          candidate_id,
          first_question: {
            question_id: firstQuestion.question_id,
            question_text: firstQuestion.question_text,
            domain: firstQuestion.domain,
            difficulty: firstQuestion.difficulty,
            expected_key_points: firstQuestion.expected_key_points
          },
          session_info: {
            current_domain: session.current_domain,
            current_difficulty: session.current_difficulty,
            started_at: session.started_at,
            timeout_at: session.timeout_at
          }
        }
      });

    } catch (error) {
      console.error('Error starting session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start session',
        error: error.message
      });
    }
  }

  async evaluateAnswer(req, res) {
    try {
      const { session_id, question_id, answer, candidate_id } = req.body;

      // Find session
      const session = await Session.findOne({ session_id });
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Session is not active'
        });
      }

      // Find question
      const question = await Question.findOne({ question_id });
      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      // Evaluate answer using Gemini
      const geminiService = require('../services/geminiService');
      const evaluation = await geminiService.evaluateAnswer(
        question.question_text,
        answer,
        question.expected_key_points
      );

      // Create evaluation record
      const evaluationId = `E${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const evaluationRecord = new Evaluation({
        evaluation_id: evaluationId,
        session_id,
        candidate_id,
        question_id,
        answer,
        evaluation,
        difficulty_level: question.difficulty,
        domain: question.domain
      });

      await evaluationRecord.save();

      // Add evaluation to session
      session.evaluations.push({
        question_id,
        answer,
        evaluation,
        evaluated_at: new Date()
      });

      // Check if session should end
      const shouldEnd = adaptiveEngine.shouldEndSession(session);
      if (shouldEnd.shouldEnd) {
        session.status = shouldEnd.reason === 'timeout' ? 'timeout' : 'completed';
        session.ended_at = new Date();
        session.session_score = session.calculateSessionScore();
        await session.save();

        // Generate final report
        const report = await reportService.generateSessionReport(session_id);

        return res.json({
          success: true,
          message: 'Answer evaluated and session ended',
          data: {
            evaluation: {
              correctness: evaluation.correctness,
              clarity: evaluation.clarity,
              confidence: evaluation.confidence,
              feedback: evaluation.feedback
            },
            session_ended: true,
            reason: shouldEnd.reason,
            final_report: report
          }
        });
      }

      // Get next question
      const nextQuestionData = await adaptiveEngine.getNextQuestion(session, evaluationRecord);
      const nextQuestion = nextQuestionData.question;

      await session.save();

      res.json({
        success: true,
        message: 'Answer evaluated successfully',
        data: {
          evaluation: {
            correctness: evaluation.correctness,
            clarity: evaluation.clarity,
            confidence: evaluation.confidence,
            feedback: evaluation.feedback
          },
          next_question: {
            question_id: nextQuestion.question_id,
            question_text: nextQuestion.question_text,
            domain: nextQuestion.domain,
            difficulty: nextQuestion.difficulty,
            expected_key_points: nextQuestion.expected_key_points
          },
          session_info: {
            current_domain: session.current_domain,
            current_difficulty: session.current_difficulty,
            questions_answered: session.evaluations.length,
            total_questions: session.total_questions
          },
          adaptive_reasoning: nextQuestionData.reasoning
        }
      });

    } catch (error) {
      console.error('Error evaluating answer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate answer',
        error: error.message
      });
    }
  }

  async endSession(req, res) {
    try {
      const { session_id } = req.body;

      // Find session
      const session = await Session.findOne({ session_id });
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Session is already ended'
        });
      }

      // Update session status
      session.status = 'completed';
      session.ended_at = new Date();
      session.session_score = session.calculateSessionScore();
      await session.save();

      // Update candidate statistics
      const candidate = await Candidate.findOne({ candidate_id: session.candidate_id });
      if (candidate) {
        candidate.total_sessions += 1;
        
        // Calculate new average score
        const allEvaluations = await Evaluation.find({ candidate_id: session.candidate_id });
        if (allEvaluations.length > 0) {
          const totalScore = allEvaluations.reduce((sum, evaluation) => sum + evaluation.overall_score, 0);
          candidate.average_score = totalScore / allEvaluations.length;
        }
        
        await candidate.save();
      }

      // Generate final report
      const report = await reportService.generateSessionReport(session_id);

      res.json({
        success: true,
        message: 'Session ended successfully',
        data: {
          session_summary: {
            session_id,
            total_questions: session.total_questions,
            questions_answered: session.evaluations.length,
            session_score: session.session_score,
            duration_minutes: Math.round((session.ended_at - session.started_at) / 1000 / 60)
          },
          report
        }
      });

    } catch (error) {
      console.error('Error ending session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end session',
        error: error.message
      });
    }
  }

  async getSession(req, res) {
    try {
      const { session_id } = req.params;

      const session = await Session.findOne({ session_id });
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      res.json({
        success: true,
        data: {
          session_id: session.session_id,
          candidate_id: session.candidate_id,
          status: session.status,
          current_difficulty: session.current_difficulty,
          current_domain: session.current_domain,
          questions_asked: session.questions_asked,
          evaluations: session.evaluations,
          current_question_index: session.current_question_index,
          total_questions: session.total_questions,
          session_score: session.session_score,
          started_at: session.started_at,
          ended_at: session.ended_at,
          timeout_at: session.timeout_at
        }
      });

    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get session',
        error: error.message
      });
    }
  }

  async getCandidateSessions(req, res) {
    try {
      const { candidate_id } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const sessions = await Session.find({ candidate_id })
        .sort({ started_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset));

      const totalSessions = await Session.countDocuments({ candidate_id });

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            session_id: session.session_id,
            status: session.status,
            total_questions: session.total_questions,
            session_score: session.session_score,
            started_at: session.started_at,
            ended_at: session.ended_at,
            duration_minutes: session.ended_at 
              ? Math.round((session.ended_at - session.started_at) / 1000 / 60)
              : null
          })),
          pagination: {
            total: totalSessions,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: totalSessions > parseInt(offset) + parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error getting candidate sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get candidate sessions',
        error: error.message
      });
    }
  }
}

module.exports = new SessionController();
