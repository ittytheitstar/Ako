import { describe, it, expect } from 'vitest';
import { parsePlugin } from '../src/parser';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

function createFakePlugin(files: Record<string, string>): string {
  const dir = join(tmpdir(), `test-plugin-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  return dir;
}

describe('parsePlugin', () => {
  it('extracts component and version from version.php', () => {
    const dir = createFakePlugin({
      'version.php': `<?php
$plugin->component = 'mod_test';
$plugin->version = 20240101;
$plugin->release = '1.0';
`,
    });
    const manifest = parsePlugin(dir);
    expect(manifest.component).toBe('mod_test');
    expect(manifest.type).toBe('mod');
    expect(manifest.version).toBe('20240101');
    rmSync(dir, { recursive: true });
  });

  it('returns empty arrays when no db/access.php exists', () => {
    const dir = createFakePlugin({ 'version.php': '<?php $plugin->component = \'local_foo\'; $plugin->version = 1;' });
    const manifest = parsePlugin(dir);
    expect(manifest.capabilities).toEqual([]);
    rmSync(dir, { recursive: true });
  });

  it('parses language strings', () => {
    const dir = createFakePlugin({
      'version.php': '<?php $plugin->component = \'local_hello\'; $plugin->version = 1;',
      'lang/en/hello.php': `<?php
$string['pluginname'] = 'Hello World';
$string['greeting'] = 'Welcome to Ako';
`,
    });
    const manifest = parsePlugin(dir);
    expect(manifest.langStrings['pluginname']).toBe('Hello World');
    expect(manifest.langStrings['greeting']).toBe('Welcome to Ako');
    rmSync(dir, { recursive: true });
  });

  it('parses capabilities from db/access.php', () => {
    const dir = createFakePlugin({
      'version.php': '<?php $plugin->component = \'mod_test\'; $plugin->version = 1;',
      'db/access.php': `<?php
$capabilities = [
  'mod/test:view' => ['riskbitmask' => 0],
  'mod/test:submit' => ['riskbitmask' => 0],
];
`,
    });
    const manifest = parsePlugin(dir);
    expect(manifest.capabilities.length).toBe(2);
    expect(manifest.capabilities[0].name).toBe('mod/test:view');
    rmSync(dir, { recursive: true });
  });

  it('detects hook functions from lib.php', () => {
    const dir = createFakePlugin({
      'version.php': '<?php $plugin->component = \'mod_test\'; $plugin->version = 1;',
      'lib.php': `<?php
function mod_test_get_coursemodule_info($cm) { return null; }
function mod_test_supports($feature) { return true; }
`,
    });
    const manifest = parsePlugin(dir);
    expect(manifest.hooks).toContain('mod_test_get_coursemodule_info');
    expect(manifest.hooks).toContain('mod_test_supports');
    rmSync(dir, { recursive: true });
  });
});
