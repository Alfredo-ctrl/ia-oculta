const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

export function formatJson(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function formatHuman(payload) {
  const blocks = [
    header(payload),
    ...payload.results.map((item) => targetBlock(item))
  ];

  return `${blocks.join("\n\n")}\n`;
}

function header(payload) {
  const riskColor = colorFor(payload.highestRisk);
  return [
    `${colors.bold}ia-oculta${colors.reset} ${colors.dim}hidden AI prompt safety scanner${colors.reset}`,
    `${colors.dim}targets:${colors.reset} ${payload.totalTargets}  ${colors.dim}highest risk:${colors.reset} ${riskColor}${payload.highestRisk}/100${colors.reset}`
  ].join("\n");
}

function targetBlock(item) {
  const { analysis } = item;
  const lines = [
    `${colors.bold}${analysis.label}${colors.reset}`,
    `verdict: ${verdictColor(analysis.verdict)}${analysis.verdict}${colors.reset}  score: ${colorFor(analysis.score)}${analysis.score}/100${colors.reset}  lines: ${analysis.lines}  chars: ${analysis.length}`,
    analysis.summary
  ];

  if (!analysis.findings.length) return lines.join("\n");

  lines.push("");
  lines.push("findings:");

  analysis.findings.forEach((finding) => {
    const locationText = finding.locations.length
      ? finding.locations.map((loc) => `${loc.line}:${loc.column}`).join(", ")
      : "global";
    lines.push(`  ${severityLabel(finding.severity)} ${finding.name} (${finding.category}) x${finding.count} at ${locationText}`);
    if (finding.preview) lines.push(`     ${colors.dim}${finding.preview}${colors.reset}`);
  });

  return lines.join("\n");
}

function severityLabel(severity) {
  const color = {
    low: colors.cyan,
    medium: colors.yellow,
    high: colors.red,
    critical: colors.magenta
  }[severity] ?? colors.reset;
  return `${color}${severity.padEnd(8)}${colors.reset}`;
}

function colorFor(score) {
  if (score >= 70) return colors.magenta;
  if (score >= 38) return colors.yellow;
  return colors.green;
}

function verdictColor(verdict) {
  if (verdict === "blocked") return colors.magenta;
  if (verdict === "review") return colors.yellow;
  return colors.green;
}
