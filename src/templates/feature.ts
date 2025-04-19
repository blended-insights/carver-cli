export const featureTemplate = `
# Feature Implementation Guide

## Project Context
Project: {{projectName}}
Date: {{formatDate date}}
Developer: {{user}}

{{context}}

## Feature Description
{{taskDescription}}

## Implementation Requirements
1. Follow the project's existing architecture and patterns
2. Implement clean, maintainable, and well-documented code
3. Consider performance implications of the implementation
4. Include appropriate error handling
5. Add tests for the new functionality

## Implementation Approach
Please help me implement this feature by:

1. Suggesting the best approach based on the existing codebase
2. Identifying the files that need to be created or modified
3. Providing a step-by-step implementation plan
4. Highlighting any potential challenges or considerations
5. Drafting the implementation code with explanations

## Technical Considerations
- How does this feature integrate with the existing architecture?
- What edge cases should be considered?
- Are there any performance optimizations needed?
- How should the feature be tested?
- Are there any dependencies or third-party libraries that should be used?
`;

export default featureTemplate;
