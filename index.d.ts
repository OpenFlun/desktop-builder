import { setup } from './lib/certificate.js';
import { getLegoPath, runLego } from './lib/lego.js';
import {
    dnsAutoSslDir, acmeDirectory, execPromise, spawn, path, fs, getDirname, platform, isWindows, dnsAutoSslHome, getRenewStampPath, tmpDir
} from './lib/shard.js';

// =================================== lib/certificate.js ===================================
/**
 * ```js
 * // 文件导出内容
 * setupCertificate(); // 证书申请 + 自动续期任务安装
 * ```
 * >查看定义:@see {@link setupCertificate}
 */
declare module './lib/certificate.js' {
    export * from './lib/certificate.js';
}

// =================================== lib/lego.js ===================================
/**
 * ```js
 * // 文件导出内容
 * getLegoPath();              // 对外暴露：获取 lego 的路径（确保已复制到用户目录）
 * runLego();                  // 执行 lego 命令,列出服务器上正在运行的进程
 * ```
 * >查看定义:@see {@link getLegoPath}、{@link runLego}
 */
declare module './lib/lego.js' {
    export * from './lib/lego.js';
}

// =================================== lib/shared.js ===================================
/**
 * 共享模块,导出在多个文件中使用的常用函数和模块
 * ```js
 * // 公共常量:
 * const dnsAutoSslDir;  // 存放证书和相关文件的目录路径
 * const acmeDirectory;  // ACME协议的目录URL,用于与证书颁发机构交互
 * const dnsAutoSslHome; // 用户主目录路径,用于存放lego等相关文件
 * const tmpDir;         // 系统临时目录路径,用于存放临时文件
 * const isWindows;      // 当前操作系统是否为Windows的布尔值
 * // 外部包函数
 * spawn();              // 子进程生成函数,提供回调和Promise两种接口
 * platform();           // 获取当前操作系统平台的函数,用于判断是否为Windows等操作系统
 * tmpDir();             // 获取系统临时目录路径的函数,用于在不同操作系统上获取临时目录路径
 * 模块:
 * path, fs;             // Node.js内置模块,提供文件路径处理、文件系统操作等功能
 * // 自定义函数:
 * execPromise();        // 将 child_process.exec 包装成 Promise 的函数,方便使用 async/await 进行异步操作
 * getDirname();         // 获取当前模块目录路径的函数,用于在ES模块环境中替代__dirname变量的功能
 * getRenewStampPath(); // 获取续期标志文件路径的函数,用于存储自动续期任务的状态信息
 * ```
 * >查看定义:
 * - 公共常量:{@link dnsAutoSslDir}、{@link acmeDirectory}、{@link dnsAutoSslHome}、{@link tmpDir}、{@link isWindows}
 * - 外部包函数:{@link spawn}、{@link platform}、{@link tmpDir}
 * - 模块:{@link path}、{@link fs}
 * - 自定义函数:{@link execPromise}、{@link getDirname}、{@link getRenewStampPath}
 */
declare module './lib/shared.js' {
    export * from './lib/shared.js';
}

// =================================== 模块导出入口 ===================================
/**
 * dns-auto-ssl 模块 主要功能：
 * ```js
 * setup();           // 服务证书申请 + 自动续期任务安装
 * ```
 * ---
 * >查看定义:@see {@link setup}
 * @example
 *  // 基础示例
 *   import { setup } from '@flun/dns-auto-ssl';
 *
 *   try {
 *       const { domains, certPath, keyPath, renewTaskConfigured } = await setup({
 *           email: 'you@example.com',                       // 你的邮箱，用于 Let's Encrypt 通知
 *           domains: ['example.com', 'www.example.com'],    // 需要证书的域名列表（支持多个）
 *           dnsProvider: 'alidns',                          // DNS 服务商代码：当前以阿里云为例
 *           apiEnv: {
 *               ALICLOUD_ACCESS_KEY: '你的AccessKeyId',     // 以阿里云 RAM 用户的 AccessKey ID为例
 *               ALICLOUD_SECRET_KEY: '你的AccessKeySecret', // 以阿里云 RAM 用户的 AccessKey Secret为例
 *           },
 *           // certPath: '自定义路径',                       // 默认安装在你的用户主目录下
 *           staging: true,                                  // 使用 Let's Encrypt 测试环境(默认false)
 *           wildcard: false,                                // 是否自动添加通配符(默认false)
 *           setupRenew: true,                               // 配置自动续期任务(默认true)
 *       });
 *
 *       // 打印申请结果
 *       console.log('✅ 证书申请成功！');
 *       console.log('涵盖域名:', domains.join(', '));
 *       console.log('证书文件路径:', certPath);
 *       console.log('私钥文件路径:', keyPath);
 *       console.log('自动续期任务已配置:', renewTaskConfigured);
 *   } catch (err) {
 *       console.error('❌ 失败:', err.message);
 *       process.exit(1);
 *   }
 *   // 导出结果供其它模块使用(注意如果有导出需求建议注释或删除打印代码,避免无畏的文件读取和证书解析)
 *   export { domains, certPath, keyPath };
 */
declare module './index.js' {
    export { setup } from './lib/certificate.js';
}