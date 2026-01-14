/**
 * HTTP Client with retry and timeout support
 * Provides unified HTTP request handling for all platforms
 */
import log from "@/commons/logger";

// HTTP Client options
export interface HttpClientOptions {
  timeout?: number; // Request timeout in milliseconds (default: 10000)
  retryCount?: number; // Number of retries on failure (default: 3)
  retryDelay?: number; // Base delay between retries in milliseconds (default: 1000)
}

/**
 * HTTP Client with automatic retry and timeout
 * Simplifies fetch operations with error handling
 */
export class HttpClient {
  private timeout: number;
  private retryCount: number;
  private retryDelay: number;

  constructor(options: HttpClientOptions = {}) {
    this.timeout = options.timeout ?? 10000; // Default: 10 seconds
    this.retryCount = options.retryCount ?? 3; // Default: 3 retries
    this.retryDelay = options.retryDelay ?? 1000; // Default: 1 second
  }

  /**
   * Fetch text content from URL
   * @param url - URL to fetch
   * @returns Text content
   */
  async getText(url: string): Promise<string> {
    const response = await this.fetchWithRetry(url);
    return response.text();
  }

  /**
   * Fetch and parse HTML document from URL
   * @param url - URL to fetch
   * @returns Parsed DOM document
   */
  async getDocument(url: string): Promise<Document> {
    const html = await this.getText(url);
    return new DOMParser().parseFromString(html, "text/html");
  }

  /**
   * Fetch and parse JSON from URL
   * @param url - URL to fetch
   * @returns Parsed JSON object
   */
  async getJson<T>(url: string): Promise<T> {
    const response = await this.fetchWithRetry(url);
    return response.json();
  }

  /**
   * Fetch with automatic retry and timeout
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns Response object
   */
  private async fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Check response status
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error as Error;

        // Log retry attempt
        if (attempt < this.retryCount - 1) {
          const delay = this.retryDelay * (attempt + 1); // Linear backoff
          log.debug(`Fetch failed (attempt ${attempt + 1}/${this.retryCount}), retrying in ${delay}ms...`, error);
          await this.delay(delay);
        }
      }
    }

    // All retries failed
    log.error(`Failed to fetch ${url} after ${this.retryCount} attempts:`, lastError);
    throw lastError!;
  }

  /**
   * Delay for specified milliseconds
   * @param ms - Milliseconds to wait
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create default HTTP client instance
export const httpClient = new HttpClient();

/**
 * Convenience function: Fetch text from URL
 */
export async function fetchText(url: string): Promise<string> {
  return httpClient.getText(url);
}

/**
 * Convenience function: Fetch and parse HTML document
 */
export async function fetchDocument(url: string): Promise<Document> {
  return httpClient.getDocument(url);
}

/**
 * Convenience function: Fetch and parse JSON
 */
export async function fetchJson<T>(url: string): Promise<T> {
  return httpClient.getJson<T>(url);
}
