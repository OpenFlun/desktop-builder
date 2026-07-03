#!/usr/bin/env node
import { runCLI, build } from './lib/build.js';
if (import.meta.url === `file://${process.argv[1]}`) await runCLI();
export { build };