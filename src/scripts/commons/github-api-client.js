/**
 * Enhanced GitHub API client with comprehensive error handling, rate limiting, and retry logic
 */
import log from "@/commons/logger.js";
import { GITHUB_API, TIMEOUTS, RETRY_LIMITS } from "@/constants/config.js";

/**
 * Custom error class for GitHub API errors
 */
export class GitHubAPIError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = "GitHubAPIError";
    this.status = status;
    this.response = response;
  }
}

/**
 * Enhanced GitHub API client with error handling and retry logic
 */
export class GitHubAPIClient {
  constructor() {
    this.rateLimitRemaining = null;
    this.rateLimitReset = null;
  }

  /**
   * Check and handle rate limiting
   * @param {Response} response - Fetch response object
   * @returns {Promise<void>}
   */
  async handleRateLimit(response) {
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
      const waitTime = this.rateLimitReset - now;

      if (waitTime > 0 && waitTime < TIMEOUTS.MAX_RETRY_WAIT) {
        log.warn(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds until reset...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return true; // Indicate retry should be attempted
      } else if (waitTime >= TIMEOUTS.MAX_RETRY_WAIT) {
        throw new GitHubAPIError(`Rate limit exceeded. Reset time too far in the future: ${new Date(this.rateLimitReset).toISOString()}`, 403, await response.text());
      }
    }
    return false;
  }

  /**
   * Validate response and extract JSON data
   * @param {Response} response - Fetch response object
   * @returns {Promise<any>} Parsed JSON data
   */
  async validateResponse(response) {
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.message) {
          errorMessage = `GitHub API error: ${errorJson.message}`;
        }
        if (errorJson.errors && Array.isArray(errorJson.errors)) {
          const errors = errorJson.errors.map((e) => e.message || e.code).join(", ");
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
        throw new GitHubAPIError(`Failed to parse JSON response: ${error.message}`, response.status, await response.text());
      }
    }

    // For non-JSON responses, return text
    return await response.text();
  }

  /**
   * Make a request with retry logic and error handling
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<any>} Response data
   */
  async request(url, options = {}, maxRetries = RETRY_LIMITS.API_MAX_RETRIES) {
    let lastError;

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
        return await this.validateResponse(response);
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except rate limiting
        if (error instanceof GitHubAPIError && error.status >= 400 && error.status < 500 && error.status !== 403) {
          throw error;
        }

        // Calculate retry delay with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.min(TIMEOUTS.API_RETRY_BASE * Math.pow(2, attempt), TIMEOUTS.MAX_RETRY_WAIT);
          log.warn(`Request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, error.message);
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
   * @param {string} url - Request URL
   * @param {Object} headers - Additional headers
   * @returns {Promise<any>} Response data
   */
  async get(url, headers = {}) {
    return this.request(url, {
      method: "GET",
      headers,
    });
  }

  /**
   * POST request wrapper
   * @param {string} url - Request URL
   * @param {any} body - Request body
   * @param {Object} headers - Additional headers
   * @returns {Promise<any>} Response data
   */
  async post(url, body, headers = {}) {
    return this.request(url, {
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
   * @param {string} url - Request URL
   * @param {any} body - Request body
   * @param {Object} headers - Additional headers
   * @returns {Promise<any>} Response data
   */
  async patch(url, body, headers = {}) {
    return this.request(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  /**
   * Get current rate limit status
   * @returns {Object} Rate limit information
   */
  getRateLimitStatus() {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset ? new Date(this.rateLimitReset).toISOString() : null,
    };
  }
}

// Export singleton instance
export default new GitHubAPIClient();
