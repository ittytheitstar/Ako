import { existsSync } from 'fs';
import { parsePlugin } from './parser';

export interface ReportOptions {
  inputDir: string;
  jsonOutput: boolean;
}

/**
 * Analyses a Moodle plugin and prints a report of what can be auto-mapped
 * vs what requires manual work, without generating any output files.
 */
export async function runReport(opts: ReportOptions): Promise<void> {
  if (!existsSync(opts.inputDir)) {
    console.error(`❌  Input directory not found: ${opts.inputDir}`);
    process.exit(1);
  }

  const manifest = parsePlugin(opts.inputDir);

  if (opts.jsonOutput) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.log(`\n📋 Moodle Plugin Analysis: ${manifest.component}`);
  console.log(`   Version  : ${manifest.version ?? 'unknown'}`);
  console.log(`   Type     : ${manifest.type}`);
  console.log(`   Requires : ${manifest.requires ?? 'unknown'}`);

  console.log(`\n✅ Auto-mappable:`);
  if (manifest.langStrings && Object.keys(manifest.langStrings).length > 0)
    console.log(`   📝 ${Object.keys(manifest.langStrings).length} language strings`);
  if (manifest.capabilities.length > 0)
    console.log(`   🔐 ${manifest.capabilities.length} capabilities → Ako permissions`);
  if (manifest.dbTables.length > 0)
    console.log(`   🗄️  ${manifest.dbTables.length} DB table(s) → SQL stubs`);
  if (manifest.events.length > 0)
    console.log(`   📡 ${manifest.events.length} event subscription(s) → stubs`);

  console.log(`\n⚠️  Manual work required:`);
  if (manifest.hooks.length > 0) {
    console.log(`   🪝 ${manifest.hooks.length} PHP hook(s) need TypeScript reimplementation:`);
    manifest.hooks.slice(0, 10).forEach(h => console.log(`      - ${h}`));
    if (manifest.hooks.length > 10) console.log(`      … and ${manifest.hooks.length - 10} more`);
  } else {
    console.log(`   (none detected)`);
  }

  console.log(`\n💡 Run with --output to generate the skeleton.`);
}
