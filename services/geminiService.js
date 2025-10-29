const axios = require('axios');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.apiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
  }

  async evaluateAnswer(question, answer, expectedKeyPoints) {
    try {
      const prompt = this.buildEvaluationPrompt(question, answer, expectedKeyPoints);
      
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000 // 30 seconds timeout
        }
      );

      const generatedText = response.data.candidates[0].content.parts[0].text;
      return this.parseEvaluationResponse(generatedText);

    } catch (error) {
      console.error('Gemini API Error:', error.response?.data || error.message);
      console.log('Falling back to mock evaluation...');
      return this.getMockEvaluation(answer, expectedKeyPoints);
    }
  }

  getMockEvaluation(answer, expectedKeyPoints) {
    // Simple mock evaluation based on answer length and keywords
    const answerLength = answer.length;
    const hasKeywords = expectedKeyPoints.some(point => 
      answer.toLowerCase().includes(point.toLowerCase().split(' ')[0])
    );
    
    let correctness = 0.5;
    let clarity = 0.5;
    let confidence = 0.5;
    
    // Adjust scores based on answer characteristics
    if (answerLength > 100) correctness += 0.2;
    if (answerLength > 200) clarity += 0.2;
    if (hasKeywords) correctness += 0.3;
    if (answer.includes('example') || answer.includes('for instance')) clarity += 0.1;
    
    // Ensure scores are within bounds
    correctness = Math.min(1, Math.max(0, correctness));
    clarity = Math.min(1, Math.max(0, clarity));
    confidence = Math.min(1, Math.max(0, confidence));
    
    return {
      correctness: Math.round(correctness * 10) / 10,
      clarity: Math.round(clarity * 10) / 10,
      confidence: Math.round(confidence * 10) / 10,
      feedback: `Mock evaluation: Your answer shows ${correctness > 0.7 ? 'good' : 'basic'} understanding. ${clarity > 0.6 ? 'Clear explanation.' : 'Could be more detailed.'}`
    };
  }

  buildEvaluationPrompt(question, answer, expectedKeyPoints) {
    return `
You are an expert technical interviewer evaluating a candidate's answer. Please evaluate the following response and provide a JSON response.

Question: "${question}"

Candidate's Answer: "${answer}"

Expected Key Points: ${JSON.stringify(expectedKeyPoints)}

Please evaluate the answer based on:
1. Correctness (0-1): How accurate is the technical content?
2. Clarity (0-1): How clear and well-structured is the explanation?
3. Confidence (0-1): How confident and comprehensive is the response?

Provide constructive feedback highlighting strengths and areas for improvement.

Return ONLY a valid JSON object in this exact format:
{
  "correctness": 0.8,
  "clarity": 0.7,
  "confidence": 0.6,
  "feedback": "Your feedback here..."
}

Ensure the JSON is valid and all scores are between 0 and 1.`;
  }

  parseEvaluationResponse(responseText) {
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const evaluation = JSON.parse(jsonMatch[0]);
      
      // Validate the response structure
      if (!evaluation.correctness || !evaluation.clarity || !evaluation.confidence || !evaluation.feedback) {
        throw new Error('Invalid evaluation response structure');
      }

      // Ensure scores are within valid range
      evaluation.correctness = Math.max(0, Math.min(1, evaluation.correctness));
      evaluation.clarity = Math.max(0, Math.min(1, evaluation.clarity));
      evaluation.confidence = Math.max(0, Math.min(1, evaluation.confidence));

      return evaluation;

    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      // Return default evaluation if parsing fails
      return {
        correctness: 0.5,
        clarity: 0.5,
        confidence: 0.5,
        feedback: "Unable to evaluate answer due to technical issues. Please try again."
      };
    }
  }

  async generateNextQuestionPrompt(currentDomain, currentDifficulty, previousPerformance) {
    try {
      const prompt = `
You are an AI assistant helping to generate appropriate interview questions. Based on the candidate's performance, suggest the next question parameters.

Current Domain: ${currentDomain}
Current Difficulty: ${currentDifficulty}
Previous Performance: ${JSON.stringify(previousPerformance)}

Suggest the next question parameters in JSON format:
{
  "domain": "data_structures",
  "difficulty": "medium",
  "reasoning": "Explanation for the choice"
}

Consider:
- If performance is high (>=0.7), consider increasing difficulty or moving to a harder domain
- If performance is low (<0.5), maintain or decrease difficulty
- If performance is medium (0.5-0.7), maintain current level
- Ensure domain progression makes sense

Return ONLY the JSON object.`;

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 512,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000
        }
      );

      const generatedText = response.data.candidates[0].content.parts[0].text;
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Default fallback
      return {
        domain: currentDomain,
        difficulty: currentDifficulty,
        reasoning: "Default parameters due to parsing error"
      };

    } catch (error) {
      console.error('Error generating next question prompt:', error);
      return {
        domain: currentDomain,
        difficulty: currentDifficulty,
        reasoning: "Default parameters due to API error"
      };
    }
  }
}

module.exports = new GeminiService();
