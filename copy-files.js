import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url), __dirname = path.dirname(__filename),
    fileName = 'desktopAppConfig.js', dirName = 'build', targetDir = path.resolve(process.env.INIT_CWD || process.cwd()),
    sourceFile = path.join(__dirname, fileName), targetFile = path.join(targetDir, fileName),
    sourceBuildDir = path.join(__dirname, dirName), targetBuildDir = path.join(targetDir, dirName),
    /**
     * 复制文件或目录到目标位置(内部辅助函数)
     * @param {string} source - 源路径
     * @param {string} target - 目标路径
     * @param {string} type - 'file' 或 'dir'
     * @param {string} label - 显示名称
     * @returns {boolean} 是否成功
     */
    copyItem = (source, target, type, label) => {
        try {
            if (fs.existsSync(target)) {
                console.log(chalk.green('✓ ') + chalk.greenBright('已存在: ') + chalk.gray(target));
                return true;
            }
            if (type === 'file') fs.copyFileSync(source, target);
            else if (type === 'dir') fs.cpSync(source, target, { recursive: true });
            console.log(chalk.green('✓ ') + chalk.greenBright(`已生成 ${label}: `) + chalk.gray(target));
            return true;
        } catch (error) {
            console.error(chalk.red('✗ ') + `复制 ${label} 失败: ` + error.message);
            return false;
        }
    };

/**
 * 复制配置文件和 build 目录到项目根目录
 * >查看定义:@see {@link copyFile}
 * @returns {boolean} - 全部复制是否成功
 */
const copyFile = () => {
    // 目标目录不是 Node 项目 || 包自身的 npm install(开发调试)→ 跳过
    if (!fs.existsSync(path.join(targetDir, 'package.json'))) return true;
    if (targetDir === path.resolve(__dirname, '..')) return true;

    console.log(chalk.gray('项目根目录: ') + targetDir);
    const fileOk = copyItem(sourceFile, targetFile, 'file', fileName),
        dirOk = copyItem(sourceBuildDir, targetBuildDir, 'dir', dirName);
    return fileOk && dirOk;
};

// 执行脚本并导出函数
if (process.argv[1] === __filename) copyFile();
export { copyFile };