export const refactorTemplate = `
# Code Refactoring Template

## Project Context
Project: {{projectName}}
Date: {{formatDate date}}
Developer: {{user}}

## Refactoring Task
{{taskDescription}}

{{context}}

## Refactoring Goals
- Improve code quality and maintainability
- Preserve existing functionality
- Ensure backward compatibility
- Improve performance where possible
- Follow best practices for the language/framework

## Approach
Please help me refactor this code by:

1. Analyzing the current implementation and identifying any issues or improvement opportunities
2. Suggesting a refactoring approach with clear reasoning
3. Providing the refactored code with explanations of key changes
4. Highlighting any potential risks or side effects of the refactoring
5. Suggesting appropriate tests to ensure the refactoring preserves functionality

## Specific Areas of Focus
- Code organization and structure
- Patterns and best practices
- Error handling and edge cases
- Performance considerations
- Readability and maintainability
`;

export default refactorTemplate;
