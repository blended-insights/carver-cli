import { program } from 'commander';
import { loadCommands } from './commands';
import { initializeLogger } from './utils/logger';
import { loadConfig } from './utils/config';
import { version } from '../package.json';

// Configure the global CLI options
program
  .version(version)
  .description('Carver CLI - AI-assisted development workflow tool')
  .option('-q, --quiet', 'Suppress all output except errors')
  .option('-v, --verbose', 'Enable verbose output (debug level)')
  .option('--log-file <path>', 'Log output to specified file')
  .option('--config <path>', 'Use custom config file');

// Initialize core services
const initOptions = program.opts();
initializeLogger({
  quiet: initOptions.quiet,
  verbose: initOptions.verbose,
  logFile: initOptions.logFile,
});
loadConfig(initOptions.config);

// Register commands
loadCommands(program);

// Parse command line arguments
program.parse(process.argv);

// Display help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
