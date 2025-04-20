import fs from 'fs';
import { delay } from './time';

/**
 * Get memory usage of a process
 * @param pid Process ID
 * @returns Memory usage in bytes, or -1 if process not found
 */
async function getProcessMemoryUsage(pid) {
  // Check if process exists
  try {
    process.kill(pid, 0); // Check if process exists (doesn't actually kill it)
  } catch (error) {
    return -1; // Process doesn't exist
  }

  // Platform-specific memory usage check
  if (process.platform === 'linux') {
    try {
      const statContent = await fs.promises.readFile(`/proc/${pid}/status`, 'utf8');
      const vmRssMatch = statContent.match(/VmRSS:\s+(\d+)\s+kB/);
      if (vmRssMatch && vmRssMatch[1]) {
        return parseInt(vmRssMatch[1], 10) * 1024; // Convert from KB to bytes
      }
    } catch (error) {
      // Fallback to default
    }
  } else if (process.platform === 'darwin' || process.platform === 'win32') {
    // For macOS and Windows, we need to use external commands
    // This is a simplified implementation
    // In a real implementation, use child_process.exec to run platform-specific commands
    return -1;
  }

  return -1;
}

/**
 * Wait for a process to exit
 * @param process Child process to wait for
 * @param timeout Timeout in milliseconds (default: 10000)
 * @returns Promise that resolves when the process exits
 */
function waitForProcessExit(process, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Process exit timeout'));
    }, timeout);

    process.on('exit', () => {
      clearTimeout(timer);
      resolve({});
    });
  });
}

/**
 * Check if a port is in use
 * @param port Port number
 * @returns Promise that resolves to true if port is in use, false otherwise
 */
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port);
  });
}

/**
 * Wait for a port to become available
 * @param port Port number
 * @param maxWaitTime Maximum wait time in milliseconds
 * @param checkInterval Check interval in milliseconds
 * @returns Promise that resolves when port is available
 */
async function waitForPortAvailable(port, maxWaitTime = 10000, checkInterval = 500) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return;
    }
    await delay(checkInterval);
  }

  throw new Error(`Port ${port} did not become available within ${maxWaitTime}ms`);
}

export { getProcessMemoryUsage, waitForProcessExit, isPortInUse, waitForPortAvailable };
