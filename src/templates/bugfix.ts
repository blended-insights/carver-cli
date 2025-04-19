export const bugfixTemplate = `
# Bug Fix Guide

## Project Context
Project: {{projectName}}
Date: {{formatDate date}}
Developer: {{user}}

{{context}}

## Bug Description
{{taskDescription}}

## Current Behavior
The code currently exhibits the following issue:
[Please describe the current behavior and any error messages]

## Expected Behavior
The code should:
[Please describe the expected behavior]

## Debugging Information
[Include any relevant logs, error messages, or reproduction steps]

## Fix Approach
Please help me fix this bug by:

1. Analyzing the potential causes of the issue
2. Identifying the root cause based on the code
3. Suggesting a fix with clear reasoning
4. Providing the corrected code
5. Suggesting tests to verify the fix works correctly

## Considerations
- Make minimal changes necessary to fix the issue
- Ensure the fix doesn't introduce new problems
- Consider backward compatibility
- Address the root cause, not just the symptoms
- Consider adding tests to prevent regression
`;

export default bugfixTemplate;
