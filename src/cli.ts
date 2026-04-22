#!/usr/bin/env node

import { Command } from "commander";
import { runCliCommand } from "./cli-runner.js";
import type { CliOptions } from "./types.js";

const program = new Command();

program
  .name("mockdoctor")
  .description("Compare virtual-service files against OpenAPI or JSON contracts.")
  .version("0.1.0");

program
  .command("compare")
  .description("Compare virtual-service files against a contract.")
  .option("-c, --config <path>", "Path to a mockdoctor config file")
  .option("-r, --readyapi <path>", "Path to a ReadyAPI project XML or composite-style directory")
  .option("-s, --service <names...>", "Optional ReadyAPI virtual service names to filter")
  .option("-o, --openapi <path>", "Path to an OpenAPI file")
  .option("-j, --contract <path>", "Path to a simple JSON contract file")
  .option("--html-report <path>", "Write a styled HTML report when drift is found")
  .option("--format <format>", "Output format: text or json")
  .action(async (_value, command: Command) => {
    const options = command.opts() as CliOptions;
    process.exitCode = await runCliCommand(options);
  });

await program.parseAsync(process.argv);
