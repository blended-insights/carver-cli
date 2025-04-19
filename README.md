# Carver CLI

The Carver CLI is a lightweight, developer-friendly command-line interface that watches local file changes and synchronizes with Carver's cloud services to provide intelligent, context-aware AI assistance for software development workflows.

## Features

- 💻 **Simple CLI Interface**: Easy-to-use commands for all Carver operations
- 🔄 **File Change Monitoring**: Automatically tracks project changes
- 🔐 **Secure Authentication**: Safe API key storage
- 🧠 **Context-Aware Prompts**: Generate AI prompts with project context
- 🚀 **Git Integration**: Works seamlessly with your Git workflow

## Installation

```bash
npm install -g carver-cli
```

## Usage

### Initialize a Project

```bash
carver init --key YOUR_API_KEY
```

This will initialize Carver in the current directory. Optionally, specify a project ID to link to an existing Carver project:

```bash
carver init --key YOUR_API_KEY --project YOUR_PROJECT_ID
```

### Check Project Status

```bash
carver status
```

### Watch for File Changes

```bash
carver watch
```

This will start monitoring your project for file changes and sync them with Carver.

### Generate Context-Aware Prompts

For a specific file:

```bash
carver prompt --file path/to/file.js
```

Using a specific template:

```bash
carver prompt --template feature --file path/to/file.js
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
- `npm run dev` - Run in development mode
- `npm run lint` - Run linting
- `npm test` - Run tests

## Architecture

The Carver CLI follows a modular architecture:

- **Commands**: Implementations for CLI commands
- **Services**: Core service logic
- **Utils**: Utility functions
- **Types**: TypeScript type definitions
- **Templates**: Prompt templates

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on contributing to the project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
