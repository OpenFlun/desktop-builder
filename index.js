#!/usr/bin/env node

import { build } from './lib/build.js';

const args = process.argv.slice(2), command = args[0];
if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
        Usage:
          desktop-builder build     Build the desktop application using desktopAppConfig.js
  `);
    process.exit(0);
}

if (command === 'build') await build();
else {
    console.error(`Unknown command: ${command}`);
    console.log('Run "desktop-builder" or "desktop-builder --help" for usage.');
    process.exit(1);
}