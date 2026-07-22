import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { ScenarioRunResult } from "../runner/types";
import { evaluateBudget, type BenchReport } from "./schema";

function gitOr(fallback: string, cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function readVersion(): string {
  const pkgPath = path.resolve(import.meta.dirname, "../../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

export function buildReport(results: ScenarioRunResult[], seed: number): BenchReport {
  return {
    meta: {
      reaktiformVersion: readVersion(),
      commitSha: gitOr("unknown", "git rev-parse --short HEAD"),
      branch: gitOr("unknown", "git rev-parse --abbrev-ref HEAD"),
      timestamp: new Date().toISOString(),
      seed,
      node: process.version,
    },
    results: results.map((r) => ({ ...r, budget: evaluateBudget(r) })),
  };
}

export function writeJsonReport(report: BenchReport, outDir: string): string {
  mkdirSync(outDir, { recursive: true });
  const filename = `${report.meta.commitSha}-${Date.now()}.json`;
  const filePath = path.join(outDir, filename);
  writeFileSync(filePath, JSON.stringify(report, null, 2));
  writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(report, null, 2));
  return filePath;
}
