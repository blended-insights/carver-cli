# Carver CLI

The Carver CLI is a lightweight, developer-friendly command-line interface that watches local file changes and synchronizes with Carver's cloud services to provide intelligent, context-aware AI assistance for software development workflows.

## Features

- 💻 **Simple CLI Interface**: Easy-to-use commands for all Carver operations
- 🔄 **File Change Monitoring**: Automatically tracks project changes
- 🔐 **Secure Authentication**: Safe API key storage using system keychain
- 🧠 **Context-Aware Prompts**: Generate AI prompts with project context
- 🚀 **Git Integration**: Works seamlessly with your Git workflow

## Installation

```bash
npm install -g carver-cli
```

## Usage

### Authentication

You can log in to securely store your API key in the system keychain:

```bash
carver login
```

Or provide your key with the command:

```bash
carver login --key YOUR_API_KEY
```

To log out and remove stored credentials:

```bash
carver logout
```

### Initialize a Project

```bash
carver init
```

This will initialize Carver in the current directory using your stored API key. Or specify options:

```bash
carver init --key YOUR_API_KEY --project YOUR_PROJECT_ID --name "My Project"
```

### Check Project Status

```bash
carver status
```

For more detailed information:

```bash
carver status --verbose
```

### Watch for File Changes

```bash
carver watch
```

This will start monitoring your project for file changes and sync them with Carver. Additional options:

```bash
carver watch --ignore "*.log,temp/**" --interval 5000
```

### Generate Context-Aware Prompts

List available prompt templates:

```bash
carver prompt --list
```

For a specific file:

```bash
carver prompt --file path/to/file.js --template feature
```

Save to a file:

```bash
carver prompt --file path/to/file.js --template feature --output prompt.md
```

## Development

### Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

### Scripts

- `npm run build` - Build the project
- `npm run dev` - Run in development mode with ts-node
- `npm run lint` - Run linting
- `npm test` - Run tests
- `npm start` - Run the compiled CLI

## Architecture

The Carver CLI follows a modular architecture:

- **Commands**: Implementations for CLI commands
  - `init.ts` - Initialize a project
  - `status.ts` - Check project status
  - `watch.ts` - Watch for file changes
  - `prompt.ts` - Generate context-aware prompts
  - `login.ts` - Authentication management
  - `logout.ts` - Remove stored credentials

- **Services**: Core service logic
  - `api.ts` - API communication layer
  - `configService.ts` - Project configuration 
  - `credentialService.ts` - Secure credential storage
  - `fileWatcher.ts` - File change monitoring
  - `projectInitializer.ts` - Project setup

- **Utils**: Utility functions
  - `logger.ts` - Logging system with verbosity levels
  - `config.ts` - Global configuration 

- **Types**: TypeScript type definitions for type safety

## File Watching

The CLI uses Chokidar to efficiently watch for file changes with:
- Debouncing to prevent excessive API calls
- Ignore patterns from `.gitignore` and `.carverignore`
- Efficient change batching

## Secure Credential Storage

The CLI securely stores your API key in your system's keychain using the `keytar` library, which leverages:
- macOS: Keychain
- Windows: Credential Vault
- Linux: Secret Service API/libsecret

## Configuration

Configuration is stored in two locations:
- Global: `~/.carver/config.json`
- Project: `.carver/config.json` in project directory

A `.carverignore` file can be created to control which files are ignored during watching.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on contributing to the project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
