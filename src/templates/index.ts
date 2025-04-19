import defaultTemplate from './default';
import featureTemplate from './feature';
import bugfixTemplate from './bugfix';
import refactorTemplate from './refactor';

type TemplateKey = 'default' | 'feature' | 'bugfix' | 'refactor';

export const templates: Record<TemplateKey, string> = {
  default: defaultTemplate,
  feature: featureTemplate,
  bugfix: bugfixTemplate,
  refactor: refactorTemplate,
};

/**
 * Get a prompt template by name
 * @param name Template name
 * @returns Template string or default template if not found
 */
export function getTemplate(name: string): string {
  return name in templates ? templates[name as TemplateKey] : templates.default;
}

/**
 * Get all available template names
 * @returns Array of template names
 */
export function getTemplateNames(): string[] {
  return Object.keys(templates);
}

export default templates;
