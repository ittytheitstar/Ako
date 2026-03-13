import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parsePlugin } from './parser';
import { MoodlePluginManifest, ConversionReport } from './types';

export interface ConvertOptions {
  inputDir: string;
  outputDir: string;
  overwrite: boolean;
}

/**
 * Converts a Moodle plugin directory into an Ako TypeScript plugin skeleton.
 *
 * Generated files:
 *   package.json          – npm package with Ako plugin metadata
 *   src/index.ts          – plugin entry point + hook stubs
 *   src/permissions.ts    – Ako permission definitions mapped from Moodle capabilities
 *   src/types.ts          – TypeScript types for plugin-specific data
 *   src/db-schema.sql     – DB migrations mapped from install.xml
 *   src/lang/en.json      – Language strings converted from PHP
 *   README.md             – Conversion report and manual work notes
 */
export async function runConvert(opts: ConvertOptions): Promise<void> {
  console.log(`\n🔄 Ako Plugin Converter`);
  console.log(`   Input  : ${opts.inputDir}`);
  console.log(`   Output : ${opts.outputDir}\n`);

  if (!existsSync(opts.inputDir)) {
    console.error(`❌  Input directory not found: ${opts.inputDir}`);
    process.exit(1);
  }

  if (existsSync(opts.outputDir) && !opts.overwrite) {
    console.error(`❌  Output directory already exists. Use --overwrite to replace.`);
    process.exit(1);
  }

  const manifest = parsePlugin(opts.inputDir);
  const report = buildReport(manifest);

  mkdirSync(join(opts.outputDir, 'src', 'lang'), { recursive: true });

  write(opts.outputDir, 'package.json', generatePackageJson(manifest));
  write(opts.outputDir, 'src/index.ts', generateIndexTs(manifest));
  write(opts.outputDir, 'src/permissions.ts', generatePermissionsTs(manifest));
  write(opts.outputDir, 'src/types.ts', generateTypesTs(manifest));
  write(opts.outputDir, 'src/db-schema.sql', generateDbSchema(manifest));
  write(opts.outputDir, 'src/lang/en.json', JSON.stringify(manifest.langStrings, null, 2));
  write(opts.outputDir, 'README.md', generateReadme(manifest, report));
  write(opts.outputDir, 'tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2020', module: 'CommonJS', strict: true,
      esModuleInterop: true, skipLibCheck: true, outDir: 'dist', rootDir: 'src',
    },
    include: ['src/**/*'], exclude: ['node_modules', 'dist'],
  }, null, 2));

  console.log(`✅  Plugin skeleton generated at: ${opts.outputDir}`);
  console.log(`\n📋 Conversion summary`);
  console.log(`   Auto-mapped     : ${report.autoMapped.length} items`);
  console.log(`   Manual required : ${report.manualRequired.length} items`);
  if (report.warnings.length > 0) {
    console.log(`   Warnings        : ${report.warnings.length}`);
    report.warnings.forEach(w => console.log(`     ⚠️  ${w}`));
  }
}

function write(dir: string, relPath: string, content: string): void {
  const full = join(dir, relPath);
  writeFileSync(full, content, 'utf8');
  console.log(`  ✍️   ${relPath}`);
}

function buildReport(manifest: MoodlePluginManifest): ConversionReport {
  const autoMapped: string[] = [];
  const manualRequired: string[] = [];
  const warnings: string[] = [];

  if (manifest.langStrings && Object.keys(manifest.langStrings).length > 0)
    autoMapped.push(`${Object.keys(manifest.langStrings).length} language strings`);

  if (manifest.capabilities.length > 0)
    autoMapped.push(`${manifest.capabilities.length} capabilities → Ako permissions`);

  if (manifest.dbTables.length > 0)
    autoMapped.push(`${manifest.dbTables.length} DB tables → SQL stubs`);

  if (manifest.events.length > 0)
    autoMapped.push(`${manifest.events.length} event subscriptions → stubs`);

  if (manifest.hooks.length > 0) {
    manualRequired.push(`${manifest.hooks.length} PHP hook functions need TypeScript reimplementation`);
    warnings.push('PHP business logic cannot be automatically converted. Review src/index.ts stubs.');
  }

  if (manifest.type === 'mod') {
    manualRequired.push('Course module UI (React component) must be implemented manually');
    manualRequired.push('Activity completion logic must be reimplemented');
  }

  warnings.push('All PHP logic is replaced with TODO stubs. Review each function carefully.');

  return { pluginComponent: manifest.component, autoMapped, manualRequired, warnings };
}

// ── Code generators ──────────────────────────────────────────────────────────

function generatePackageJson(m: MoodlePluginManifest): string {
  return JSON.stringify({
    name: `@ako/plugin-${m.name}`,
    version: m.version ? `${m.version.slice(0, 4)}.0.0` : '0.1.0',
    description: `Ako plugin: ${m.component} (converted from Moodle)`,
    private: true,
    main: 'dist/index.js',
    scripts: { build: 'tsc', dev: 'tsc --watch', test: "echo 'no tests yet'" },
    peerDependencies: { '@ako/sdk': 'workspace:*' },
    devDependencies: { typescript: '^5.4.5', '@types/node': '^20.0.0' },
    ako: {
      pluginType: m.type,
      component: m.component,
      moodleVersion: m.version,
      convertedAt: new Date().toISOString(),
    },
  }, null, 2);
}

function generateIndexTs(m: MoodlePluginManifest): string {
  const hookStubs = m.hooks.map(h =>
    `\n/**\n * TODO: Reimplement Moodle hook: ${h}()\n */\nexport async function ${toCamelCase(h)}(..._args: unknown[]): Promise<void> {\n  // TODO: implement\n  throw new Error('${h} not yet implemented');\n}`
  ).join('\n');

  const eventStubs = m.events.map(e =>
    `\n/**\n * TODO: Handle Moodle event: ${e.eventclass}\n * Original callback: ${e.callback}\n */\nexport async function on${toPascalCase(e.eventclass.split('\\\\').pop() ?? 'Event')}(_event: unknown): Promise<void> {\n  // TODO: implement\n}`
  ).join('\n');

  return `/**
 * ${m.component} – Ako plugin entry point
 *
 * Converted from Moodle plugin v${m.version ?? 'unknown'}.
 * Review all TODO stubs before enabling in production.
 */

import type { AkoPluginContext } from '@ako/sdk';

export const PLUGIN_ID = '${m.component}';
export const PLUGIN_VERSION = '${m.version ?? '0.1.0'}';

/**
 * Called when the plugin is registered with Ako.
 */
export async function register(_ctx: AkoPluginContext): Promise<void> {
  // TODO: Register extension points, routes, and event handlers
}

/**
 * Called when the plugin is enabled for a tenant or course.
 */
export async function enable(_ctx: AkoPluginContext): Promise<void> {
  // TODO: Perform any setup required on enable
}

/**
 * Called when the plugin is disabled.
 */
export async function disable(_ctx: AkoPluginContext): Promise<void> {
  // TODO: Clean up resources
}
${hookStubs}
${eventStubs}
`;
}

function generatePermissionsTs(m: MoodlePluginManifest): string {
  const perms = m.capabilities.map(c => {
    const akoName = c.name.replace(/[/:]/g, '.');
    return `  /** Moodle: ${c.name} */\n  '${akoName}',`;
  }).join('\n');

  return `/**
 * ${m.component} – Ako permission definitions
 * Mapped from Moodle capabilities in db/access.php
 */

export const PLUGIN_PERMISSIONS = [
${perms}
] as const;

export type PluginPermission = typeof PLUGIN_PERMISSIONS[number];
`;
}

function generateTypesTs(m: MoodlePluginManifest): string {
  const tableTypes = m.dbTables.map(t => {
    const fields = t.fields.map(f => `  ${f.name}: ${phpTypeToTs(f.type)};`).join('\n');
    return `/** ${t.name} */\nexport interface ${toPascalCase(t.name)} {\n${fields}\n}`;
  }).join('\n\n');

  return `/**
 * ${m.component} – TypeScript types
 * Generated from Moodle DB schema (db/install.xml)
 */

${tableTypes || '// No DB tables detected – add types here'}
`;
}

function generateDbSchema(m: MoodlePluginManifest): string {
  if (m.dbTables.length === 0) return `-- No tables detected from Moodle install.xml\n`;

  const tables = m.dbTables.map(t => {
    const cols = t.fields.map(f =>
      `  ${f.name} ${mdlTypeToSql(f.type)}${f.notnull ? ' NOT NULL' : ''}${f.default !== undefined ? ` DEFAULT ${f.default}` : ''}`
    ).join(',\n');
    return `-- Converted from Moodle table: ${t.name}\nCREATE TABLE IF NOT EXISTS ${m.name}_${t.name} (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  tenant_id UUID NOT NULL,\n${cols}\n);\n`;
  });

  return `-- ${m.component} – DB Schema\n-- Converted from Moodle install.xml\n-- Review column types and constraints before running.\n\n` + tables.join('\n');
}

function generateReadme(m: MoodlePluginManifest, report: ConversionReport): string {
  const autoList = report.autoMapped.map(x => `- ✅ ${x}`).join('\n');
  const manualList = report.manualRequired.map(x => `- ⚠️ ${x}`).join('\n');
  const warnList = report.warnings.map(x => `- ⚠️ ${x}`).join('\n');

  return `# ${m.component} – Ako Plugin Skeleton

> Converted from Moodle plugin v${m.version ?? 'unknown'} by \`convert-plugins\`

## Status

This is an **auto-generated skeleton**. PHP business logic has been replaced with
TypeScript stubs that must be reimplemented manually.

## Conversion Report

### Automatically mapped
${autoList || '_Nothing could be automatically mapped._'}

### Manual work required
${manualList || '_No manual work identified._'}

### Warnings
${warnList}

## Directory structure

\`\`\`
src/
  index.ts          Entry point: register, enable, disable + hook stubs
  permissions.ts    Ako permission names mapped from Moodle capabilities
  types.ts          TypeScript interfaces for plugin data
  db-schema.sql     Database migrations (review before running!)
  lang/en.json      Language strings
README.md           This file
package.json        npm package
tsconfig.json       TypeScript config
\`\`\`

## Getting started

1. Review every \`// TODO\` stub in \`src/index.ts\`
2. Verify DB schema in \`src/db-schema.sql\`
3. Register the plugin in the Ako admin console
`;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toPascalCase(s: string): string {
  const c = toCamelCase(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function phpTypeToTs(moodleType: string): string {
  const map: Record<string, string> = {
    int: 'number', integer: 'number', bigint: 'number',
    number: 'number', float: 'number',
    char: 'string', text: 'string', binary: 'string',
    datetime: 'string',
  };
  return map[moodleType.toLowerCase()] ?? 'unknown';
}

function mdlTypeToSql(moodleType: string): string {
  const map: Record<string, string> = {
    int: 'INTEGER', integer: 'INTEGER', bigint: 'BIGINT',
    number: 'NUMERIC(20,5)', float: 'DOUBLE PRECISION',
    char: 'TEXT', text: 'TEXT', binary: 'BYTEA',
    datetime: 'TIMESTAMPTZ',
  };
  return map[moodleType.toLowerCase()] ?? 'TEXT';
}
