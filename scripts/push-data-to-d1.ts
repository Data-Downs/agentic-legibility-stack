/**
 * push-data-to-d1.ts
 *
 * Reads local SQLite databases (traces.db, personal-data.db) and pushes
 * the data to remote Cloudflare D1 databases via `wrangler d1 execute`.
 *
 * Usage:
 *   npx tsx scripts/push-data-to-d1.ts --all            # Push everything
 *   npx tsx scripts/push-data-to-d1.ts --evidence        # Push cases/traces only
 *   npx tsx scripts/push-data-to-d1.ts --personal-data   # Push personal data only
 */

import Database from "better-sqlite3";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import path from "path";

// ── Paths ──

const __dirname = typeof import.meta.dirname === "string"
  ? import.meta.dirname
  : path.dirname(new URL(import.meta.url).pathname);

const CITIZEN_DIR = path.resolve(__dirname, "../apps/citizen-experience");
const TEMP_DIR = path.resolve(__dirname, "../.tmp-d1-push");

// Try local Dev first, fall back to iCloud copy
const TRACES_DB_PATHS = [
  path.resolve(__dirname, "../apps/citizen-experience/data/traces.db"),
  "/Users/datadowns/Documents/GitHub 2/agentic-legibility-stack/apps/citizen-experience/data/traces.db",
];

const PERSONAL_DB_PATHS = [
  path.resolve(__dirname, "../apps/citizen-experience/data/personal-data.db"),
  "/Users/datadowns/Documents/GitHub 2/agentic-legibility-stack/apps/citizen-experience/data/personal-data.db",
];

const BATCH_SIZE = 50;

// ── Helpers ──

function findDB(paths: string[]): string {
  for (const p of paths) {
    if (existsSync(p)) {
      // Check it actually has data rows (not just empty tables)
      try {
        const db = new Database(p, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%'").all() as { name: string }[];
        let totalRows = 0;
        for (const t of tables) {
          const row = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get() as { cnt: number };
          totalRows += row.cnt;
        }
        db.close();
        if (totalRows > 0) return p;
      } catch { /* skip */ }
    }
  }
  throw new Error(`No valid database with data found. Checked:\n  ${paths.join("\n  ")}`);
}

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  // Escape single quotes by doubling them
  return `'${String(val).replace(/'/g, "''")}'`;
}

function runWrangler(dbName: string, filePath: string): void {
  execSync(
    `npx wrangler d1 execute ${dbName} --remote --file="${filePath}"`,
    { cwd: CITIZEN_DIR, stdio: "pipe", timeout: 120000 }
  );
}

function verifyWrangler(dbName: string, sql: string): string {
  const result = execSync(
    `npx wrangler d1 execute ${dbName} --remote --command="${sql}"`,
    { cwd: CITIZEN_DIR, stdio: "pipe", timeout: 30000 }
  );
  return result.toString();
}

interface PushTableOptions {
  dbName: string;
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  label?: string;
}

function pushTable({ dbName, tableName, columns, rows, label }: PushTableOptions): number {
  const tag = label || tableName;
  if (rows.length === 0) {
    console.log(`  ⏭  ${tag}: 0 rows, skipping`);
    return 0;
  }

  let pushed = 0;
  let failed = 0;
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const stmts = batch.map((row) => {
      const values = columns.map((col) => escapeSQL(row[col]));
      return `INSERT OR IGNORE INTO ${tableName} (${columns.join(", ")}) VALUES (${values.join(", ")});`;
    });
    const sql = stmts.join("\n");
    const filePath = path.join(TEMP_DIR, `${tableName}_batch_${batchNum}.sql`);
    writeFileSync(filePath, sql, "utf-8");

    try {
      runWrangler(dbName, filePath);
      pushed += batch.length;
      if (batchNum % 5 === 0 || batchNum === totalBatches) {
        console.log(`  ✓ ${tag}: batch ${batchNum}/${totalBatches} (${pushed}/${rows.length})`);
      }
    } catch (err: any) {
      // Retry one at a time
      console.log(`  ⚠ ${tag}: batch ${batchNum} failed, retrying individually...`);
      for (const row of batch) {
        const singleValues = columns.map((col) => escapeSQL(row[col]));
        const singleSql = `INSERT OR IGNORE INTO ${tableName} (${columns.join(", ")}) VALUES (${singleValues.join(", ")});`;
        const singlePath = path.join(TEMP_DIR, `${tableName}_single_${pushed}.sql`);
        writeFileSync(singlePath, singleSql, "utf-8");
        try {
          runWrangler(dbName, singlePath);
          pushed++;
        } catch {
          failed++;
          console.error(`  ✗ ${tag}: failed row with id=${row.id || row.case_id || "?"}`);
        }
      }
    }
  }

  console.log(`  ✅ ${tag}: ${pushed} pushed, ${failed} failed (of ${rows.length})`);
  return pushed;
}

// ── Evidence push ──

async function pushEvidence(): Promise<void> {
  const dbPath = findDB(TRACES_DB_PATHS);
  console.log(`\n📦 Evidence database: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });

  // 1. trace_events
  const traceEvents = db.prepare("SELECT * FROM trace_events").all() as Record<string, unknown>[];
  pushTable({
    dbName: "als-evidence",
    tableName: "trace_events",
    columns: ["id", "trace_id", "span_id", "parent_span_id", "timestamp", "type", "payload", "metadata", "created_at"],
    rows: traceEvents,
  });

  // 2. receipts
  const receipts = db.prepare("SELECT * FROM receipts").all() as Record<string, unknown>[];
  pushTable({
    dbName: "als-evidence",
    tableName: "receipts",
    columns: ["id", "trace_id", "capability_id", "timestamp", "citizen_id", "citizen_name", "action", "outcome", "details", "data_shared", "state_from", "state_to", "created_at"],
    rows: receipts,
  });

  // 3. cases
  const cases = db.prepare("SELECT * FROM cases").all() as Record<string, unknown>[];
  pushTable({
    dbName: "als-evidence",
    tableName: "cases",
    columns: [
      "case_id", "user_id", "service_id", "current_state", "status",
      "started_at", "last_activity_at", "states_completed", "progress_percent",
      "identity_verified", "eligibility_checked", "eligibility_result",
      "consent_granted", "handed_off", "handoff_reason",
      "agent_actions", "human_actions",
      "review_status", "review_requested_at", "review_reason",
      "event_count", "created_at",
    ],
    rows: cases,
  });

  // 4. case_events (has AUTOINCREMENT id, skip id column to let D1 assign)
  const caseEvents = db.prepare("SELECT * FROM case_events").all() as Record<string, unknown>[];
  pushTable({
    dbName: "als-evidence",
    tableName: "case_events",
    columns: ["id", "case_id", "trace_event_id", "trace_id", "event_type", "actor", "summary", "created_at"],
    rows: caseEvents,
  });

  db.close();

  // Verify
  console.log("\n🔍 Verifying als-evidence...");
  const verify = verifyWrangler(
    "als-evidence",
    "SELECT 'cases' as tbl, COUNT(*) as cnt FROM cases UNION ALL SELECT 'trace_events', COUNT(*) FROM trace_events UNION ALL SELECT 'case_events', COUNT(*) FROM case_events UNION ALL SELECT 'receipts', COUNT(*) FROM receipts;"
  );
  console.log(verify);
}

// ── Personal data push ──

async function pushPersonalData(): Promise<void> {
  const dbPath = findDB(PERSONAL_DB_PATHS);
  console.log(`\n📦 Personal data database: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });

  // 1. submitted_data
  const submitted = db.prepare("SELECT * FROM submitted_data").all() as Record<string, unknown>[];
  pushTable({
    dbName: "als-personal-data",
    tableName: "submitted_data",
    columns: ["id", "user_id", "field_key", "field_value", "category", "source", "created_at", "updated_at"],
    rows: submitted,
  });

  // 2. inferred_data
  const inferred = db.prepare("SELECT * FROM inferred_data").all() as Record<string, unknown>[];
  // Check which columns exist in the local DB
  const inferredCols = db.prepare("PRAGMA table_info(inferred_data)").all() as { name: string }[];
  const inferredColNames = inferredCols.map((c) => c.name);
  const baseCols = ["id", "user_id", "field_key", "field_value", "confidence", "source", "session_id", "extracted_from", "created_at", "updated_at"];
  // Only include mentions/superseded_by if they exist locally
  const extraCols = ["mentions", "superseded_by"].filter((c) => inferredColNames.includes(c));
  pushTable({
    dbName: "als-personal-data",
    tableName: "inferred_data",
    columns: [...baseCols, ...extraCols],
    rows: inferred,
  });

  // 3. service_access
  const access = db.prepare("SELECT * FROM service_access").all() as Record<string, unknown>[];
  pushTable({
    dbName: "als-personal-data",
    tableName: "service_access",
    columns: ["id", "user_id", "service_id", "field_key", "data_tier", "purpose", "granted_at", "revoked_at", "consent_record_id"],
    rows: access,
  });

  // 4. data_updates
  const updates = db.prepare("SELECT * FROM data_updates").all() as Record<string, unknown>[];
  pushTable({
    dbName: "als-personal-data",
    tableName: "data_updates",
    columns: ["id", "user_id", "field_key", "old_value", "new_value", "update_type", "services_notified", "created_at"],
    rows: updates,
  });

  db.close();

  // Verify
  console.log("\n🔍 Verifying als-personal-data...");
  const verify = verifyWrangler(
    "als-personal-data",
    "SELECT 'submitted_data' as tbl, COUNT(*) as cnt FROM submitted_data UNION ALL SELECT 'inferred_data', COUNT(*) FROM inferred_data UNION ALL SELECT 'service_access', COUNT(*) FROM service_access UNION ALL SELECT 'data_updates', COUNT(*) FROM data_updates;"
  );
  console.log(verify);
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);
  const doEvidence = args.includes("--evidence") || args.includes("--all") || args.length === 0;
  const doPersonal = args.includes("--personal-data") || args.includes("--all") || args.length === 0;

  console.log("🚀 ALS Data → D1 Push Tool");
  console.log(`   Evidence: ${doEvidence ? "YES" : "skip"}`);
  console.log(`   Personal Data: ${doPersonal ? "YES" : "skip"}`);

  // Prepare temp directory
  mkdirSync(TEMP_DIR, { recursive: true });

  try {
    if (doEvidence) await pushEvidence();
    if (doPersonal) await pushPersonalData();
    console.log("\n✅ Done!");
  } finally {
    // Clean up temp files
    try { rmSync(TEMP_DIR, { recursive: true }); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  // Clean up on error
  try { rmSync(TEMP_DIR, { recursive: true }); } catch { /* ignore */ }
  process.exit(1);
});
