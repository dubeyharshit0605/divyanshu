const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  question_text: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    required: true,
    enum: ['data_structures', 'algorithms', 'system_design', 'database', 'networking', 'security']
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard']
  },
  expected_key_points: [{
    type: String,
    required: true
  }],
  sample_answer: {
    type: String,
    required: false
  },
  tags: [{
    type: String
  }],
  usage_count: {
    type: Number,
    default: 0
  },
  average_score: {
    type: Number,
    default: 0
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update the updated_at field before saving
questionSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Static method to get random question by criteria
questionSchema.statics.getRandomQuestion = async function(criteria) {
  const { domain, difficulty, excludeIds = [] } = criteria;
  
  // First try to find a question with exact criteria
  const exactQuery = {
    domain,
    difficulty,
    is_active: true,
    question_id: { $nin: excludeIds }
  };
  
  let questions = await this.find(exactQuery);
  
  if (questions.length === 0) {
    // Fallback to any question in the domain (ignoring difficulty)
    const domainQuery = {
      domain,
      is_active: true,
      question_id: { $nin: excludeIds }
    };
    questions = await this.find(domainQuery);
    
    if (questions.length === 0) {
      // Last resort: allow already asked questions if no new ones available
      const anyQuery = {
        domain,
        is_active: true
      };
      questions = await this.find(anyQuery);
      
      if (questions.length === 0) {
        // If still no questions, try any domain
        const anyDomainQuery = {
          is_active: true
        };
        questions = await this.find(anyDomainQuery);
        
        if (questions.length === 0) {
          throw new Error(`No questions found in database`);
        }
      }
    }
  }
  
  return questions[Math.floor(Math.random() * questions.length)];
};

module.exports = mongoose.model('Question', questionSchema);
