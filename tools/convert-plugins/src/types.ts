/**
 * Moodle plugin manifest types and helpers.
 *
 * A Moodle plugin directory typically contains:
 *   version.php         – version, release, maturity, requires
 *   db/access.php       – capability definitions
 *   db/install.xml      – database schema
 *   db/events.php       – event subscriptions
 *   lang/en/<name>.php  – language strings
 *   lib.php             – main plugin library (hooks)
 *   classes/            – PHP classes / namespace
 *   templates/          – Mustache templates
 *   amd/                – AMD JavaScript modules
 */

export interface MoodlePluginManifest {
  /** Plugin type + name, e.g. "mod_forum" */
  component: string;
  /** Plugin type: mod | block | local | auth | enrol | report | … */
  type: string;
  /** Plugin short name, e.g. "forum" */
  name: string;
  version: string;
  release?: string;
  maturity?: string;
  /** Moodle version this plugin requires */
  requires?: string;
  capabilities: MoodleCapability[];
  langStrings: Record<string, string>;
  dbTables: MoodleDbTable[];
  events: MoodleEventSubscription[];
  hooks: string[];
}

export interface MoodleCapability {
  name: string;
  riskbitmask?: number;
  defaultUserRoles?: Record<string, string>;
}

export interface MoodleDbTable {
  name: string;
  fields: MoodleDbField[];
  indexes?: string[];
}

export interface MoodleDbField {
  name: string;
  type: string;
  notnull?: boolean;
  default?: string;
}

export interface MoodleEventSubscription {
  eventclass: string;
  callback: string;
}

/** Summary of what the converter was able to map automatically. */
export interface ConversionReport {
  pluginComponent: string;
  autoMapped: string[];
  manualRequired: string[];
  warnings: string[];
}
