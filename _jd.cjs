const fs = require('fs');
const f = 'D:/flun/desktop-builder/optimize-node-modules.js';
let s = fs.readFileSync(f, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
let lines = s.split(/\r?\n/);

// ============ 步骤1：尾部（markVerified、optimizeNodeModules 独立 + JSDoc）============
const idxMark = lines.findIndex(x => x.includes('markVerified = async tempDir =>'));
const idxExport = lines.findIndex(x => x.startsWith('export {'));
if (idxMark < 0 || idxExport < 0) throw new Error('尾部定位失败');
// 607 行（applyFilesRules 链尾）, 改为 };
const idxApplyEnd = lines.findIndex((x, i) => i > idxMark - 10 && i < idxMark && /^    \},$/.test(x));
if (idxApplyEnd < 0) throw new Error('applyFilesRules 结尾未找到');
lines[idxApplyEnd] = '    };';

// 提取 markVerified 与 optimizeNodeModules 原始内容
const markBlock = lines.slice(idxMark, idxMark + 8); // 609-616: markVerified ... },
const optStart = lines.findIndex((x, i) => i > idxMark && x.includes('optimizeNodeModules = async'));
const optBlock = lines.slice(optStart, idxExport - 1); // 到 export 前一行（空行）

// 组装独立声明
const newTail = [
    '};',
    '',
    '/** 标记快照 verified=true（构建全流程成功后由 build.js 调用） */',
    'const markVerified = async tempDir => {',
    '    const p = path.join(tempDir, SNAPSHOT_FILE);',
    '    if (!await fs.pathExists(p)) return;',
    '    try {',
    '        const old = await fs.readJson(p);',
    '        old.verified = true, await fs.writeJson(p, old, { spaces: 2 });',
    '    } catch { }',
    '};',
    '',
    '/**',
    ' * 执行 node_modules 六阶段优化',
    ' * @param {string} tempDir 临时构建目录',
    ' * @param {object} [config] 优化配置',
    ' * @param {string[]} [config.exclude] 排除的包名列表',
    ' * @returns {Promise<object>} 各阶段统计（merged / cleared / platform / devFiles / intermediates / filesRules）',
    ' */',
    'const optimizeNodeModules = async (tempDir, config = {}) => {'
];
// 将 optimizeNodeModules 函数体（从原 `optimizeNodeModules = async (tempDir, config = {}) => {` 之后的全部）
const optBodyStart = optStart + 1;
const optBody = lines.slice(optBodyStart, idxExport - 1); // 函数体到末尾
// optimizeNodeModules 结尾是 `};` （原 670 行）
// 直接拼接
lines.splice(idxApplyEnd, idxExport - idxApplyEnd, ...newTail.slice(0, -1), ...optBody, '};', '', 'export { markVerified, optimizeNodeModules, clearVerified, SELF_HASH };');

fs.writeFileSync(f, lines.join(eol));
console.log('step1 done');