<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

<!-- nx configuration end-->

- E2E tests (against example-robot) are run with `nx run example-client:e2e:local` (starts the robot, then runs the e2e suite)
- Unit tests: run `nx test <project>` (e.g. `nx test client`, `nx test react`). To run a single test file, use `nx test <project> --testFile=<name>` where `<name>` is a substring of the filename (e.g. `nx test client --testFile=struct-parser`). Do **not** invoke `vitest` directly — the Nx executor provides the required globals (describe, it, expect) and project-level config.
- To run multiple project tests in one command: `nx run-many -t test --projects=client,react`
