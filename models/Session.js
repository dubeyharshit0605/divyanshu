const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  session_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  candidate_id: {
    type: String,
    required: true,
    ref: 'Candidate'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned', 'timeout'],
    default: 'active'
  },
  current_difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  current_domain: {
    type: String,
    enum: ['data_structures', 'algorithms', 'system_design', 'database', 'networking', 'security'],
    default: 'data_structures'
  },
  questions_asked: [{
    question_id: {
      type: String,
      required: true
    },
    question_text: String,
    difficulty: String,
    domain: String,
    asked_at: {
      type: Date,
      default: Date.now
    }
  }],
  evaluations: [{
    question_id: String,
    answer: String,
    evaluation: {
      correctness: Number,
      clarity: Number,
      confidence: Number,
      feedback: String
    },
    evaluated_at: {
      type: Date,
      default: Date.now
    }
  }],
  current_question_index: {
    type: Number,
    default: 0
  },
  total_questions: {
    type: Number,
    default: 0
  },
  session_score: {
    type: Number,
    default: 0
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  ended_at: {
    type: Date,
    default: null
  },
  timeout_at: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    }
  }
});

// Update timeout when session is created
sessionSchema.pre('save', function(next) {
  if (this.isNew) {
    this.timeout_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  }
  next();
});

// Calculate session score
sessionSchema.methods.calculateSessionScore = function() {
  if (this.evaluations.length === 0) return 0;
  
  const totalScore = this.evaluations.reduce((sum, eval) => {
    return sum + (eval.evaluation.correctness + eval.evaluation.clarity + eval.evaluation.confidence) / 3;
  }, 0);
  
  return totalScore / this.evaluations.length;
};

module.exports = mongoose.model('Session', sessionSchema);
