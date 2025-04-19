import { Command } from 'commander';
import { registerInitCommand } from './init';
import { registerStatusCommand } from './status';
import { registerWatchCommand } from './watch';
import { registerPromptCommand } from './prompt';
import { registerLoginCommand } from './login';
import { registerLogoutCommand } from './logout';

export function loadCommands(program: Command): void {
  // Register all commands
  registerInitCommand(program);
  registerStatusCommand(program);
  registerWatchCommand(program);
  registerPromptCommand(program);
  registerLoginCommand(program);
  registerLogoutCommand(program);
}
