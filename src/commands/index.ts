import { Command } from 'commander';
import { registerInitCommand } from './init';
import { registerStatusCommand } from './status';
import { registerWatchCommand } from './watch';
import { registerPromptCommand } from './prompt';
import { createLoginCommand } from './login';
import { registerLogoutCommand } from './logout';
import { createSyncCommand } from './sync';

export function loadCommands(program: Command): void {
  // Register all commands
  registerInitCommand(program);
  registerStatusCommand(program);
  registerWatchCommand(program);
  registerPromptCommand(program);

  // Register API communication commands
  createLoginCommand(program);
  registerLogoutCommand(program);
  createSyncCommand(program);
}
