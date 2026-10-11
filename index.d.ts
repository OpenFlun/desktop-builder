import { markVerified, optimizeNodeModules, clearVerified, SELF_HASH } from './optimize-node-modules.js';
import { runCLI, build } from './build.js';

// =================================== optimize-node-modules.js ===================================
/**
 * ```js
 * // 文件导出内容
 * markVerified();        // 标记快照 verified=true（构建全流程成功后由 build.js 调用）
 * optimizeNodeModules(); // 执行 node_modules 六阶段优化
 * clearVerified();       // 清除快照中的 verified 标记
 * SELF_HASH;             // 当前优化文件的 SHA256 前 16 位（缓存指纹）
 * ```
 * >查看定义:@see {@link markVerified}、{@link optimizeNodeModules}、{@link clearVerified}、{@link SELF_HASH}
 */
declare module './optimize-node-modules.js' {
    export * from './optimize-node-modules.js';
}

// =================================== build.js ===================================
/**
 * ```js
 * // 文件导出内容
 * build();  // 构建桌面应用程序
 * runCLI(); // 解析 process.argv 并执行对应的构建命令
 * ```
 * >查看定义:@see {@link build}、{@link runCLI}
 */
declare module './build.js' {
    export * from './build.js';
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
    export { build } from './build.js';
}