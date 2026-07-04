#!/usr/bin/env node
import { runCLI, build } from './lib/build.js';
import { pathToFileURL } from 'url';

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runCLI();
export { build };