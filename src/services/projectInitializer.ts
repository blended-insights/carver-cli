import * as fs from "fs";
import * as path from "path";
import * as simpleGit from "simple-git";
import { logger } from "../utils/logger";
import { ConfigService } from "./configService";
import { ApiService } from "./api";
import { AuthService } from "./auth";

export interface InitializationOptions {
  key: string;
  project?: string;
  directory: string;
  name?: string;
  description?: string;
  useGit?: boolean;
  force?: boolean;
}

export interface InitializationResult {
  projectId?: string;
  projectName: string;
  configPath: string;
}

export class ProjectInitializer {
  /**
   * Initialize a new Carver project
   * @param options Initialization options
   * @returns Initialization result
   */
  async initialize(options: InitializationOptions): Promise<InitializationResult> {
    const { key, project, directory, name, description, useGit = true, force = false } = options;

    // Check if directory exists
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }

    // Check if project is already initialized
    const configService = new ConfigService(directory);
    if (configService.isInitialized() && !force) {
      throw new Error("Project is already initialized. Use --force to reinitialize.");
    }

    // Initialize Auth service and API service
    const authService = new AuthService();
    await authService.authenticateWithApiKey(key);
    const apiService = new ApiService(authService);

    // Create or get project from API
    let projectId = project;
    let projectName = name || path.basename(directory);
    let projectDescription = description;

    if (!projectId) {
      logger.info("No project ID provided, creating a new project...");

      // Get Git info if available
      if (useGit) {
        try {
          const git = simpleGit.default(directory);
          const isRepo = await git.checkIsRepo();

          if (isRepo) {
            logger.debug("Git repository detected");

            // Get remote URL
            const remotes = await git.getRemotes(true);
            const origin = remotes.find((remote) => remote.name === "origin");

            if (origin && origin.refs.fetch) {
              logger.debug(`Git remote URL: ${origin.refs.fetch}`);

              if (!projectDescription) {
                projectDescription = `Project from Git repository: ${origin.refs.fetch}`;
              }
            }

            // Get branch name
            const branch = await git.branch();
            if (branch.current) {
              logger.debug(`Current branch: ${branch.current}`);
            }
          }
        } catch (error) {
          logger.debug("Error detecting Git repository:", error);
        }
      }

      // Create new project
      const result = await this.createProject(apiService, {
        name: projectName,
        description: projectDescription,
      });

      projectId = result.id;
      projectName = result.name;
      logger.info(`Created new project with ID: ${projectId}`);
    } else {
      // Verify project exists
      try {
        const projectInfo = await apiService.getProject(projectId);
        projectName = projectInfo.name;
        logger.info(`Using existing project: ${projectName} (${projectId})`);
      } catch (error) {
        throw new Error(`Project not found or access denied: ${projectId}`);
      }
    }

    // Save configuration
    const config = {
      projectId,
      projectName,
      apiKey: key,
      lastSync: new Date().toISOString(),
    };

    configService.saveConfig(config);

    // Create .carver directory with README
    const carverDir = path.join(directory, ".carver");
    if (!fs.existsSync(carverDir)) {
      fs.mkdirSync(carverDir, { recursive: true });
    }

    const readmePath = path.join(carverDir, "README.md");
    fs.writeFileSync(
      readmePath,
      `# Carver Project

This directory contains Carver configuration files. Do not edit these files directly.

Project ID: ${projectId}
Project Name: ${projectName}
Initialized: ${new Date().toISOString()}
`,
    );

    // Add .carver to .gitignore if not already there
    if (useGit) {
      this.updateGitignore(directory);
    }

    // Create initial .carverignore if it doesn't exist
    this.createCarverignore(directory);

    logger.info("Project configuration saved");

    return {
      projectId,
      projectName,
      configPath: path.join(carverDir, "config.json"),
    };
  }

  /**
   * Create a new project on the API
   * @param apiService API service instance
   * @param params Project creation parameters
   * @returns Created project
   */
  private async createProject(
    apiService: ApiService,
    params: {
      name: string;
      description?: string;
    },
  ): Promise<any> {
    try {
      const project = await apiService.createProject(params);
      return project;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create project: ${errorMessage}`);
    }
  }

  /**
   * Update .gitignore file to include .carver directory
   * @param directory Project directory
   */
  private updateGitignore(directory: string): void {
    const gitignorePath = path.join(directory, ".gitignore");
    const carverPattern = ".carver/";

    try {
      let content = "";

      // Read existing .gitignore if it exists
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, "utf-8");

        // Check if .carver/ is already in .gitignore
        if (content.includes(carverPattern)) {
          return;
        }

        // Add a newline if the file doesn't end with one
        if (content && !content.endsWith("\n")) {
          content += "\n";
        }
      }

      // Add .carver/ pattern
      content += `# Carver CLI configuration\n${carverPattern}\n`;

      // Write updated .gitignore
      fs.writeFileSync(gitignorePath, content);
      logger.debug("Updated .gitignore file");
    } catch (error) {
      logger.warn("Failed to update .gitignore file:", error);
    }
  }

  /**
   * Create initial .carverignore file with default patterns
   * @param directory Project directory
   */
  private createCarverignore(directory: string): void {
    const carverignorePath = path.join(directory, ".carverignore");

    // Skip if file already exists
    if (fs.existsSync(carverignorePath)) {
      return;
    }

    const defaultIgnorePatterns = [
      "# Carver ignore file",
      "# Patterns for files and directories to ignore during watch",
      "",
      "# Dependencies",
      "node_modules/**",
      "bower_components/**",
      "vendor/**",
      "",
      "# Build outputs",
      "dist/**",
      "build/**",
      "out/**",
      "coverage/**",
      "",
      "# Logs",
      "*.log",
      "logs/**",
      "",
      "# Temporary files",
      "tmp/**",
      "temp/**",
      "",
      "# Carver internal",
      ".carver/**",
      "",
      "# Large files",
      "*.zip",
      "*.tar.gz",
      "*.tgz",
      "*.jar",
      "*.war",
      "*.ear",
      "*.iso",
      "*.dmg",
      "*.exe",
      "*.dll",
      "*.so",
      "*.dylib",
      "*.pdf",
      "",
      "# IDE specific",
      ".idea/**",
      ".vscode/**",
      ".project",
      ".classpath",
      "*.sublime-*",
      "",
      "# Common OS files",
      ".DS_Store",
      "Thumbs.db",
      "ehthumbs.db",
      "Desktop.ini",
      "$RECYCLE.BIN/**",
      "",
    ].join("\n");

    try {
      fs.writeFileSync(carverignorePath, defaultIgnorePatterns);
      logger.debug("Created .carverignore file");
    } catch (error) {
      logger.warn("Failed to create .carverignore file:", error);
    }
  }
}
