const Evaluation = require('../models/Evaluation');
const Candidate = require('../models/Candidate');

class ReportService {
  constructor() {
    this.scoreThresholds = {
      excellent: 0.8,
      good: 0.6,
      average: 0.4,
      poor: 0.0
    };
  }

  async generateSessionReport(sessionId) {
    try {
      const session = await require('../models/Session').findOne({ session_id: sessionId });
      if (!session) {
        throw new Error('Session not found');
      }

      const evaluations = await Evaluation.find({ session_id: sessionId });
      const candidate = await Candidate.findOne({ candidate_id: session.candidate_id });

      if (evaluations.length === 0) {
        return this.generateEmptyReport(session, candidate);
      }

      const analytics = this.calculateSessionAnalytics(evaluations, session);
      const strengths = this.identifyStrengths(analytics);
      const weaknesses = this.identifyWeaknesses(analytics);
      const recommendations = this.generateRecommendations(analytics, strengths, weaknesses);

      const report = {
        session_id: sessionId,
        candidate_id: session.candidate_id,
        candidate_name: candidate?.name || 'Unknown',
        session_summary: {
          total_questions: session.total_questions,
          questions_answered: evaluations.length,
          session_duration: this.calculateSessionDuration(session),
          overall_score: analytics.overall_score,
          performance_level: this.getPerformanceLevel(analytics.overall_score)
        },
        domain_analysis: analytics.domain_analysis,
        difficulty_analysis: analytics.difficulty_analysis,
        strengths: strengths,
        weaknesses: weaknesses,
        recommendations: recommendations,
        detailed_scores: analytics.detailed_scores,
        generated_at: new Date(),
        report_version: '1.0'
      };

      return report;

    } catch (error) {
      console.error('Error generating session report:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  calculateSessionAnalytics(evaluations, session) {
    const domainAnalysis = {};
    const difficultyAnalysis = {};
    const detailedScores = [];

    let totalScore = 0;
    let totalCorrectness = 0;
    let totalClarity = 0;
    let totalConfidence = 0;

    evaluations.forEach(evaluation => {
      const { domain, difficulty_level, evaluation: evaluationData, overall_score } = evaluation;
      
      // Domain analysis
      if (!domainAnalysis[domain]) {
        domainAnalysis[domain] = {
          total_questions: 0,
          average_score: 0,
          scores: [],
          strengths: [],
          weaknesses: []
        };
      }
      
      domainAnalysis[domain].total_questions++;
      domainAnalysis[domain].scores.push(overall_score);
      domainAnalysis[domain].average_score = 
        domainAnalysis[domain].scores.reduce((sum, score) => sum + score, 0) / 
        domainAnalysis[domain].total_questions;

      // Difficulty analysis
      if (!difficultyAnalysis[difficulty_level]) {
        difficultyAnalysis[difficulty_level] = {
          total_questions: 0,
          average_score: 0,
          scores: []
        };
      }
      
      difficultyAnalysis[difficulty_level].total_questions++;
      difficultyAnalysis[difficulty_level].scores.push(overall_score);
      difficultyAnalysis[difficulty_level].average_score = 
        difficultyAnalysis[difficulty_level].scores.reduce((sum, score) => sum + score, 0) / 
        difficultyAnalysis[difficulty_level].total_questions;

      // Overall calculations
      totalScore += overall_score;
      totalCorrectness += evaluationData.correctness;
      totalClarity += evaluationData.clarity;
      totalConfidence += evaluationData.confidence;

      // Detailed scores
      detailedScores.push({
        question_id: evaluation.question_id,
        domain,
        difficulty: difficulty_level,
        scores: {
          overall: overall_score,
          correctness: evaluationData.correctness,
          clarity: evaluationData.clarity,
          confidence: evaluationData.confidence
        },
        feedback: evaluationData.feedback
      });
    });

    return {
      overall_score: totalScore / evaluations.length,
      average_correctness: totalCorrectness / evaluations.length,
      average_clarity: totalClarity / evaluations.length,
      average_confidence: totalConfidence / evaluations.length,
      domain_analysis: domainAnalysis,
      difficulty_analysis: difficultyAnalysis,
      detailed_scores: detailedScores,
      total_evaluations: evaluations.length
    };
  }

  identifyStrengths(analytics) {
    const strengths = [];

    // Overall performance strength
    if (analytics.overall_score >= this.scoreThresholds.excellent) {
      strengths.push({
        category: 'Overall Performance',
        description: 'Excellent overall performance across all areas',
        score: analytics.overall_score
      });
    }

    // Domain strengths
    Object.entries(analytics.domain_analysis).forEach(([domain, data]) => {
      if (data.average_score >= this.scoreThresholds.good) {
        strengths.push({
          category: 'Domain Expertise',
          description: `Strong performance in ${this.formatDomainName(domain)}`,
          score: data.average_score,
          domain: domain
        });
      }
    });

    // Difficulty strengths
    Object.entries(analytics.difficulty_analysis).forEach(([difficulty, data]) => {
      if (data.average_score >= this.scoreThresholds.good) {
        strengths.push({
          category: 'Difficulty Handling',
          description: `Good performance on ${difficulty} level questions`,
          score: data.average_score,
          difficulty: difficulty
        });
      }
    });

    // Individual metric strengths
    if (analytics.average_correctness >= this.scoreThresholds.good) {
      strengths.push({
        category: 'Technical Accuracy',
        description: 'Strong technical knowledge and accuracy',
        score: analytics.average_correctness
      });
    }

    if (analytics.average_clarity >= this.scoreThresholds.good) {
      strengths.push({
        category: 'Communication',
        description: 'Clear and well-structured explanations',
        score: analytics.average_clarity
      });
    }

    if (analytics.average_confidence >= this.scoreThresholds.good) {
      strengths.push({
        category: 'Confidence',
        description: 'Confident and comprehensive responses',
        score: analytics.average_confidence
      });
    }

    return strengths.slice(0, 5); // Return top 5 strengths
  }

  identifyWeaknesses(analytics) {
    const weaknesses = [];

    // Overall performance weakness
    if (analytics.overall_score < this.scoreThresholds.average) {
      weaknesses.push({
        category: 'Overall Performance',
        description: 'Overall performance needs improvement',
        score: analytics.overall_score,
        priority: 'high'
      });
    }

    // Domain weaknesses
    Object.entries(analytics.domain_analysis).forEach(([domain, data]) => {
      if (data.average_score < this.scoreThresholds.average) {
        weaknesses.push({
          category: 'Domain Knowledge',
          description: `Needs improvement in ${this.formatDomainName(domain)}`,
          score: data.average_score,
          domain: domain,
          priority: data.average_score < this.scoreThresholds.poor ? 'high' : 'medium'
        });
      }
    });

    // Difficulty weaknesses
    Object.entries(analytics.difficulty_analysis).forEach(([difficulty, data]) => {
      if (data.average_score < this.scoreThresholds.average) {
        weaknesses.push({
          category: 'Difficulty Handling',
          description: `Struggles with ${difficulty} level questions`,
          score: data.average_score,
          difficulty: difficulty,
          priority: 'medium'
        });
      }
    });

    // Individual metric weaknesses
    if (analytics.average_correctness < this.scoreThresholds.average) {
      weaknesses.push({
        category: 'Technical Accuracy',
        description: 'Technical knowledge needs strengthening',
        score: analytics.average_correctness,
        priority: 'high'
      });
    }

    if (analytics.average_clarity < this.scoreThresholds.average) {
      weaknesses.push({
        category: 'Communication',
        description: 'Explanation clarity needs improvement',
        score: analytics.average_clarity,
        priority: 'medium'
      });
    }

    if (analytics.average_confidence < this.scoreThresholds.average) {
      weaknesses.push({
        category: 'Confidence',
        description: 'Response confidence needs building',
        score: analytics.average_confidence,
        priority: 'medium'
      });
    }

    return weaknesses.slice(0, 5); // Return top 5 weaknesses
  }

  generateRecommendations(analytics, strengths, weaknesses) {
    const recommendations = [];

    // Performance-based recommendations
    if (analytics.overall_score < this.scoreThresholds.average) {
      recommendations.push({
        category: 'General Improvement',
        priority: 'high',
        action: 'Focus on fundamental concepts and practice more coding problems',
        resources: ['Online coding platforms', 'Technical books', 'Practice problems']
      });
    }

    // Domain-specific recommendations
    Object.entries(analytics.domain_analysis).forEach(([domain, data]) => {
      if (data.average_score < this.scoreThresholds.average) {
        recommendations.push({
          category: 'Domain-Specific',
          priority: 'high',
          action: `Strengthen knowledge in ${this.formatDomainName(domain)}`,
          resources: this.getDomainResources(domain)
        });
      }
    });

    // Communication recommendations
    if (analytics.average_clarity < this.scoreThresholds.average) {
      recommendations.push({
        category: 'Communication',
        priority: 'medium',
        action: 'Practice explaining technical concepts clearly and concisely',
        resources: ['Technical writing courses', 'Presentation practice', 'Peer review sessions']
      });
    }

    // Confidence building recommendations
    if (analytics.average_confidence < this.scoreThresholds.average) {
      recommendations.push({
        category: 'Confidence Building',
        priority: 'medium',
        action: 'Build confidence through consistent practice and preparation',
        resources: ['Mock interviews', 'Study groups', 'Regular practice sessions']
      });
    }

    // Next steps based on strengths
    if (strengths.length > 0) {
      const topStrength = strengths[0];
      recommendations.push({
        category: 'Leverage Strengths',
        priority: 'low',
        action: `Continue building on your strength in ${topStrength.category.toLowerCase()}`,
        resources: ['Advanced courses', 'Specialized projects', 'Mentorship opportunities']
      });
    }

    return recommendations.slice(0, 6); // Return top 6 recommendations
  }

  getDomainResources(domain) {
    const resourceMap = {
      'data_structures': ['Data Structures and Algorithms books', 'LeetCode practice', 'Visualization tools'],
      'algorithms': ['Algorithm design books', 'Competitive programming', 'Algorithm visualization'],
      'system_design': ['System design books', 'Architecture patterns', 'Case studies'],
      'database': ['Database design books', 'SQL practice', 'NoSQL concepts'],
      'networking': ['Network protocols', 'TCP/IP fundamentals', 'Network security'],
      'security': ['Security fundamentals', 'OWASP guidelines', 'Penetration testing']
    };

    return resourceMap[domain] || ['General technical resources', 'Online courses', 'Practice problems'];
  }

  formatDomainName(domain) {
    return domain.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  getPerformanceLevel(score) {
    if (score >= this.scoreThresholds.excellent) return 'Excellent';
    if (score >= this.scoreThresholds.good) return 'Good';
    if (score >= this.scoreThresholds.average) return 'Average';
    return 'Needs Improvement';
  }

  calculateSessionDuration(session) {
    const startTime = new Date(session.started_at);
    const endTime = session.ended_at ? new Date(session.ended_at) : new Date();
    return Math.round((endTime - startTime) / 1000 / 60); // Duration in minutes
  }

  generateEmptyReport(session, candidate) {
    return {
      session_id: session.session_id,
      candidate_id: session.candidate_id,
      candidate_name: candidate?.name || 'Unknown',
      session_summary: {
        total_questions: session.total_questions,
        questions_answered: 0,
        session_duration: this.calculateSessionDuration(session),
        overall_score: 0,
        performance_level: 'No Data'
      },
      domain_analysis: {},
      difficulty_analysis: {},
      strengths: [],
      weaknesses: [{
        category: 'Session Completion',
        description: 'No questions were answered in this session',
        priority: 'high'
      }],
      recommendations: [{
        category: 'Session Participation',
        priority: 'high',
        action: 'Complete the interview session to receive detailed feedback',
        resources: ['Retry the interview', 'Check technical setup', 'Contact support if needed']
      }],
      detailed_scores: [],
      generated_at: new Date(),
      report_version: '1.0'
    };
  }
}

module.exports = new ReportService();
