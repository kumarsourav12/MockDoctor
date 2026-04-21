import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ComparisonIssue, ComparisonResult } from "./types.js";

export function formatTextReport(result: ComparisonResult): string {
  const lines: string[] = [];

  lines.push("MockDoctor");
  lines.push(`ReadyAPI: ${result.readyApiPath}`);
  lines.push(`Contract: ${result.contractPath} (${result.contractType})`);
  lines.push(`Services checked: ${result.servicesChecked}`);
  lines.push(`Operations checked: ${result.operationsChecked}`);
  lines.push(`Responses checked: ${result.responsesChecked}`);

  if (result.issues.length === 0) {
    lines.push("No contract drift detected.");
    return lines.join("\n");
  }

  lines.push(`Issues found: ${result.issues.length}`);

  for (const [groupLabel, issues] of groupIssues(result.issues).entries()) {
    lines.push("");
    lines.push(groupLabel);

    for (const issue of issues) {
      lines.push(`  - [${issue.code}] ${issue.message}`);

      if (issue.details && issue.details.length > 0) {
        for (const detail of issue.details) {
          lines.push(`      ${detail}`);
        }
      }
    }
  }

  return lines.join("\n");
}

export function formatJsonReport(result: ComparisonResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatHtmlReport(result: ComparisonResult): string {
  const groups = [...groupIssues(result.issues).entries()];
  const summaryItems = [
    { label: "Services checked", value: String(result.servicesChecked) },
    { label: "Operations checked", value: String(result.operationsChecked) },
    { label: "Responses checked", value: String(result.responsesChecked) },
    { label: "Issues found", value: String(result.issues.length) }
  ];

  const groupMarkup =
    groups.length === 0
      ? `<section class="card empty-state"><h2>No contract drift detected.</h2><p>The compared virtual services match the configured contract.</p></section>`
      : groups
          .map(([groupLabel, issues]) => {
            const issueMarkup = issues
              .map((issue) => {
                const details =
                  issue.details && issue.details.length > 0
                    ? `<ul class="issue-details">${issue.details
                        .map((detail) => `<li>${escapeHtml(detail)}</li>`)
                        .join("")}</ul>`
                    : "";

                const meta = [
                  issue.statusCode ? `Status ${escapeHtml(issue.statusCode)}` : undefined,
                  issue.readyApiResponse ? `Response ${escapeHtml(issue.readyApiResponse)}` : undefined,
                  issue.readyApiOperation ? `Operation ${escapeHtml(issue.readyApiOperation)}` : undefined,
                  issue.readyApiService ? `Service ${escapeHtml(issue.readyApiService)}` : undefined
                ]
                  .filter((value): value is string => Boolean(value))
                  .map((value) => `<span class="meta-pill">${value}</span>`)
                  .join("");

                const sourceMarkup = [
                  issue.readyApiSource ? `ReadyAPI source: ${escapeHtml(relativeOrAbsolute(issue.readyApiSource))}` : undefined,
                  issue.contractSource ? `Contract source: ${escapeHtml(relativeOrAbsolute(issue.contractSource))}` : undefined
                ]
                  .filter((value): value is string => Boolean(value))
                  .map((value) => `<div class="source-line">${value}</div>`)
                  .join("");

                return `<article class="issue issue-${escapeHtml(issue.severity)}">
  <div class="issue-header">
    <span class="issue-code">${escapeHtml(issue.code)}</span>
    <span class="issue-severity">${escapeHtml(issue.severity)}</span>
  </div>
  <p class="issue-message">${escapeHtml(issue.message)}</p>
  <div class="issue-meta">${meta}</div>
  ${details}
  <div class="issue-sources">${sourceMarkup}</div>
</article>`;
              })
              .join("");

            return `<section class="card issue-group">
  <div class="group-label">${escapeHtml(groupLabel)}</div>
  <div class="issue-list">${issueMarkup}</div>
</section>`;
          })
          .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MockDoctor Drift Report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7fb;
        --panel: rgba(255, 255, 255, 0.92);
        --panel-border: rgba(20, 41, 82, 0.1);
        --text: #172033;
        --muted: #5d6b85;
        --accent: #0f5bd8;
        --accent-soft: rgba(15, 91, 216, 0.12);
        --danger: #c63d2f;
        --danger-soft: rgba(198, 61, 47, 0.12);
        --warning: #8f5b00;
        --shadow: 0 24px 64px rgba(31, 52, 93, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(15, 91, 216, 0.14), transparent 28%),
          radial-gradient(circle at top right, rgba(198, 61, 47, 0.12), transparent 26%),
          var(--bg);
      }
      .page {
        max-width: 1120px;
        margin: 0 auto;
        padding: 40px 20px 56px;
      }
      .hero {
        background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(242,247,255,0.92));
        border: 1px solid var(--panel-border);
        border-radius: 28px;
        box-shadow: var(--shadow);
        padding: 28px;
        margin-bottom: 24px;
      }
      .eyebrow {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      h1 {
        margin: 14px 0 10px;
        font-size: clamp(2rem, 4vw, 3.2rem);
        line-height: 1.05;
      }
      .hero p {
        margin: 0;
        max-width: 760px;
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.6;
      }
      .paths {
        display: grid;
        gap: 12px;
        margin-top: 22px;
      }
      .path-row {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(20, 41, 82, 0.08);
      }
      .path-label {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .path-value {
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
        font-size: 0.95rem;
        word-break: break-word;
      }
      .summary-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        margin-bottom: 24px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 22px;
        box-shadow: var(--shadow);
      }
      .summary-card {
        padding: 18px 20px;
      }
      .summary-label {
        color: var(--muted);
        font-size: 0.86rem;
        margin-bottom: 10px;
      }
      .summary-value {
        font-size: 2rem;
        font-weight: 700;
      }
      .summary-card.issues .summary-value {
        color: var(--danger);
      }
      .issue-group {
        padding: 22px;
        margin-bottom: 18px;
      }
      .group-label {
        margin-bottom: 16px;
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
        font-size: 0.95rem;
        font-weight: 700;
        color: #1e2d4d;
      }
      .issue-list {
        display: grid;
        gap: 14px;
      }
      .issue {
        border-radius: 18px;
        padding: 18px;
        background: rgba(248, 250, 255, 0.96);
        border: 1px solid rgba(20, 41, 82, 0.08);
      }
      .issue-error {
        border-color: rgba(198, 61, 47, 0.2);
        background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,244,242,0.94));
      }
      .issue-header {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 10px;
      }
      .issue-code,
      .issue-severity,
      .meta-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 0.78rem;
        font-weight: 700;
      }
      .issue-code {
        background: var(--danger-soft);
        color: var(--danger);
      }
      .issue-severity {
        background: rgba(143, 91, 0, 0.12);
        color: var(--warning);
        text-transform: uppercase;
      }
      .issue-message {
        margin: 0 0 12px;
        line-height: 1.6;
      }
      .issue-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .meta-pill {
        background: rgba(15, 91, 216, 0.1);
        color: var(--accent);
      }
      .issue-details {
        margin: 14px 0 0;
        padding-left: 20px;
        color: var(--muted);
      }
      .issue-details li + li {
        margin-top: 8px;
      }
      .issue-sources {
        margin-top: 14px;
        display: grid;
        gap: 6px;
      }
      .source-line {
        color: var(--muted);
        font-size: 0.9rem;
        word-break: break-word;
      }
      .empty-state {
        padding: 28px;
      }
      .empty-state h2 {
        margin: 0 0 10px;
      }
      .empty-state p {
        margin: 0;
        color: var(--muted);
      }
      @media (max-width: 640px) {
        .page {
          padding: 24px 14px 40px;
        }
        .hero,
        .issue-group {
          padding: 18px;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <span class="eyebrow">MockDoctor Drift Report</span>
        <h1>${result.issues.length === 0 ? "No contract drift detected" : "Contract drift needs attention"}</h1>
        <p>MockDoctor compared the configured virtual-service files against the selected contract and found ${escapeHtml(String(result.issues.length))} issue${result.issues.length === 1 ? "" : "s"}.</p>
        <div class="paths">
          <div class="path-row">
            <span class="path-label">ReadyAPI input</span>
            <div class="path-value">${escapeHtml(result.readyApiPath)}</div>
          </div>
          <div class="path-row">
            <span class="path-label">Contract input</span>
            <div class="path-value">${escapeHtml(result.contractPath)} (${escapeHtml(result.contractType)})</div>
          </div>
        </div>
      </section>
      <section class="summary-grid">
        ${summaryItems
          .map(
            (item) => `<article class="card summary-card${item.label === "Issues found" ? " issues" : ""}">
  <div class="summary-label">${escapeHtml(item.label)}</div>
  <div class="summary-value">${escapeHtml(item.value)}</div>
</article>`
          )
          .join("")}
      </section>
      ${groupMarkup}
    </main>
  </body>
</html>`;
}

export async function writeHtmlReport(result: ComparisonResult, outputPath: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatHtmlReport(result), "utf8");
}

function groupIssues(issues: ComparisonIssue[]): Map<string, ComparisonIssue[]> {
  const grouped = new Map<string, ComparisonIssue[]>();

  for (const issue of issues) {
    const label = [
      issue.operationKey ?? "General",
      issue.readyApiService ? `service=${issue.readyApiService}` : undefined,
      issue.readyApiSource ? relativeOrAbsolute(issue.readyApiSource) : undefined
    ]
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .join(" | ");
    const bucket = grouped.get(label) ?? [];
    bucket.push(issue);
    grouped.set(label, bucket);
  }

  return grouped;
}

function relativeOrAbsolute(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  return relativePath.length > 0 && !relativePath.startsWith("..") ? relativePath : filePath;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
