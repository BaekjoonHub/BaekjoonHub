/**
 * Type declarations for safe-template-parser module
 */
declare module "safe-template-parser" {
  export interface TextTransforms {
    [key: string]: (value: string) => string;
  }

  export function parseTemplateString(
    template: string,
    data: Record<string, unknown>,
    transforms?: TextTransforms
  ): string;
}
