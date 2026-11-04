#!/usr/bin/env node
import chalk from 'chalk';
import { build } from '../build.js';
import { copyFile } from '../copy-files.js';

const [, , sub] = process.argv,
  // 输出用法
  printHelp = () => {
    const cmd = (name, desc) => `      ${chalk.cyanBright(name.padEnd(26))}${chalk.gray(desc)}`,
      grp = name => `    ${chalk.cyan(name)}`;
    console.log([
      `  ${chalk.blueBright('用法:')} desktop-builder <命令> [选项]`, '',
      grp('命令'),
      cmd('build', '构建桌面应用程序'),
      cmd('example', '重新生成 desktopAppConfig.js 与 build/ 到项目根'),
      cmd('help', '显示本帮助'), '',
      grp('build 选项'),
      cmd('--debug', '显示详细日志,含每个包的处理与 electron-builder 完整输出'), '',
      `  ${chalk.gray('desktopAppConfig.js 与 build/ 由 postinstall 自动生成;')}`,
      `  ${chalk.gray('若被误删,运行 desktop-builder example 重新生成;')}`
    ].join('\n'));
  },
  // 命令分发入口
  main = async () => {
    if (!sub || sub === 'help' || sub === '-h' || sub === '--help') return printHelp(), process.exit(0);
    if (sub === 'example') return copyFile() ? process.exit(0) : process.exit(1);
    if (sub === 'build') {
      if (process.argv.includes('--debug')) process.env.OPTIMIZE_DEBUG = '1';
      return await build();
    }
    console.error(chalk.red('✗ 未知命令: ') + chalk.yellow(sub)), console.log(''), printHelp(), process.exit(1);
  };

main().catch(e => (console.error(chalk.red('✗ ') + e.message), process.exit(1)));