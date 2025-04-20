import { exec as cpExec, spawn as cpSpawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

/**
 * Promisified exec function
 */
export const execAsync = promisify(cpExec);

/**
 * Execute a command and return stdout, stderr, and exit code
 * @param command Command to execute
 * @param args Command arguments
 * @param options Execution options
 * @returns Object containing stdout, stderr, and exit code
 */
export async function exec(command: string, args: string[] = [], options: any = {}) {
  const cmd = `${command} ${args.join(' ')}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, options);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1,
    };
  }
}

/**
 * Spawn a process
 * @param command Command to execute
 * @param args Command arguments
 * @param options Spawn options
 * @returns Child process
 */
export function spawn(command: string, args: string[] = [], options: any = {}): ChildProcess {
  return cpSpawn(command, args, {
    stdio: 'pipe',
    ...options,
  });
}
