/**
 * Enhanced GitHub API client with comprehensive error handling, rate limiting, and retry logic
 */
import log from "@/commons/logger";
import { GITHUB_API, TIMEOUTS, RETRY_LIMITS } from "@/constants/config";

/**
 * Custom error class for GitHub API errors
 */
export class GitHubAPIError extends Error {
  public status: number;
  public response: string;

  constructor(message: string, status: number, response: string) {
    super(message);
    this.name = "GitHubAPIError";
    this.status = status;
    this.response = response;
  }
}

// Request options interface
interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

// Rate limit status interface
interface RateLimitStatus {
  remaining: number | null;
  reset: string | null;
}

/**
 * Enhanced GitHub API client with error handling and retry logic
 */
export class GitHubAPIClient {
  private rateLimitRemaining: number | null = null;
  private rateLimitReset: number | null = null;

  /**
   * Check and handle rate limiting
   * @param response - Fetch response object
   * @returns Whether to retry the request
   */
  async handleRateLimit(response: Response): Promise<boolean> {
    const remaining = response.headers.get(GITHUB_API.RATE_LIMIT_HEADER);
    const reset = response.headers.get(GITHUB_API.RATE_LIMIT_RESET);

    if (remaining !== null) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset !== null) {
      this.rateLimitReset = parseInt(reset, 10) * 1000; // Convert to milliseconds
    }

    // If rate limited, wait until reset time
    if (response.status === 403 && this.rateLimitRemaining === 0) {
      const now = Date.now();
      const waitTime = (this.rateLimitReset ?? 0) - now;

      if (waitTime > 0 && waitTime < TIMEOUTS.MAX_RETRY_WAIT) {
        log.warn(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds until reset...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return true; // Indicate retry should be attempted
      } else if (waitTime >= TIMEOUTS.MAX_RETRY_WAIT) {
        throw new GitHubAPIError(
          `Rate limit exceeded. Reset time too far in the future: ${new Date(this.rateLimitReset!).toISOString()}`,
          403,
          await response.text()
        );
      }
    }
    return false;
  }

  /**
   * Validate response and extract JSON data
   * @param response - Fetch response object
   * @returns Parsed JSON data
   */
  async validateResponse<T = unknown>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.message) {
          errorMessage = `GitHub API error: ${errorJson.message}`;
        }
        if (errorJson.errors && Array.isArray(errorJson.errors)) {
          const errors = errorJson.errors.map((e: { message?: string; code?: string }) => e.message || e.code).join(", ");
          errorMessage += ` - ${errors}`;
        }
      } catch {
        // If parsing fails, use the raw error body
        if (errorBody) {
          errorMessage += ` - ${errorBody}`;
        }
      }

      throw new GitHubAPIError(errorMessage, response.status, errorBody);
    }

    // Try to parse JSON response
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch (error) {
        const err = error as Error;
        throw new GitHubAPIError(`Failed to parse JSON response: ${err.message}`, response.status, await response.text());
      }
    }

    // For non-JSON responses, return text
    return (await response.text()) as T;
  }

  /**
   * Make a request with retry logic and error handling
   * @param url - Request URL
   * @param options - Fetch options
   * @param maxRetries - Maximum number of retries
   * @returns Response data
   */
  async request<T = unknown>(
    url: string,
    options: RequestOptions = {},
    maxRetries: number = RETRY_LIMITS.API_MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | undefined;

    // Ensure we have proper headers
    if (!options.headers) {
      options.headers = {};
    }
    if (!options.headers.Accept) {
      options.headers.Accept = GITHUB_API.ACCEPT_HEADER;
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        log.debug(`GitHub API request (attempt ${attempt + 1}/${maxRetries}): ${options.method || "GET"} ${url}`);

        const response = await fetch(url, options);

        // Handle rate limiting
        const shouldRetry = await this.handleRateLimit(response);
        if (shouldRetry) {
          continue; // Retry after rate limit wait
        }

        // Validate and return response
        return await this.validateResponse<T>(response);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) except rate limiting
        if (error instanceof GitHubAPIError && error.status >= 400 && error.status < 500 && error.status !== 403) {
          throw error;
        }

        // Calculate retry delay with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.min(TIMEOUTS.API_RETRY_BASE * Math.pow(2, attempt), TIMEOUTS.MAX_RETRY_WAIT);
          log.warn(`Request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, lastError.message);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    log.error(`GitHub API request failed after ${maxRetries} attempts:`, lastError);
    throw lastError;
  }

  /**
   * GET request wrapper
   * @param url - Request URL
   * @param headers - Additional headers
   * @returns Response data
   */
  async get<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<T> {
    return this.request<T>(url, {
      method: "GET",
      headers,
    });
  }

  /**
   * POST request wrapper
   * @param url - Request URL
   * @param body - Request body
   * @param headers - Additional headers
   * @returns Response data
   */
  async post<T = unknown>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    return this.request<T>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  /**
   * PATCH request wrapper
   * @param url - Request URL
   * @param body - Request body
   * @param headers - Additional headers
   * @returns Response data
   */
  async patch<T = unknown>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    return this.request<T>(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  /**
   * PUT request wrapper
   * @param url - Request URL
   * @param body - Request body
   * @param headers - Additional headers
   * @returns Response data
   */
  async put<T = unknown>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    return this.request<T>(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  /**
   * Get current rate limit status
   * @returns Rate limit information
   */
  getRateLimitStatus(): RateLimitStatus {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset ? new Date(this.rateLimitReset).toISOString() : null,
    };
  }
}

// Export singleton instance
const gitHubAPIClient = new GitHubAPIClient();
export default gitHubAPIClient;
