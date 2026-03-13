#!/usr/bin/env node
/**
 * convert-plugins – CLI entry point
 *
 * Converts a Moodle PHP plugin folder into an Ako TypeScript plugin skeleton.
 *
 * Usage:
 *   convert-plugins convert --input <moodle-plugin-dir> --output <ako-plugin-dir>
 *   convert-plugins report  --input <moodle-plugin-dir>
 */
import { Command } from 'commander';
import { runConvert } from './converter';
import { runReport } from './reporter';

const program = new Command();

program
  .name('convert-plugins')
  .description('Convert Moodle PHP plugins to Ako TypeScript plugin skeletons')
  .version('0.1.0');

program
  .command('convert')
  .description('Generate an Ako plugin skeleton from a Moodle plugin directory')
  .requiredOption('-i, --input <path>', 'Path to the Moodle plugin directory')
  .requiredOption('-o, --output <path>', 'Directory to write the Ako plugin skeleton into')
  .option('--overwrite', 'Overwrite existing files in the output directory', false)
  .action(async (opts) => {
    await runConvert({
      inputDir: opts.input,
      outputDir: opts.output,
      overwrite: opts.overwrite,
    });
  });

program
  .command('report')
  .description('Analyse a Moodle plugin and report what can be auto-mapped vs manual work')
  .requiredOption('-i, --input <path>', 'Path to the Moodle plugin directory')
  .option('--json', 'Output report as JSON', false)
  .action(async (opts) => {
    await runReport({
      inputDir: opts.input,
      jsonOutput: opts.json,
    });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
