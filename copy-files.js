import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url), __dirname = path.dirname(__filename),
    fileName = 'desktopAppConfig.js', dirName = 'build', targetDir = path.resolve(__dirname, '../../..'),
    sourceFile = path.join(__dirname, fileName), targetFile = path.join(targetDir, fileName),
    sourceBuildDir = path.join(__dirname, dirName), targetBuildDir = path.join(targetDir, dirName);

/**
 * 复制文件或目录到目标位置（内部辅助函数）
 * @param {string} source - 源路径
 * @param {string} target - 目标路径
 * @param {string} type - 'file' 或 'dir'
 * @param {string} label - 显示名称
 * @returns {boolean} 是否成功
 */
const copyItem = (source, target, type, label) => {
    console.log(`🔍 检查 ${label}...`);
    try {
        if (fs.existsSync(target)) return console.log(`目标 ${label} 已存在，跳过复制;`), true;
        console.log(`⚠️ 在项目根目录未找到 ${label}，正在复制...`);
        if (type === 'file') fs.copyFileSync(source, target);
        else if (type === 'dir') fs.cpSync(source, target, { recursive: true });
        return console.log(`✓ 已创建 ${label}: ${target}`), true;
    } catch (error) {
        return console.error(`✗ 复制 ${label} 失败:`, error.message), false;
    }
};

/**
 * 复制配置文件和 build 目录到项目根目录
 * >查看定义:@see {@link copyFile}
 * @returns {boolean} - 全部复制是否成功
 */
const copyFile = () => {
    console.log(`📁 项目根目录: ${targetDir}`);
    const fileOk = copyItem(sourceFile, targetFile, 'file', fileName),
        dirOk = copyItem(sourceBuildDir, targetBuildDir, 'dir', dirName);
    return fileOk && dirOk;
};

// 执行脚本并导出函数
if (process.argv[1] === __filename) copyFile();
export { copyFile };