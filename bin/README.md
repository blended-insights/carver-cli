# Carver CLI Executable

This directory contains the main CLI executable that is used when the package is installed globally.

## File: carver.js

The `carver.js` file is the main entry point for the CLI when installed. It has a shebang line (`#!/usr/bin/env node`) which allows it to be executed directly as a command on Unix-like systems.

This file simply requires the compiled JavaScript from the `dist` directory, which contains the transpiled TypeScript code.

## Global Installation

When the package is installed globally with `npm install -g carver-cli`, the `carver` command becomes available in the terminal, and it executes this script.

## Development Usage

During development, you can:

1. Use `npm link` in the project root to symlink the package globally
2. Use `npm run dev` to run the TypeScript code directly with ts-node
3. Use `npm run build` to compile the TypeScript code to JavaScript and then run the CLI with `node bin/carver.js`
