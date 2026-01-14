/**
 * Enhanced template system for all platforms
 * Converts platform-specific data to standardized format for consistent directory structure
 */
import { parseTemplateString, TextTransforms as SafeTextTransforms } from "safe-template-parser";
import { getTextTransforms } from "./text-transforms";
import log from "./logger";
import type { PlatformName } from "@/types/platform";
import type { BaseProblemInfo } from "@/types/problem";

// Template data interface - combines problem info and transform functions
interface TemplateData {
  platform: string;
  language: string;
  problemId: string;
  title: string;
  level: string;
  memory?: string;
  runtime?: string;
  submissionTime?: string;
  [key: string]: string | string[] | number | undefined;
}

// Problem data with optional problemInfo
interface ProblemDataInput {
  language?: string;
  problemId?: string;
  title?: string;
  level?: string;
  problemInfo?: Partial<BaseProblemInfo>;
  [key: string]: unknown;
}

/**
 * Enhanced Template Service for all platforms
 */
export default class EnhancedTemplateService {
  /**
   * Utilize standardized problem data.
   * Each platform's uploadfunctions.js passes platform and problemInfo fields.
   *
   * @param platform - Platform name ('백준', '프로그래머스', 'SWEA')
   * @param data - Platform-specific problem data
   * @returns Data for template use
   */
  static prepareTemplateData(platform: string, data: ProblemDataInput): TemplateData {
    // Prepare base data - support both data structures
    const templateData: TemplateData = {
      platform,
      language: data.language || "",
      // Handle both direct properties and problemInfo structure
      problemId: data.problemId || data.problemInfo?.problemId || "",
      title: data.title || data.problemInfo?.title || "",
      level: data.level || data.problemInfo?.level || "",
      // Add remaining problemInfo properties
      ...(data.problemInfo || {}),
    };

    // Add text transformation functions for template use
    Object.assign(templateData, getTextTransforms());

    return templateData;
  }

  /**
   * Generate directory name using custom template.
   *
   * @param platform - Platform name ('백준', '프로그래머스', 'SWEA')
   * @param defaultDirName - Default directory name
   * @param language - Programming language
   * @param data - Problem data (including platform and problem meta info)
   * @param useCustomTemplate - Whether to use custom template
   * @param customTemplate - Custom template string
   * @param orgOption - Organization option
   * @returns Generated directory path
   */
  static getDirNameWithTemplate(
    platform: PlatformName | string,
    defaultDirName: string,
    language: string,
    data: ProblemDataInput | null,
    useCustomTemplate?: boolean,
    customTemplate?: string,
    orgOption?: string
  ): string {
    try {
      // Prepare template data
      const templateData = this.prepareTemplateData(platform, data || {});
      templateData.language = language; // Ensure language info

      // Use custom template if set and enabled
      if (useCustomTemplate === true && customTemplate && customTemplate.trim() !== "") {
        return this.parseDirectoryTemplate(customTemplate, templateData);
      }

      // Check language organization option
      if (orgOption === "language") {
        return `${language}/${defaultDirName}`;
      }

      // Return default directory
      return defaultDirName;
    } catch (error) {
      log.error("템플릿 적용 중 오류가 발생했습니다:", error);
      return defaultDirName; // Return default directory on error
    }
  }

  /**
   * Parse template string to generate directory path.
   * Uses new safe-template-parser API with allowedFunctions as third argument.
   *
   * @param templateString - Template string
   * @param data - Data for template
   * @returns Parsed directory path
   */
  static parseDirectoryTemplate(templateString: string, data: TemplateData): string {
    try {
      // Call parseTemplateString with new API (data, allowedFunctions as second, third args)
      return parseTemplateString(templateString, data, getTextTransforms() as unknown as SafeTextTransforms);
    } catch (error) {
      log.error("템플릿 파싱 중 오류가 발생했습니다:", error);

      // Fallback to default template
      return parseTemplateString(
        "{{platform}}/{{removeAfterSpace(level)}}/{{problemId}}. {{title}}",
        data,
        getTextTransforms() as unknown as SafeTextTransforms
      );
    }
  }
}
