const Question = require('../models/Question');
const geminiService = require('./geminiService');

class AdaptiveEngine {
  constructor() {
    this.difficultyThresholds = {
      increase: 0.7,    // Score >= 0.7 to increase difficulty
      maintain: 0.5,    // Score 0.5-0.7 to maintain difficulty
      decrease: 0.5     // Score < 0.5 to decrease difficulty
    };
    
    this.domainProgression = {
      'data_structures': ['algorithms', 'system_design'],
      'algorithms': ['system_design', 'database'],
      'system_design': ['database', 'networking'],
      'database': ['networking', 'security'],
      'networking': ['security'],
      'security': ['data_structures'] // Cycle back
    };
  }

  async getNextQuestion(session, evaluation) {
    try {
      const currentPerformance = this.calculatePerformanceScore(evaluation);
      const nextParams = await this.determineNextQuestionParams(session, currentPerformance);
      
      // Get a random question based on the determined parameters
      const nextQuestion = await Question.getRandomQuestion({
        domain: nextParams.domain,
        difficulty: nextParams.difficulty,
        excludeIds: session.questions_asked.map(q => q.question_id)
      });

      // Update session with new question
      session.questions_asked.push({
        question_id: nextQuestion.question_id,
        question_text: nextQuestion.question_text,
        difficulty: nextQuestion.difficulty,
        domain: nextQuestion.domain,
        asked_at: new Date()
      });

      session.current_difficulty = nextParams.difficulty;
      session.current_domain = nextParams.domain;
      session.current_question_index += 1;
      session.total_questions += 1;

      await session.save();

      return {
        question: nextQuestion,
        reasoning: nextParams.reasoning,
        performance_score: currentPerformance
      };

    } catch (error) {
      console.error('Error getting next question:', error);
      throw new Error(`Failed to get next question: ${error.message}`);
    }
  }

  calculatePerformanceScore(evaluation) {
    if (!evaluation || !evaluation.evaluation) {
      return 0.5; // Default score if no evaluation
    }

    const { correctness, clarity, confidence } = evaluation.evaluation;
    return (correctness + clarity + confidence) / 3;
  }

  async determineNextQuestionParams(session, currentPerformance) {
    try {
      // Get recent performance history (last 3 questions)
      const recentEvaluations = session.evaluations.slice(-3);
      const recentScores = recentEvaluations.map(evaluation => 
        (evaluation.evaluation.correctness + evaluation.evaluation.clarity + evaluation.evaluation.confidence) / 3
      );

      const averageRecentScore = recentScores.length > 0 
        ? recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
        : currentPerformance;

      // Use Gemini to suggest next parameters
      const geminiSuggestion = await geminiService.generateNextQuestionPrompt(
        session.current_domain,
        session.current_difficulty,
        {
          current_score: currentPerformance,
          recent_average: averageRecentScore,
          recent_scores: recentScores,
          total_questions: session.total_questions
        }
      );

      // Validate and potentially override Gemini suggestion
      const validatedParams = this.validateAndAdjustParams(
        geminiSuggestion,
        session.current_domain,
        session.current_difficulty,
        averageRecentScore
      );

      return validatedParams;

    } catch (error) {
      console.error('Error determining next question params:', error);
      // Fallback to rule-based approach
      return this.getFallbackParams(session, currentPerformance);
    }
  }

  validateAndAdjustParams(geminiSuggestion, currentDomain, currentDifficulty, averageScore) {
    const validDomains = ['data_structures', 'algorithms', 'system_design', 'database', 'networking', 'security'];
    const validDifficulties = ['easy', 'medium', 'hard'];

    let domain = geminiSuggestion.domain;
    let difficulty = geminiSuggestion.difficulty;

    // Validate domain
    if (!validDomains.includes(domain)) {
      domain = currentDomain;
    }

    // Validate difficulty
    if (!validDifficulties.includes(difficulty)) {
      difficulty = currentDifficulty;
    }

    // Apply rule-based adjustments if needed
    if (averageScore >= this.difficultyThresholds.increase) {
      difficulty = this.increaseDifficulty(difficulty);
    } else if (averageScore < this.difficultyThresholds.decrease) {
      difficulty = this.decreaseDifficulty(difficulty);
    }

    return {
      domain,
      difficulty,
      reasoning: geminiSuggestion.reasoning || `Adjusted based on performance score: ${averageScore.toFixed(2)}`
    };
  }

  getFallbackParams(session, currentPerformance) {
    let nextDifficulty = session.current_difficulty;
    let nextDomain = session.current_domain;

    // Rule-based difficulty adjustment
    if (currentPerformance >= this.difficultyThresholds.increase) {
      nextDifficulty = this.increaseDifficulty(nextDifficulty);
    } else if (currentPerformance < this.difficultyThresholds.decrease) {
      nextDifficulty = this.decreaseDifficulty(nextDifficulty);
    }

    // Rule-based domain progression (after 3+ questions in same domain with good performance)
    const recentDomainQuestions = session.questions_asked
      .filter(q => q.domain === session.current_domain)
      .slice(-3);

    if (recentDomainQuestions.length >= 3 && currentPerformance >= 0.6) {
      const nextDomains = this.domainProgression[session.current_domain];
      if (nextDomains && nextDomains.length > 0) {
        nextDomain = nextDomains[0];
      }
    }

    return {
      domain: nextDomain,
      difficulty: nextDifficulty,
      reasoning: `Fallback rule-based adjustment. Performance: ${currentPerformance.toFixed(2)}`
    };
  }

  increaseDifficulty(currentDifficulty) {
    const difficultyOrder = ['easy', 'medium', 'hard'];
    const currentIndex = difficultyOrder.indexOf(currentDifficulty);
    return currentIndex < difficultyOrder.length - 1 
      ? difficultyOrder[currentIndex + 1] 
      : currentDifficulty;
  }

  decreaseDifficulty(currentDifficulty) {
    const difficultyOrder = ['easy', 'medium', 'hard'];
    const currentIndex = difficultyOrder.indexOf(currentDifficulty);
    return currentIndex > 0 
      ? difficultyOrder[currentIndex - 1] 
      : currentDifficulty;
  }

  shouldEndSession(session) {
    const maxQuestions = parseInt(process.env.MAX_QUESTIONS_PER_SESSION) || 20;
    const sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 3600000; // 1 hour
    
    // Check if max questions reached
    if (session.total_questions >= maxQuestions) {
      return { shouldEnd: true, reason: 'max_questions_reached' };
    }

    // Check if session timeout reached
    if (new Date() > session.timeout_at) {
      return { shouldEnd: true, reason: 'timeout' };
    }

    // Check if session has been inactive for too long (no new questions in 30 minutes)
    const lastQuestionTime = session.questions_asked.length > 0 
      ? session.questions_asked[session.questions_asked.length - 1].asked_at
      : session.started_at;
    
    const inactiveTime = Date.now() - new Date(lastQuestionTime).getTime();
    if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
      return { shouldEnd: true, reason: 'inactivity' };
    }

    return { shouldEnd: false, reason: null };
  }
}

module.exports = new AdaptiveEngine();
