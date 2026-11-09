import {
    CUR_ARCH, CUR_PLAT, SELF_HASH, SNAPSHOT_FILE, clearVerified, findFileRecursive, getElectronCacheDir,
    markVerified, optimizeNodeModules, promotePeerDeps
} from './optimize-node-modules.js';
import { TEMP_ROOT, build } from './build.js';

// =================================== optimize-node-modules.js ===================================
/**
 * ```js
 * // 文件导出内容
 * const CUR_ARCH;        // 当前系统架构
 * const CUR_PLAT;        // 当前系统平台
 * const SELF_HASH;       // 当前优化文件的 SHA256 前 16 位(缓存指纹)
 * const SNAPSHOT_FILE;   // 依赖快照文件名
 * clearVerified();       // 清除快照中的 verified 标记
 * findFileRecursive();   // 递归查找文件
 * getElectronCacheDir(); // 获取 electron 缓存目录
 * markVerified();        // 标记快照中的 verified 标记
 * optimizeNodeModules(); // 执行 node_modules 六阶段优化
 * promotePeerDeps();     // 将生产依赖树中实际存在的 peer 依赖提升为根依赖
 * ```
 * >查看定义:@see {@link CUR_ARCH},{@link CUR_PLAT},{@link SELF_HASH},{@link SNAPSHOT_FILE},
 * {@link clearVerified},{@link findFileRecursive},{@link getElectronCacheDir},{@link markVerified},
 * {@link optimizeNodeModules},{@link promotePeerDeps}
 */
declare module './optimize-node-modules.js' {
    export * from './optimize-node-modules.js';
}

// =================================== build.js ===================================
/**
 * ```js
 * // 文件导出内容
 * const TEMP_ROOT;  // 临时构建目录根路径
 * build();          // 构建桌面应用程序
 * ```
 * >查看定义:@see {@link TEMP_ROOT},{@link build}
 */
declare module './build.js' {
    export * from './build.js';
}

// =================================== 模块导出入口 ===================================
/**
 * 模块 主要功能:
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