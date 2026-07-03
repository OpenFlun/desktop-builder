import { runCLI, build } from './lib/build.js';

// =================================== lib/build.js ===================================
/**
 * ```js
 * // 文件导出内容
 * build();  // 构建桌面应用程序
 * runCLI(); // 解析 process.argv 并执行对应的构建命令
 * ```
 * >查看定义:@see {@link build}、{@link runCLI}
 */
declare module './lib/build.js' {
    export * from './lib/build.js';
}

// =================================== 模块导出入口 ===================================
/**
 * 模块 主要功能：
 * ```js
 * build();           // 构建桌面应用程序
 * ```
 * ---
 * >查看定义:@see {@link build}
 * @example
 *  // 基础示例
 *   import { build } from '@flun/desktop-builder';
 *
 *   await build();
 */
declare module './index.js' {
    export { build } from './lib/build.js';
}