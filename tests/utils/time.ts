/**
 * Time utilities for testing
 */

/**
 * Delay execution for a specified time
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the specified time
 */
function delay(ms: number | undefined) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after a specified time
 * @param ms Milliseconds before timeout
 * @param message Error message
 * @returns Promise that rejects after the specified time
 */
function timeout(ms: number | undefined, message = `Operation timed out after ${ms}ms`) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Execute a function with a timeout
 * @param promise Promise to execute
 * @param ms Timeout in milliseconds
 * @returns Promise that resolves with the function result or rejects on timeout
 */
async function withTimeout(promise: any, ms: number | undefined) {
  return Promise.race([promise, timeout(ms)]);
}

/**
 * Measure execution time of a function
 * @param fn Function to measure
 * @param args Arguments to pass to the function
 * @returns Object containing result and duration in milliseconds
 */
async function measureTime(fn, ...args) {
  const start = Date.now();
  const result = await fn(...args);
  const duration = Date.now() - start;

  return { result, duration };
}

/**
 * Get current timestamp in ISO format
 * @returns Current timestamp
 */
function timestamp() {
  return new Date().toISOString();
}

export { delay, timeout, withTimeout, measureTime, timestamp };
