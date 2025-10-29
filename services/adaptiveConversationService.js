const geminiService = require('./geminiService');

// Simple in-memory store keyed by a session key (from cookie or fallback)
const sessionStore = new Map();

function nowMs() {
  return Date.now();
}

function getNextDifficulty(current) {
  const order = ['easy', 'medium', 'hard'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : current;
}

function getPrevDifficulty(current) {
  const order = ['easy', 'medium', 'hard'];
  const idx = order.indexOf(current);
  return idx > 0 ? order[idx - 1] : current;
}

class AdaptiveConversationService {
  constructor() {
    this.topicsPool = ['data_structures', 'algorithms', 'system_design', 'database', 'networking', 'security'];
    this.randomizeTopic = true; // pick topic randomly from pool
    this.defaultDifficulty = 'easy'; // used as fallback only
    this.randomizeInitialDifficulty = true; // pick starting difficulty randomly
    this.responseTimeoutMs = 90 * 1000; // 90 seconds
  }

  getOrCreateSession(sessionKey) {
    if (!sessionStore.has(sessionKey)) {
      sessionStore.set(sessionKey, {
        topic: this.getRandomTopic(),
        difficulty: this.randomizeInitialDifficulty ? this.getRandomDifficulty() : this.defaultDifficulty,
        lastQuestion: null, // { question_id, question_text, expected_key_points, asked_at }
        history: [] // { question_id, answer, evaluation, difficulty }
      });
    }
    return sessionStore.get(sessionKey);
  }

  async handleTurn(sessionKey, latestAnswerText) {
    const session = this.getOrCreateSession(sessionKey);

    // If this is the very first turn (no previous question), generate first easy question
    if (!session.lastQuestion) {
      const startDifficulty = this.randomizeInitialDifficulty ? this.getRandomDifficulty() : this.defaultDifficulty;
      const first = await geminiService.generateAdaptiveQuestion(session.topic, startDifficulty, null);
      session.difficulty = first.difficulty || this.defaultDifficulty;
      session.lastQuestion = {
        question_id: first.question_id,
        question_text: first.question_text,
        expected_key_points: first.expected_key_points || [],
        asked_at: nowMs(),
        domain: first.domain
      };
      return {
        evaluation: null,
        next_question: this.toQuestionPayload(first),
      };
    }

    // Evaluate previous answer (or timeout)
    let evaluationText = '';
    let performanceBand = 'partial'; // correct | partial | incorrect | timeout
    const timedOut = nowMs() - session.lastQuestion.asked_at > this.responseTimeoutMs;

    if (timedOut && (!latestAnswerText || latestAnswerText.trim() === '')) {
      evaluationText = 'No Response — timed out after 90 seconds.';
      performanceBand = 'timeout';
    } else if (!latestAnswerText || latestAnswerText.trim() === '') {
      evaluationText = 'No Response — empty submission.';
      performanceBand = 'incorrect';
    } else {
      const evalRes = await geminiService.evaluateAnswer(
        session.lastQuestion.question_text,
        latestAnswerText,
        session.lastQuestion.expected_key_points || []
      );

      // Map numeric scores to bands
      const avg = (evalRes.correctness + evalRes.clarity + evalRes.confidence) / 3;
      if (avg >= 0.7) performanceBand = 'correct';
      else if (avg < 0.5) performanceBand = 'incorrect';
      else performanceBand = 'partial';
      evaluationText = evalRes.feedback || 'Evaluated.';
    }

    // Adjust difficulty
    let nextDifficulty = session.difficulty;
    if (performanceBand === 'correct') nextDifficulty = getNextDifficulty(session.difficulty);
    else if (performanceBand === 'incorrect' || performanceBand === 'timeout') nextDifficulty = getPrevDifficulty(session.difficulty);

    // Ensure difficulty changes every turn (never same as previous)
    if (nextDifficulty === session.difficulty) {
      nextDifficulty = this.getAlternateDifficulty(session.difficulty);
    }

    // Compute coverage of expected key points
    const expected = (session.lastQuestion.expected_key_points || []).map(k => String(k));
    const answerLower = (latestAnswerText || '').toLowerCase();
    const covered = expected.filter(k => {
      const firstToken = k.split(/\s+/)[0]?.toLowerCase();
      return firstToken && answerLower.includes(firstToken);
    });
    const missed = expected.filter(k => !covered.includes(k));

    // Persist turn in history
    session.history.push({
      question_id: session.lastQuestion.question_id,
      answer: latestAnswerText || '',
      evaluation: evaluationText,
      difficulty: session.difficulty,
      performance: performanceBand,
      covered_key_points: covered,
      missed_key_points: missed,
      responded_at: nowMs()
    });

    // Generate next question
    const previousResponse = {
      performance_band: performanceBand,
      performance_score: performanceBand === 'correct' ? 0.8 : performanceBand === 'partial' ? 0.6 : 0.3,
      previous_answer: latestAnswerText || '',
      covered_key_points: covered,
      missed_key_points: missed,
      previous_question: session.lastQuestion.question_text
    };

    // Optionally rotate topic each turn for a random pool experience
    if (this.randomizeTopic) {
      session.topic = this.getRandomTopic();
    }

    const next = await geminiService.generateAdaptiveQuestion(
      session.topic,
      nextDifficulty,
      previousResponse
    );

    session.difficulty = next.difficulty || nextDifficulty;
    session.lastQuestion = {
      question_id: next.question_id,
      question_text: next.question_text,
      expected_key_points: next.expected_key_points || [],
      asked_at: nowMs(),
      domain: next.domain
    };

    return {
      evaluation: evaluationText,
      next_question: this.toQuestionPayload(next)
    };
  }

  toQuestionPayload(q) {
    // Transform to required structure
    return {
      problem: q.question_text,
      input_format: 'As per problem statement. Provide necessary inputs described in the problem.',
      output_format: 'Return/print output exactly as specified in the problem.',
      constraints: 'Follow typical coding constraints for the topic unless specified otherwise.',
      example: 'Example I/O will be provided when relevant by the generator.',
      difficulty: (q.difficulty || this.defaultDifficulty).charAt(0).toUpperCase() + (q.difficulty || this.defaultDifficulty).slice(1)
    };
  }

  getRandomTopic() {
    if (!Array.isArray(this.topicsPool) || this.topicsPool.length === 0) {
      return 'data_structures';
    }
    const index = Math.floor(Math.random() * this.topicsPool.length);
    return this.topicsPool[index];
  }

  getRandomDifficulty() {
    const order = ['easy', 'medium', 'hard'];
    const index = Math.floor(Math.random() * order.length);
    return order[index];
  }

  getAlternateDifficulty(current) {
    const order = ['easy', 'medium', 'hard'];
    const others = order.filter(d => d !== current);
    // pick randomly among the two others
    const idx = Math.floor(Math.random() * others.length);
    return others[idx];
  }
}

module.exports = new AdaptiveConversationService();


