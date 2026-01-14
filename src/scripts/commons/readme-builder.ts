/**
 * README Builder for problem upload
 * Provides unified README generation for all platforms
 */

/**
 * README Builder using fluent interface pattern
 * Allows flexible construction of README files with platform-specific sections
 */
export class ReadmeBuilder {
  private sections: string[] = [];

  /**
   * Add title section
   * @param level - Problem level/difficulty
   * @param title - Problem title
   * @param problemId - Problem ID
   */
  addTitle(level: string, title: string, problemId: string): this {
    this.sections.push(`# [${level}] ${title} - ${problemId}`);
    this.sections.push(""); // Empty line
    return this;
  }

  /**
   * Add problem link
   * @param url - Problem URL
   * @param label - Link label (default: "문제 링크")
   */
  addProblemLink(url: string, label = "문제 링크"): this {
    this.sections.push(`[${label}](${url})`);
    this.sections.push(""); // Empty line
    return this;
  }

  /**
   * Add performance summary section
   * @param memory - Memory usage
   * @param runtime - Runtime
   * @param codeLength - Code length (optional)
   */
  addPerformance(memory: string, runtime: string, codeLength?: string): this {
    this.sections.push("### 성능 요약");
    this.sections.push(""); // Empty line

    let performanceText = `메모리: ${memory}, 시간: ${runtime}`;
    if (codeLength) {
      performanceText += `, 코드길이: ${codeLength}`;
    }

    this.sections.push(performanceText);
    this.sections.push(""); // Empty line
    return this;
  }

  /**
   * Add custom section
   * @param title - Section title
   * @param content - Section content
   */
  addSection(title: string, content: string): this {
    if (!content || content.trim() === "" || content === "Empty") return this;

    this.sections.push(`### ${title}`);
    this.sections.push(""); // Empty line
    this.sections.push(content);
    this.sections.push(""); // Empty line
    return this;
  }

  /**
   * Add tags/category section
   * @param tags - Array of tags or comma-separated string
   */
  addTags(tags: string[] | string): this {
    const tagText = Array.isArray(tags) ? tags.join(", ") : tags;
    return this.addSection("분류", tagText);
  }

  /**
   * Add submission date
   * @param date - Submission date string
   */
  addSubmissionDate(date: string): this {
    if (!date) return this;
    return this.addSection("제출 일자", date);
  }

  /**
   * Add problem description
   * @param description - Problem description
   */
  addProblemDescription(description: string): this {
    return this.addSection("문제 설명", description);
  }

  /**
   * Add problem input specification
   * @param input - Input specification
   */
  addProblemInput(input: string): this {
    return this.addSection("문제 입력", input);
  }

  /**
   * Add problem output specification
   * @param output - Output specification
   */
  addProblemOutput(output: string): this {
    return this.addSection("문제 출력", output);
  }

  /**
   * Add AI code review section
   * @param review - AI generated review
   */
  addAIReview(review: string): this {
    if (!review || review.trim() === "") return this;

    this.sections.push("---");
    this.sections.push(""); // Empty line
    this.sections.push("### AI 코드 리뷰");
    this.sections.push(""); // Empty line
    this.sections.push(review);
    this.sections.push(""); // Empty line
    return this;
  }

  /**
   * Add source/attribution footer
   * @param source - Source text
   * @param url - Source URL
   */
  addSource(source: string, url: string): this {
    this.sections.push(`> 출처: ${source}, ${url}`);
    return this;
  }

  /**
   * Add raw content
   * @param content - Raw markdown content
   */
  addRaw(content: string): this {
    this.sections.push(content);
    return this;
  }

  /**
   * Build and return the final README content
   */
  build(): string {
    return this.sections.join("\n") + "\n";
  }

  /**
   * Clear all sections and reset builder
   */
  clear(): this {
    this.sections = [];
    return this;
  }
}

/**
 * Create a new ReadmeBuilder instance
 */
export function createReadmeBuilder(): ReadmeBuilder {
  return new ReadmeBuilder();
}
