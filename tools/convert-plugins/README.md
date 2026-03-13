# convert-plugins

A CLI tool for converting Moodle PHP plugins into Ako TypeScript plugin skeletons.

## Overview

This tool analyses a Moodle plugin directory and produces a TypeScript skeleton
that can be used as the starting point for an Ako-native plugin.

> **Honest disclaimer:** Arbitrary PHP logic cannot be fully auto-converted.
> The tool provides scaffolding and mapping stubs; the business logic must be
> reimplemented manually.

## What gets converted

| Artefact | Status |
|----------|--------|
| Plugin metadata (`version.php`) | ✅ Extracted |
| Language strings (`lang/en/*.php`) | ✅ → `src/lang/en.json` |
| Capabilities (`db/access.php`) | ✅ → `src/permissions.ts` |
| DB schema (`db/install.xml`) | ✅ → `src/db-schema.sql` stubs |
| Event subscriptions (`db/events.php`) | ✅ → stubs in `src/index.ts` |
| Hook functions (`lib.php`) | ⚙️ Detected, stubs generated |
| PHP business logic | ❌ Must be reimplemented manually |
| Mustache templates | ❌ Must be converted to React |
| AMD JavaScript modules | ❌ Must be rewritten |

## Usage

```bash
# Install dependencies
pnpm install

# Analyse a plugin (no files written)
node dist/index.js report --input /path/to/moodle/mod/myplugin

# Generate a skeleton
node dist/index.js convert \
  --input /path/to/moodle/mod/myplugin \
  --output ./ako-plugin-myplugin

# Overwrite existing skeleton
node dist/index.js convert \
  --input /path/to/moodle/mod/myplugin \
  --output ./ako-plugin-myplugin \
  --overwrite
```

## Output structure

```
<output-dir>/
  src/
    index.ts          Plugin entry point with hook/event stubs
    permissions.ts    Ako permission names from Moodle capabilities
    types.ts          TypeScript types from DB schema
    db-schema.sql     SQL migrations from install.xml
    lang/en.json      Language strings
  package.json
  tsconfig.json
  README.md           Conversion report
```

## Workflow

1. Run `convert-plugins report` to understand the conversion scope
2. Run `convert-plugins convert` to generate the skeleton
3. Review every `// TODO` in `src/index.ts`
4. Reimplement business logic
5. Convert Mustache templates to React components
6. Test the plugin in a local Ako development environment
7. Register via the Ako admin console

## Extending the converter

The converter is structured as:
- `src/parser.ts` – reads and extracts Moodle plugin metadata
- `src/converter.ts` – generates Ako plugin skeleton files
- `src/reporter.ts` – prints analysis without writing files
- `src/types.ts` – shared types
