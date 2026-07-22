#!/usr/bin/env node
import { spawn, execSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { resolveScenarios, SCENARIO_GROUPS } from "../scenarios/index";
import { runScenario, type ScenarioRunResult } from "./runScenario";
import { buildReport, writeJsonReport } from "../reports/serializer";
import { renderMarkdownReport } from "../reports/markdownReport";
import { renderHtmlReport } from "../reports/htmlReport";
import { ROW_PRESETS, resolveRowCount, type RowPresetName } from "../datasets/presets";
import { PREVIEW_URL } from "./browserConfig";

const APP_ROOT = path.resolve(import.meta.dirname, "../app");
const APP_VITE_CONFIG = path.join(APP_ROOT, "vite.config.ts");
const APP_DIST = path.join(APP_ROOT, ".dist-bench");
const REPORTS_DIR = path.resolve(import.meta.dirname, "../reports");

type Args = {
  scenarios: string[];
  rows: number[];
  columns: number;
  seed: number;
  all: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const arg = argv.find((a) => a.startsWith(`--${flag}=`));
    return arg ? arg.split("=").slice(1).join("=") : undefined;
  };

  const scenarioArg = get("scenario");
  const scenarios: string[] = [];
  if (scenarioArg) {
    for (const token of scenarioArg.split(",")) {
      if (SCENARIO_GROUPS[token]) scenarios.push(...SCENARIO_GROUPS[token]);
      else scenarios.push(token);
    }
  }

  const all = argv.includes("--all");
  const rowsArg = get("rows");
  let rows: number[];
  if (rowsArg) {
    rows = rowsArg.split(",").map((r) => resolveRowCount(isNaN(Number(r)) ? (r as RowPresetName) : Number(r)));
  } else if (all) {
    rows = Object.values(ROW_PRESETS);
  } else {
    rows = [ROW_PRESETS.XLARGE]; // 10,000 — fast inner-loop default
  }

  return {
    scenarios,
    rows,
    columns: Number(get("columns") ?? 20),
    seed: Number(get("seed") ?? 42),
    all,
  };
}

async function buildBenchApp(): Promise<void> {
  console.log("[bench] building bench/app (this may take ~15-20s)...");
  execSync(`npx vite build --config ${APP_VITE_CONFIG}`, { stdio: "inherit" });
}

function waitForPreviewReady(timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(PREVIEW_URL);
        if (res.ok) return resolve();
      } catch {
        // server not up yet
      }
      if (Date.now() - start > timeoutMs) return reject(new Error("bench/app preview server did not start in time"));
      setTimeout(check, 300);
    };
    check();
  });
}

async function withPreviewServer<T>(fn: () => Promise<T>): Promise<T> {
  if (!existsSync(APP_DIST)) await buildBenchApp();

  let server: ChildProcess | undefined;
  try {
    server = spawn("npx", ["vite", "preview", "--config", APP_VITE_CONFIG], {
      stdio: "pipe",
    });
    await waitForPreviewReady();
    return await fn();
  } finally {
    server?.kill();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenarios = resolveScenarios(args.scenarios.length ? args.scenarios : undefined);

  console.log(
    `[bench] running ${scenarios.length} scenario(s) × ${args.rows.length} dataset size(s): ` +
      `${scenarios.map((s) => s.id).join(", ")} @ rows=[${args.rows.join(", ")}]`,
  );

  const results: ScenarioRunResult[] = await withPreviewServer(async () => {
    const collected: ScenarioRunResult[] = [];
    for (const rows of args.rows) {
      for (const scenario of scenarios) {
        process.stdout.write(`[bench] ${scenario.id} @ ${rows.toLocaleString()} rows... `);
        const result = await runScenario({
          scenario,
          rows,
          columns: args.columns,
          seed: args.seed,
        });
        console.log(`done (${result.durationMs}ms)`);
        collected.push(result);
      }
    }
    return collected;
  });

  const report = buildReport(results, args.seed);
  const jsonPath = writeJsonReport(report, REPORTS_DIR);
  const markdown = renderMarkdownReport(report);
  const html = renderHtmlReport(report);

  const fs = await import("node:fs");
  const mdPath = jsonPath.replace(/\.json$/, ".md");
  const htmlPath = jsonPath.replace(/\.json$/, ".html");
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(path.join(REPORTS_DIR, "latest.md"), markdown);
  fs.writeFileSync(path.join(REPORTS_DIR, "latest.html"), html);

  console.log("\n" + markdown + "\n");
  console.log(`[bench] JSON:  ${jsonPath}`);
  console.log(`[bench] MD:    ${mdPath}`);
  console.log(`[bench] HTML:  ${htmlPath}`);

  const anyFail = report.results.some((r) => r.budget.status === "fail");
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error("[bench] failed:", err);
  process.exit(1);
});
