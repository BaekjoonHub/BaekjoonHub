/**
 * AI Code Review Service using OpenAI API
 */
import { getObjectFromLocalStorage } from "./storage";
import { STORAGE_KEYS } from "@/constants/registry";
import log from "@/commons/logger";
import type { AIReviewRequest, AIReviewResult, OpenAIResponse, OpenAIError } from "@/types/ai-review";

// OpenAI API configuration
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;

// Default prompt template
export const DEFAULT_PROMPT_TEMPLATE = `당신은 알고리즘 문제 풀이를 도와주는 AI 어시스턴트입니다. 코드를 리뷰하고 개선점을 제안하는 역할을 합니다. 다음 순서와 지침을 따라 피드백을 작성하세요:

## 문제 정보
- 제목: {{title}}
{{problemDescription}}

## 제출한 코드 ({{language}})
\`\`\`{{language}}
{{code}}
\`\`\`

## 피드백 작성 지침

1. **문제 접근 방식 분석**
   - 학생이 선택한 알고리즘이나 접근 방식을 평가하세요.
   - 이 문제를 해결하는 데 있어 핵심적인 아이디어를 설명하세요.

2. **코드 평가**
   - 시간 복잡도와 공간 복잡도를 분석하세요.
   - 더 효율적인 방법이 있다면 제안하세요.
   - 변수명과 함수명의 명확성을 검토하세요.
   - 해당 프로그래밍 언어의 관례나 권장 사항을 잘 따랐는지 확인하세요.

3. **개선 제안**
   - 개선이 필요한 부분이 있다면 구체적인 예시 코드와 함께 설명하세요.
   - 예시 코드는 간결하면서도 명확해야 하며, 쉽게 이해하고 적용할 수 있어야 합니다.

4. **추가 학습 제안** (선택)
   - 이 문제와 관련된 알고리즘이나 자료구조에 대해 더 공부할 만한 주제를 추천하세요.

피드백은 친근하고 격려하는 톤으로 작성하되, 전문성을 유지하세요. 실력 향상에 도움이 되는 구체적이고 실행 가능한 제안을 해주세요.

중요: 배포, 프로덕션 환경, 보안, 버전 호환성과 관련된 피드백은 하지 마세요. 알고리즘 문제 풀이에 집중해주세요.`;

/**
 * AI Review Service class
 */
export class AIReviewService {
  /**
   * Check if AI review is enabled
   */
  static async isEnabled(): Promise<boolean> {
    const enabled = await getObjectFromLocalStorage<boolean>(STORAGE_KEYS.AI_REVIEW_ENABLED);
    return enabled === true;
  }

  /**
   * Get OpenAI API token from storage
   */
  static async getToken(): Promise<string | undefined> {
    return getObjectFromLocalStorage<string>(STORAGE_KEYS.OPENAI_TOKEN);
  }

  /**
   * Get custom prompt from storage or return default
   */
  static async getPrompt(): Promise<string> {
    const customPrompt = await getObjectFromLocalStorage<string>(STORAGE_KEYS.AI_REVIEW_PROMPT);
    return customPrompt || DEFAULT_PROMPT_TEMPLATE;
  }

  /**
   * Build prompt by replacing variables with actual values
   */
  static buildPrompt(template: string, request: AIReviewRequest): string {
    let prompt = template
      .replace(/\{\{title\}\}/g, request.problemTitle)
      .replace(/\{\{language\}\}/g, request.language)
      .replace(/\{\{code\}\}/g, request.code);

    // Handle problemDescription
    if (request.problemDescription) {
      prompt = prompt.replace(/\{\{problemDescription\}\}/g, `- 설명: ${request.problemDescription}`);
    } else {
      prompt = prompt.replace(/\{\{problemDescription\}\}/g, "");
    }

    return prompt;
  }

  /**
   * Fetch AI code review from OpenAI API
   */
  static async fetchReview(request: AIReviewRequest): Promise<AIReviewResult> {
    try {
      const token = await this.getToken();
      if (!token) {
        log.warn("OpenAI API token not found. Skipping AI code review.");
        return {
          success: false,
          error: "OpenAI API 토큰이 설정되지 않았습니다.",
          timestamp: Date.now(),
        };
      }

      const promptTemplate = await this.getPrompt();
      const prompt = this.buildPrompt(promptTemplate, request);

      log.info("Requesting AI code review...");

      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [
            {
              role: "system",
              content: "당신은 알고리즘 문제 풀이 코드를 리뷰하는 전문가입니다.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: DEFAULT_TEMPERATURE,
          max_tokens: DEFAULT_MAX_TOKENS,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as OpenAIError;
        log.error("OpenAI API error:", errorData);
        return {
          success: false,
          error: `API 오류: ${errorData.error?.message || response.statusText}`,
          timestamp: Date.now(),
        };
      }

      const data = (await response.json()) as OpenAIResponse;
      const review = data.choices?.[0]?.message?.content;

      if (!review) {
        log.warn("No review content in API response");
        return {
          success: false,
          error: "리뷰 결과를 받지 못했습니다.",
          timestamp: Date.now(),
        };
      }

      log.info("AI code review completed successfully.");
      return {
        success: true,
        review,
        timestamp: Date.now(),
      };
    } catch (error) {
      log.error("AI review fetch error:", error);
      return {
        success: false,
        error: `네트워크 오류: ${(error as Error).message}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Test OpenAI API connection
   */
  static async testConnection(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return { success: true };
      } else {
        const error = (await response.json()) as OpenAIError;
        return {
          success: false,
          error: error.error?.message || "알 수 없는 오류",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}

export default AIReviewService;
