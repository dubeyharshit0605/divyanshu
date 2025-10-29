const Joi = require('joi');

// Validation schemas
const startSessionSchema = Joi.object({
  candidate_id: Joi.string().required().min(1).max(50),
  name: Joi.string().optional().min(1).max(100),
  email: Joi.string().email().optional(),
  experience_level: Joi.string().valid('junior', 'mid', 'senior').optional(),
  preferred_domains: Joi.array().items(
    Joi.string().valid('data_structures', 'algorithms', 'system_design', 'database', 'networking', 'security')
  ).optional()
});

const evaluateAnswerSchema = Joi.object({
  session_id: Joi.string().required().min(1).max(50),
  question_id: Joi.string().required().min(1).max(50),
  answer: Joi.string().required().min(1).max(5000),
  candidate_id: Joi.string().required().min(1).max(50)
});

const endSessionSchema = Joi.object({
  session_id: Joi.string().required().min(1).max(50)
});

const getSessionSchema = Joi.object({
  session_id: Joi.string().required().min(1).max(50)
});

const getCandidateSchema = Joi.object({
  candidate_id: Joi.string().required().min(1).max(50)
});

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errorDetails
      });
    }
    
    req.body = value;
    next();
  };
};

// Query parameter validation middleware
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Query validation error',
        errors: errorDetails
      });
    }
    
    req.query = value;
    next();
  };
};

// Params validation middleware
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Parameter validation error',
        errors: errorDetails
      });
    }
    
    req.params = value;
    next();
  };
};

module.exports = {
  validate,
  validateQuery,
  validateParams,
  schemas: {
    startSession: startSessionSchema,
    evaluateAnswer: evaluateAnswerSchema,
    endSession: endSessionSchema,
    getSession: getSessionSchema,
    getCandidate: getCandidateSchema
  }
};
