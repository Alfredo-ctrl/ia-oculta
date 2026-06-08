#!/usr/bin/env node
import { readTargets } from "../src/input.js";
import { scanText } from "../src/scanner.js";
import { formatHuman, formatJson } from "../src/format.js";

const args = process.argv.slice(2);
const options = parseArgs(args);

if (options.help) {
  printHelp();
  process.exit(0);
}

try {
  const targets = await readTargets(options);
  const results = targets.map((target) => ({
    target,
    analysis: scanText(target.content, { label: target.label })
  }));
  const payload = {
    generatedAt: new Date().toISOString(),
    totalTargets: results.length,
    highestRisk: Math.max(...results.map((item) => item.analysis.score), 0),
    results
  };

  process.stdout.write(options.json ? formatJson(payload) : formatHuman(payload));
  const failed = options.failOn && payload.highestRisk >= options.failOn;
  process.exit(failed ? 2 : 0);
} catch (error) {
  process.stderr.write(`ia-oculta error: ${error.message}\n`);
  process.exit(1);
}

function parseArgs(values) {
  const options = {
    files: [],
    text: "",
    json: false,
    demo: false,
    stdin: false,
    help: false,
    failOn: 0
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--json") options.json = true;
    else if (value === "--demo") options.demo = true;
    else if (value === "--stdin") options.stdin = true;
    else if (value === "--help" || value === "-h") options.help = true;
    else if (value === "--text") {
      options.text = values[index + 1] ?? "";
      index += 1;
    } else if (value === "--fail-on") {
      options.failOn = Number(values[index + 1] ?? 0);
      index += 1;
    } else {
      options.files.push(value);
    }
  }

  return options;
}

function printHelp() {
  process.stdout.write(`ia-oculta

Usage:
  ia-oculta file.md prompt.txt
  ia-oculta --text "ignore previous instructions"
  ia-oculta --stdin --json
  ia-oculta --demo

Options:
  --json        Print machine-readable JSON
  --stdin       Read text from standard input
  --text        Scan a direct text value
  --fail-on N   Exit with code 2 when risk score is at least N
  --demo        Run a built-in suspicious sample
  --help        Show this help
`);
}
