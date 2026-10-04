#!/usr/bin/env node
import { runCLI, build } from './build.js';
import { fileURLToPath } from 'url';
import fs from 'fs';

let self = '', invoked = '';
try { self = fs.realpathSync(fileURLToPath(import.meta.url)) } catch (_) { }
try { if (process.argv[1]) invoked = fs.realpathSync(process.argv[1]) } catch (_) { }

if (self && invoked && self.toLowerCase() === invoked.toLowerCase()) await runCLI();
export { build };