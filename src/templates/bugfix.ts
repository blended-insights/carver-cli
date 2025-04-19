export const bugfixTemplate = `
# Bug Fix Template

## Context
{{context}}

## Bug Description
{{bugDescription}}

## Expected Behavior
{{expectedBehavior}}

## Current Behavior
{{currentBehavior}}

## Reproduction Steps
{{reproductionSteps}}

## Logs/Error Messages
{{logs}}

## Questions
1. What could be causing this issue based on the code and error messages?
2. What changes would you recommend to fix the bug?
3. Are there any potential side effects of the proposed changes?
4. What tests would you recommend to ensure the bug is fixed?
`;

export default bugfixTemplate;
