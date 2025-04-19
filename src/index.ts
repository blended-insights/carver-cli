import { program } from 'commander';
import { loadCommands } from './commands';
import { initializeLogger } from './utils/logger';
import { loadConfig } from './utils/config';

// Initialize core services
initializeLogger();
loadConfig();

// Register commands
loadCommands(program);

// Parse command line arguments
program.parse(process.argv);

// Display help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
