/**
 * AI Review related type definitions
 */

/**
 * AI review configuration
 */
export interface AIReviewConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * AI review result from OpenAI API
 */
export interface AIReviewResult {
  success: boolean;
  review?: string;
  error?: string;
  timestamp: number;
}

/**
 * AI review request parameters
 */
export interface AIReviewRequest {
  code: string;
  language: string;
  problemTitle: string;
  problemDescription?: string;
}

/**
 * OpenAI API response structure
 */
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI API error response
 */
export interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}
