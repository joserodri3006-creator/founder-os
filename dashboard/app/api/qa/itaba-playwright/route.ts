import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

type FlatResult = {
  title: string;
  suite: string;
  file: string;
  line: number | null;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
  skipReason?: string;
};

function testDir() {
  return process.env.QA_ITABA_TEST_DIR ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../qa/itaba-playwright");
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function flattenResults(raw: any): FlatResult[] {
  const rows: FlatResult[] = [];
  function walk(suite: any, parents: string[] = []) {
    for (const spec of suite.specs ?? []) {
      const test = spec.tests?.[0];
      const result = test?.results?.[0] ?? {};
      const annotations = [
        ...(test?.annotations ?? []),
        ...(result?.annotations ?? []),
      ];
      const resultStatus = result.status ?? test?.status;
      const status: FlatResult["status"] = resultStatus === "skipped"
        ? "skipped"
        : spec.ok && resultStatus === "passed"
          ? "passed"
          : "failed";
      const error = (result.errors ?? [])
        .map((e: any) => stripAnsi(e.message ?? ""))
        .filter(Boolean)
        .join("\n\n") || (result.error?.message ? stripAnsi(result.error.message) : "");
      rows.push({
        title: spec.title,
        suite: parents.join(" › "),
        file: spec.file,
        line: spec.line ?? null,
        status,
        durationMs: result.duration ?? 0,
        error: error || undefined,
        skipReason: annotations.find((a: any) => a.type === "skip")?.description,
      });
    }
    for (const child of suite.suites ?? []) {
      walk(child, [...parents, child.title].filter(Boolean));
    }
  }
  for (const suite of raw.suites ?? []) walk(suite, []);
  return rows;
}

function readLatestResults() {
  const dir = testDir();
  const file = path.join(dir, "test-results", "results.json");
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const rows = flattenResults(raw);
  return {
    stats: {
      total: rows.length,
      passed: rows.filter(r => r.status === "passed").length,
      failed: rows.filter(r => r.status === "failed").length,
      skipped: rows.filter(r => r.status === "skipped").length,
      durationMs: raw.stats?.duration ?? 0,
      startTime: raw.stats?.startTime ?? null,
    },
    results: rows,
  };
}

export async function GET() {
  const dir = testDir();
  return NextResponse.json({
    runnerEnabled: process.env.QA_ALLOW_LOCAL_RUNNER === "1",
    testDir: dir,
    exists: existsSync(dir),
    latest: readLatestResults(),
  });
}

export async function POST(req: NextRequest) {
  if (process.env.QA_ALLOW_LOCAL_RUNNER !== "1") {
    return NextResponse.json({
      error: "QA Runner ist deaktiviert. Setze QA_ALLOW_LOCAL_RUNNER=1 auf einem lokalen Founder-OS-Runner.",
    }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "side-effects" ? "side-effects" : "normal";
  const dir = testDir();
  if (!existsSync(dir)) return NextResponse.json({ error: `Testverzeichnis nicht gefunden: ${dir}` }, { status: 404 });

  const env = {
    ...process.env,
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/hermes/.playwright",
    ...(mode === "side-effects" ? { RUN_SIDE_EFFECTS: "1" } : {}),
  };
  const args = mode === "side-effects" ? ["run", "test:side-effects"] : ["test"];

  try {
    const run = await execFileAsync("npm", args, {
      cwd: dir,
      env,
      timeout: 10 * 60 * 1000,
      maxBuffer: 1024 * 1024 * 5,
    });
    return NextResponse.json({ ok: true, mode, stdout: run.stdout, stderr: run.stderr, latest: readLatestResults() });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      mode,
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      error: err.message ?? "Testlauf fehlgeschlagen",
      latest: readLatestResults(),
    }, { status: 200 });
  }
}
