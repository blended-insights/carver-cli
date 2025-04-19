# Contributing to Carver CLI

Thank you for your interest in contributing to Carver CLI! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Development Environment Setup](#development-environment-setup)
  - [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Commit Guidelines](#commit-guidelines)
  - [Pull Requests](#pull-requests)
- [Coding Standards](#coding-standards)
  - [TypeScript Guidelines](#typescript-guidelines)
  - [Testing Guidelines](#testing-guidelines)
  - [Documentation Guidelines](#documentation-guidelines)
- [Release Process](#release-process)
- [Community](#community)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We expect all contributors to be respectful, inclusive, and considerate in all interactions.

## Getting Started

### Development Environment Setup

1. **Prerequisites**

   - Node.js (v16 or higher)
   - npm (v7 or higher)
   - Git

2. **Installation**

   ```bash
   # Clone the repository
   git clone https://github.com/blended-insights/carver-cli.git
   cd carver-cli

   # Install dependencies
   npm install

   # Build the project
   npm run build

   # Link the CLI for local development
   npm link
   ```

3. **Verification**
   ```bash
   # Verify the installation
   carver --version
   ```

### Project Structure

The project follows this structure:

```
carver-cli/
├── bin/                    # Executable entry points
├── src/                    # Source code
│   ├── commands/           # CLI command implementations
│   ├── services/           # Core services
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript type definitions
│   └── templates/          # Prompt templates
├── tests/                  # Test suite
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── fixtures/           # Test fixtures
└── docs/                   # Documentation
```

## Development Workflow

### Branching Strategy

We follow a simplified GitFlow workflow:

- `main`: Production-ready code
- `develop`: Development branch, main integration branch
- `feature/*`: New features or enhancements
- `fix/*`: Bug fixes
- `docs/*`: Documentation changes
- `refactor/*`: Code refactoring without feature changes

### Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for our commit messages:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types include:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to the build process, tooling, etc.

Example:

```
feat(watch): add support for custom ignore patterns

This adds the ability to specify custom file patterns to ignore during watching.

Closes #123
```

### Pull Requests

1. Create a branch from `develop` following the branching strategy
2. Make your changes and commit them following the commit guidelines
3. Push your branch to your fork
4. Open a pull request against the `develop` branch
5. Ensure all CI checks pass
6. Request a review from a maintainer
7. Address any feedback

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Maintain strict typing and avoid using `any` type
- Follow the existing code style
- Use async/await for asynchronous operations
- Document public APIs with JSDoc comments

### Testing Guidelines

- Write unit tests for all new functionality
- Ensure all tests pass before submitting a pull request
- Maintain or improve code coverage
- Integration tests should be used for commands and end-to-end scenarios
- Mock external dependencies in unit tests

### Documentation Guidelines

- Update documentation for all new features and changes
- Use clear, concise language
- Include examples where appropriate
- Keep README.md up to date
- Document API changes

## Release Process

Our releases follow [Semantic Versioning](https://semver.org/):

1. We use semantic-release for automated versioning and publishing
2. Changes merged to `main` trigger a release
3. Version numbers are determined automatically based on commit messages
4. Release notes are generated automatically from commit messages

## Community

- **Reporting Bugs**: Open an issue with the bug template
- **Requesting Features**: Open an issue with the feature request template
- **Questions**: Use GitHub Discussions for questions
- **Contact**: Join our [community channels] for direct communication

Thank you for contributing to Carver CLI! Your efforts help make this project better for everyone.
