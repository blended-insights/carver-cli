import { Command } from 'commander';
import { registerInitCommand } from './init';
import { registerStatusCommand } from './status';
import { registerWatchCommand } from './watch';
import { registerPromptCommand } from './prompt';
// Import other commands...

export function loadCommands(program: Command): void {
  registerInitCommand(program);
  registerStatusCommand(program);
  registerWatchCommand(program);
  registerPromptCommand(program);
  // Register other commands...
}
