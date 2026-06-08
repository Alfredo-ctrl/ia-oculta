const invisiblePatterns = [
  { name: "zero width space", regex: /\u200B/g, severity: "high", weight: 18 },
  { name: "zero width joiner", regex: /\u200D/g, severity: "high", weight: 18 },
  { name: "word joiner", regex: /\u2060/g, severity: "high", weight: 18 },
  { name: "byte order mark", regex: /\uFEFF/g, severity: "medium", weight: 10 },
  { name: "bidirectional override", regex: /[\u202A-\u202E\u2066-\u2069]/g, severity: "critical", weight: 28 },
  { name: "soft hyphen", regex: /\u00AD/g, severity: "medium", weight: 8 }
];

const phraseRules = [
  { name: "instruction override", regex: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+instructions?\b/gi, severity: "critical", weight: 30 },
  { name: "system prompt request", regex: /\b(system prompt|developer message|hidden instructions?|internal policy)\b/gi, severity: "high", weight: 22 },
  { name: "exfiltration wording", regex: /\b(reveal|leak|dump|print|exfiltrate)\s+(the\s+)?(secret|token|key|credentials?|system)\b/gi, severity: "critical", weight: 32 },
  { name: "tool misuse instruction", regex: /\b(run|execute|open|visit|download)\s+(this|the)?\s*(command|url|script|payload)\b/gi, severity: "medium", weight: 12 },
  { name: "role confusion", regex: /\b(you are now|act as|pretend to be)\s+(admin|root|system|developer)\b/gi, severity: "high", weight: 18 },
  { name: "security bypass", regex: /\b(bypass|jailbreak|disable|override)\s+(safety|policy|guardrails?|filters?)\b/gi, severity: "critical", weight: 30 }
];

const encodedRule = {
  name: "encoded blob",
  regex: /\b(?:[A-Za-z0-9+/]{32,}={0,2}|[A-Fa-f0-9]{40,})\b/g,
  severity: "medium",
  weight: 14
};

const homoglyphGroups = [
  { name: "cyrillic latin lookalikes", regex: /[АВЕЅІЈКМНОРСТХаесорух]/g, severity: "medium", weight: 9 },
  { name: "mathematical alphanumeric symbols", regex: /[\u{1D400}-\u{1D7FF}]/gu, severity: "medium", weight: 9 }
];

export function scanText(text, options = {}) {
  const findings = [
    ...scanPatterns(text, invisiblePatterns, "invisible-character"),
    ...scanPatterns(text, phraseRules, "prompt-injection"),
    ...scanPatterns(text, [encodedRule], "encoded-content"),
    ...scanPatterns(text, homoglyphGroups, "lookalike-text"),
    ...scanDensity(text)
  ].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count);

  const score = scoreFindings(findings, text);
  const verdict = score >= 70 ? "blocked" : score >= 38 ? "review" : "clean";

  return {
    label: options.label ?? "text",
    score,
    verdict,
    length: text.length,
    lines: text.split(/\r?\n/).length,
    findings,
    summary: summarize(findings, score, verdict)
  };
}

function scanPatterns(text, rules, category) {
  return rules.flatMap((rule) => {
    const matches = [...text.matchAll(rule.regex)];
    if (!matches.length) return [];

    return [{
      category,
      name: rule.name,
      severity: rule.severity,
      count: matches.length,
      locations: matches.slice(0, 8).map((match) => locate(text, match.index ?? 0)),
      preview: preview(text, matches[0].index ?? 0),
      weight: rule.weight
    }];
  });
}

function scanDensity(text) {
  const chars = [...text];
  const ascii = chars.filter((char) => char.charCodeAt(0) <= 127).length;
  const total = chars.length || 1;
  const nonAsciiRate = 1 - ascii / total;
  const controlCount = chars.filter((char) => {
    const code = char.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  }).length;
  const findings = [];

  if (nonAsciiRate > 0.18) {
    findings.push({
      category: "text-density",
      name: "high non-ascii density",
      severity: "low",
      count: Math.round(nonAsciiRate * 100),
      locations: [],
      preview: "",
      weight: 6
    });
  }

  if (controlCount > 0) {
    findings.push({
      category: "text-density",
      name: "control characters",
      severity: "medium",
      count: controlCount,
      locations: [],
      preview: "",
      weight: 12
    });
  }

  return findings;
}

function scoreFindings(findings, text) {
  const base = findings.reduce((sum, item) => {
    const multiplier = Math.min(3, 1 + Math.log10(item.count || 1));
    return sum + item.weight * multiplier;
  }, 0);
  const lengthRelief = text.length > 12000 ? 0.82 : 1;
  return Math.round(Math.min(100, base * lengthRelief));
}

function summarize(findings, score, verdict) {
  if (!findings.length) return "No hidden Unicode, injection wording, or encoded payloads were detected.";
  const critical = findings.filter((item) => item.severity === "critical").length;
  const high = findings.filter((item) => item.severity === "high").length;
  return `${verdict.toUpperCase()} risk ${score}/100 with ${findings.length} finding groups, ${critical} critical and ${high} high.`;
}

function locate(text, index) {
  const before = text.slice(0, index);
  const line = before.split(/\r?\n/).length;
  const column = before.length - Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"), -1);
  return { line, column };
}

function preview(text, index) {
  return text.slice(Math.max(0, index - 36), Math.min(text.length, index + 72)).replace(/\s+/g, " ").trim();
}

function severityRank(value) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[value] ?? 0;
}
