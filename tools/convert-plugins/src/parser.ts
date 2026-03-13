import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { MoodlePluginManifest, MoodleCapability, MoodleDbTable, MoodleEventSubscription } from './types';

/**
 * Parses a Moodle plugin directory and extracts metadata into a manifest.
 *
 * PHP is not executed – the parser uses regex-based extraction which covers
 * the majority of well-formed Moodle plugins. Complex dynamic PHP will require
 * manual review.
 */
export function parsePlugin(pluginDir: string): MoodlePluginManifest {
  const dirName = basename(pluginDir);
  const versionPhp = readPhpFile(join(pluginDir, 'version.php'));

  const version = extractPhpString(versionPhp, 'version') ?? '0';
  const release = extractPhpString(versionPhp, 'release');
  const maturity = extractPhpString(versionPhp, 'maturity');
  const requires = extractPhpString(versionPhp, 'requires');

  // Determine component type from plugin directory structure or version.php
  const componentMatch = versionPhp.match(/\$plugin->component\s*=\s*['"]([^'"]+)['"]/);
  const component = componentMatch?.[1] ?? `local_${dirName}`;
  const parts = component.split('_');
  const type = parts[0];
  // Short name is everything after the first underscore (e.g. "forum" from "mod_forum")
  const name = parts.slice(1).join('_') || dirName;

  const capabilities = parseCapabilities(pluginDir);
  const langStrings = parseLangStrings(pluginDir, name);
  const dbTables = parseDbSchema(pluginDir);
  const events = parseEvents(pluginDir);
  const hooks = detectHooks(pluginDir);

  return { component, type, name, version, release, maturity, requires, capabilities, langStrings, dbTables, events, hooks };
}

function readPhpFile(path: string): string {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

function extractPhpString(php: string, key: string): string | undefined {
  const re = new RegExp(`\\$plugin->${key}\\s*=\\s*['"]?([^'";]+)['"]?\\s*;`);
  const m = php.match(re);
  return m?.[1]?.trim();
}

function parseCapabilities(pluginDir: string): MoodleCapability[] {
  const accessPhp = readPhpFile(join(pluginDir, 'db', 'access.php'));
  const caps: MoodleCapability[] = [];
  // Match capability array keys like 'mod/forum:addpost'
  const capRe = /'([a-z_/]+:[a-z_]+)'\s*=>/g;
  let m: RegExpExecArray | null;
  while ((m = capRe.exec(accessPhp)) !== null) {
    caps.push({ name: m[1] });
  }
  return caps;
}

function parseLangStrings(pluginDir: string, name: string): Record<string, string> {
  const langFile = join(pluginDir, 'lang', 'en', `${name}.php`);
  const php = readPhpFile(langFile);
  const strings: Record<string, string> = {};
  // Match $string['key'] = 'value';
  const re = /\$string\['([^']+)'\]\s*=\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(php)) !== null) {
    strings[m[1]] = m[2];
  }
  return strings;
}

function parseDbSchema(pluginDir: string): MoodleDbTable[] {
  const installXml = readPhpFile(join(pluginDir, 'db', 'install.xml'));
  if (!installXml) return [];

  const tables: MoodleDbTable[] = [];
  // Very simplified XML parsing – real implementation would use a proper XML parser
  const tableRe = /<TABLE[^>]+NAME="([^"]+)"/gi;
  const fieldRe = /<FIELD[^>]+NAME="([^"]+)"[^>]+TYPE="([^"]+)"/gi;

  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(installXml)) !== null) {
    const fields: { name: string; type: string }[] = [];
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(installXml)) !== null) {
      fields.push({ name: fm[1], type: fm[2] });
    }
    tables.push({ name: tm[1], fields });
  }
  return tables;
}

function parseEvents(pluginDir: string): MoodleEventSubscription[] {
  const eventsPhp = readPhpFile(join(pluginDir, 'db', 'events.php'));
  const subs: MoodleEventSubscription[] = [];
  const re = /'eventname'\s*=>\s*'([^']+)'[^,]+,'callback'\s*=>\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(eventsPhp)) !== null) {
    subs.push({ eventclass: m[1], callback: m[2] });
  }
  return subs;
}

function detectHooks(pluginDir: string): string[] {
  const libPhp = readPhpFile(join(pluginDir, 'lib.php'));
  const hooks: string[] = [];
  // Common Moodle hook function patterns: pluginname_hook_name
  const re = /^function\s+([a-z_]+_[a-z_]+)\s*\(/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(libPhp)) !== null) {
    hooks.push(m[1]);
  }
  return hooks;
}
