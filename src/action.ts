import { runGitHubAction } from "./action-runner.js";

process.exitCode = await runGitHubAction(process.env);
