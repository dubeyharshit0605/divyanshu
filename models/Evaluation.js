const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  evaluation_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  session_id: {
    type: String,
    required: true,
    ref: 'Session'
  },
  candidate_id: {
    type: String,
    required: true,
    ref: 'Candidate'
  },
  question_id: {
    type: String,
    required: true,
    ref: 'Question'
  },
  answer: {
    type: String,
    required: true
  },
  evaluation: {
    correctness: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    clarity: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    feedback: {
      type: String,
      required: true
    }
  },
  overall_score: {
    type: Number,
    required: false,
    min: 0,
    max: 1
  },
  difficulty_level: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true
  },
  domain: {
    type: String,
    required: true
  },
  gemini_response: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Calculate overall score before saving
evaluationSchema.pre('save', function(next) {
  this.overall_score = (this.evaluation.correctness + this.evaluation.clarity + this.evaluation.confidence) / 3;
  next();
});

// Static method to get candidate performance analytics
evaluationSchema.statics.getCandidateAnalytics = async function(candidateId, limit = 50) {
  const evaluations = await this.find({ candidate_id: candidateId })
    .sort({ created_at: -1 })
    .limit(limit);
  
  if (evaluations.length === 0) {
    return {
      total_evaluations: 0,
      average_score: 0,
      domain_performance: {},
      difficulty_performance: {},
      improvement_trend: []
    };
  }
  
  // Calculate domain performance
  const domainPerformance = {};
  const difficultyPerformance = {};
  
  evaluations.forEach(eval => {
    const domain = eval.domain;
    const difficulty = eval.difficulty_level;
    
    if (!domainPerformance[domain]) {
      domainPerformance[domain] = { total: 0, sum: 0, average: 0 };
    }
    if (!difficultyPerformance[difficulty]) {
      difficultyPerformance[difficulty] = { total: 0, sum: 0, average: 0 };
    }
    
    domainPerformance[domain].total++;
    domainPerformance[domain].sum += eval.overall_score;
    difficultyPerformance[difficulty].total++;
    difficultyPerformance[difficulty].sum += eval.overall_score;
  });
  
  // Calculate averages
  Object.keys(domainPerformance).forEach(domain => {
    domainPerformance[domain].average = domainPerformance[domain].sum / domainPerformance[domain].total;
  });
  
  Object.keys(difficultyPerformance).forEach(difficulty => {
    difficultyPerformance[difficulty].average = difficultyPerformance[difficulty].sum / difficultyPerformance[difficulty].total;
  });
  
  // Calculate improvement trend (last 10 vs previous 10)
  const improvementTrend = [];
  if (evaluations.length >= 20) {
    const recent = evaluations.slice(0, 10);
    const previous = evaluations.slice(10, 20);
    
    const recentAvg = recent.reduce((sum, eval) => sum + eval.overall_score, 0) / recent.length;
    const previousAvg = previous.reduce((sum, eval) => sum + eval.overall_score, 0) / previous.length;
    
    improvementTrend.push({
      period: 'recent',
      average_score: recentAvg,
      count: recent.length
    });
    improvementTrend.push({
      period: 'previous',
      average_score: previousAvg,
      count: previous.length
    });
  }
  
  const totalScore = evaluations.reduce((sum, eval) => sum + eval.overall_score, 0);
  
  return {
    total_evaluations: evaluations.length,
    average_score: totalScore / evaluations.length,
    domain_performance: domainPerformance,
    difficulty_performance: difficultyPerformance,
    improvement_trend: improvementTrend
  };
};

module.exports = mongoose.model('Evaluation', evaluationSchema);
