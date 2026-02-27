/**
 * Seed script — populates the service store DB from @als/service-graph
 * and data/services/ filesystem artefacts.
 *
 * Run with: npx tsx scripts/seed-service-store.ts
 *
 * Options:
 *   --clear   Clear existing data before seeding (default: true)
 */

import Database from "better-sqlite3";
import path from "path";
import { SqliteAdapter } from "../packages/evidence/src/adapters/sqlite-adapter";
import { ServiceArtefactStore } from "../packages/service-store/src/service-store";
import { ServiceGraphStore } from "../packages/service-store/src/graph-store";
import { seedServiceStore } from "../packages/service-store/src/seed";

async function main() {
  const clear = !process.argv.includes("--no-clear");
  const dbPath = path.join(__dirname, "..", "data", "services.db");
  const servicesDir = path.join(__dirname, "..", "data", "services");

  console.log(`[seed-service-store] DB: ${dbPath}`);
  console.log(`[seed-service-store] Services dir: ${servicesDir}`);
  console.log(`[seed-service-store] Clear: ${clear}`);

  const adapter = await SqliteAdapter.create(dbPath);

  const artefactStore = new ServiceArtefactStore(adapter);
  const graphStore = new ServiceGraphStore(adapter);

  await artefactStore.init();
  await graphStore.init();

  const result = await seedServiceStore(adapter, {
    servicesDir,
    clear,
  });

  console.log("\n--- Seed complete ---");
  console.log(`  Graph services: ${result.graphServices}`);
  console.log(`  Full services:  ${result.fullServices}`);
  console.log(`  Edges:          ${result.edges}`);
  console.log(`  Life events:    ${result.lifeEvents}`);

  // Verify
  const count = await artefactStore.count();
  console.log(`\n  Total services in DB: ${count}`);

  adapter.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
