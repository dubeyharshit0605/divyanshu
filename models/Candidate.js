const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  candidate_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: false
  },
  experience_level: {
    type: String,
    enum: ['junior', 'mid', 'senior'],
    default: 'junior'
  },
  preferred_domains: [{
    type: String,
    enum: ['data_structures', 'algorithms', 'system_design', 'database', 'networking', 'security']
  }],
  total_sessions: {
    type: Number,
    default: 0
  },
  average_score: {
    type: Number,
    default: 0
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
candidateSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Candidate', candidateSchema);
