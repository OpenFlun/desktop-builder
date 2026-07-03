#!/usr/bin/env node
import { runCLI, build } from './lib/build.js';
await runCLI();
export { build };