import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import chalk from 'chalk';

const require = createRequire(import.meta.url), BUILDER_VERSION = '5.2.0',
    SNAPSHOT_FILE = '.deps-snapshot.json', SKIP_PKGS = new Set(['esbuild', '@esbuild', 'node-gyp-build',
        'node-gyp-build-optional-packages', 'node-addon-api', 'node']),
    EXCLUDE_NAMES = new Set(['package.json', 'package-lock.json', 'node_modules', '.git', '.gitignore', '.npmignore']),
    // ==================== 通用工具 ====================
    pickCond = (v, prefer) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') {
            for (const k of prefer) {
                const r = pickCond(v[k], prefer);
                if (r) return r;
            }
        }
        return null;
    },
    // ==================== 快照 ====================
    checkSnapshot = async (tempDir, depsData) => {
        const p = path.join(tempDir, SNAPSHOT_FILE);
        if (!await fs.pathExists(p)) return false;
        try {
            const old = await fs.readJson(p);
            if (!old.platform || !old.arch || !old.builderVersion) return false;
            if (old.platform !== process.platform) return false;
            if (old.arch !== process.arch) return false;
            if (old.builderVersion !== BUILDER_VERSION) return false;
            return JSON.stringify(old.deps) === JSON.stringify(depsData);
        } catch { return false; }
    },
    writeSnapshotFlags = async tempDir => {
        const p = path.join(tempDir, SNAPSHOT_FILE);
        const old = await fs.readJson(p);
        old.platform = process.platform;
        old.arch = process.arch;
        old.builderVersion = BUILDER_VERSION;
        old.verified = false;
        await fs.writeJson(p, old, { spaces: 2 });
    },
    clearVerified = async tempDir => {
        const p = path.join(tempDir, SNAPSHOT_FILE);
        if (!await fs.pathExists(p)) return;
        try {
            const old = await fs.readJson(p);
            if (old.verified !== false) {
                old.verified = false;
                await fs.writeJson(p, old, { spaces: 2 });
            }
        } catch { }
    },
    // ==================== 扫描工具 ====================
    findPackages = dir => {
        const result = [];
        if (!fs.existsSync(dir)) return result;
        for (const entry of fs.readdirSync(dir)) {
            if (entry === '.bin' || entry.startsWith('.')) continue;
            const full = path.join(dir, entry);
            if (!fs.statSync(full).isDirectory()) continue;
            if (entry === 'node_modules') { result.push(...findPackages(full)); continue; }
            if (entry.startsWith('@')) {
                for (const sub of fs.readdirSync(full)) {
                    const pkgDir = path.join(full, sub);
                    if (fs.statSync(pkgDir).isDirectory()) {
                        result.push(pkgDir);
                        const nested = path.join(pkgDir, 'node_modules');
                        if (fs.existsSync(nested)) result.push(...findPackages(nested));
                    }
                }
            } else {
                result.push(full);
                const nested = path.join(full, 'node_modules');
                if (fs.existsSync(nested)) result.push(...findPackages(nested));
            }
        }
        return result;
    },
    hasNativeModule = dir => {
        let found = false;
        const walk = d => {
            if (found) return;
            for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                if (f.isDirectory()) walk(path.join(d, f.name));
                else if (f.name.endsWith('.node')) { found = true; return; }
            }
        };
        try { walk(dir); } catch { }
        return found;
    },
    countJS = dir => {
        let n = 0;
        const walk = d => {
            for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                if (f.isDirectory()) walk(path.join(d, f.name));
                else if (/\.(js|mjs|cjs)$/.test(f.name)) n++;
            }
        };
        walk(dir);
        return n;
    },
    findPkgJsons = dir => {
        const out = [];
        const walk = d => {
            for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, f.name);
                if (f.isDirectory()) {
                    if (f.name === '.bin' || f.name === 'node_modules') continue;
                    walk(full);
                } else if (f.name === 'package.json') out.push(full);
            }
        };
        walk(dir);
        return out;
    },
    // ==================== 合并 ====================
    hasSubpathExports = j => {
        if (!j.exports || typeof j.exports !== 'object') return false;
        for (const k of Object.keys(j.exports)) {
            if (k === '.' || k === './package.json') continue;
            if (k.startsWith('./')) return true;
        }
        return false;
    },
    isComplexExports = j => {
        if (!j.exports) return false;
        const isESM = (j.type === 'module');
        const prefer = isESM ? ['import', 'module', 'node', 'default', 'require'] : ['require', 'node', 'default', 'import', 'module'];

        // 顶层条件对象（无 . 键）
        const keys = Object.keys(j.exports);
        const allConditional = keys.every(k => !k.startsWith('.'));
        if (allConditional) {
            // 只要能按 prefer 顺序解析出一个路径，就当作单入口
            const p = pickCond(j.exports, prefer);
            return !p;
        }

        const root = j.exports['.'];
        if (root === undefined) return true;
        if (typeof root === 'string') return false;
        if (Array.isArray(root)) return true;
        if (root && typeof root === 'object') {
            // 只按 prefer 顺序取第一个可解析路径，忽略 browser/types/react-native 等
            const p = pickCond(root, prefer);
            return !p;
        }
        return false;
    },
    keyToFilename = key => {
        if (key === '.') return 'index';
        return key.replace(/^\.\//, '').replace(/\//g, '__');
    },
    parseEntriesAll = (pkgDir, j) => {
        const isESM = (j.type === 'module');
        const prefer = isESM ? ['import', 'module', 'node', 'default', 'require'] : ['require', 'node', 'default', 'import', 'module'];
        const entries = [];
        const wildcards = [];

        const tryPath = rel => {
            const p = path.join(pkgDir, rel);
            if (fs.existsSync(p)) return p;
            for (const ext of ['.js', '.cjs', '.mjs', '/index.js', '/index.cjs', '/index.mjs']) {
                if (fs.existsSync(p + ext)) return p + ext;
            }
            return null;
        };

        if (j.exports && typeof j.exports === 'object') {
            const keys = Object.keys(j.exports);
            const allConditional = keys.every(k => !k.startsWith('.'));
            if (allConditional) {
                const picked = pickCond(j.exports, prefer);
                if (!picked) return { ok: false };
                const abs = tryPath(picked);
                if (!abs) return { ok: false };
                entries.push({ key: '.', entryFile: abs });
                return { ok: true, entries, wildcards };
            }
            for (const key of keys) {
                if (key === './package.json') continue;
                if (key.includes('*')) { wildcards.push(key); continue; }
                const val = j.exports[key];
                const picked = pickCond(Array.isArray(val) ? val[0] : val, prefer);
                if (!picked) continue;
                if (!/\.(js|mjs|cjs)$/.test(picked)) continue;
                const abs = path.join(pkgDir, picked);
                if (!fs.existsSync(abs)) continue;
                entries.push({ key, entryFile: abs });
            }
            if (entries.length === 0) return { ok: false };
            return { ok: true, entries, wildcards };
        }

        // 无 exports，用 main/module
        let entryFile = null;
        if (j.module) entryFile = tryPath(j.module);
        if (!entryFile && j.main) entryFile = tryPath(j.main);
        if (!entryFile) {
            for (const c of ['index.mjs', 'index.js', 'index.cjs']) {
                const p = path.join(pkgDir, c);
                if (fs.existsSync(p)) { entryFile = p; break; }
            }
        }
        if (!entryFile || !fs.existsSync(entryFile)) return { ok: false };
        entries.push({ key: '.', entryFile });
        return { ok: true, entries, wildcards };
    },
    resolveEntry = (pkgDir, j, projectType) => {
        const isESM = (j.type === 'module');
        const prefer = isESM ? ['import', 'module', 'node', 'default', 'require'] : ['require', 'node', 'default', 'import', 'module'];
        const tryPath = rel => {
            const p = path.join(pkgDir, rel);
            if (fs.existsSync(p)) return p;
            for (const ext of ['.js', '.cjs', '.mjs', '/index.js', '/index.cjs', '/index.mjs']) {
                if (fs.existsSync(p + ext)) return p + ext;
            }
            return null;
        };
        if (j.exports && j.exports['.'] !== undefined) {
            const root = j.exports['.'];
            if (typeof root === 'string') return tryPath(root);
            if (root && typeof root === 'object') {
                const p = pickCond(root, prefer);
                return p ? tryPath(p) : null;
            }
        }
        if (j.module) { const p = tryPath(j.module); if (p) return p; }
        if (j.main) { const p = tryPath(j.main); if (p) return p; }
        for (const c of ['index.mjs', 'index.js', 'index.cjs']) {
            const p = path.join(pkgDir, c);
            if (fs.existsSync(p)) return p;
        }
        return null;
    },
    getCjsNamedExports = cjsFile => {
        const os = require('os');
        const helper = path.join(os.tmpdir(), `probe-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`);
        try {
            fs.writeFileSync(helper,
                `try { const m = require(${JSON.stringify(cjsFile)}); ` +
                `const ks = Object.keys(m).filter(k => k !== 'default' && k !== 'module.exports' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)); ` +
                `process.stdout.write(JSON.stringify(ks)); } catch(e) { process.stdout.write('[]'); }`
            );
            const { execSync } = require('child_process');
            const out = execSync(`node ${JSON.stringify(helper)}`, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 });
            return JSON.parse(out.toString().trim() || '[]');
        } catch {
            return [];
        } finally {
            try { fs.unlinkSync(helper); } catch { }
        }
    },
    mergeAll = async (nmDir, excludePkgs) => {
        let esbuild;
        try { esbuild = require('esbuild'); }
        catch { throw new Error('esbuild 未找到，请确认 @flun/desktop-builder 依赖已安装'); }

        const packages = findPackages(nmDir);
        let merged = 0, skipped = 0, totalDeleted = 0;

        for (const pkgDir of packages) {
            const pj = path.join(pkgDir, 'package.json');
            if (!fs.existsSync(pj)) { skipped++; continue; }
            let j;
            try { j = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch { skipped++; continue; }
            const relName = path.relative(nmDir, pkgDir).replace(/\\/g, '/');
            if (excludePkgs.has(relName)) { skipped++; continue; }
            if (SKIP_PKGS.has(relName)) { skipped++; continue; }
            if (hasNativeModule(pkgDir)) { skipped++; continue; }
            if (countJS(pkgDir) <= 1) { skipped++; continue; }
            // 已优化过的包跳过
            const mainStr = String(j.main || '');
            const exportsStr = JSON.stringify(j.exports || '');
            if (mainStr.includes('__bundled__') || exportsStr.includes('__bundled__')) { skipped++; continue; }

            const parse = parseEntriesAll(pkgDir, j);
            if (!parse.ok) { skipped++; continue; }

            const isESM = (j.type === 'module');
            const banner = "import { createRequire as __ebCR } from 'module'; var require = __ebCR(import.meta.url);";
            const bundledDir = path.join(pkgDir, '__bundled__');
            fs.mkdirSync(bundledDir, { recursive: true });

            const newExports = {};
            const artifacts = new Set();
            let entryOk = true;

            for (const e of parse.entries) {
                const baseName = keyToFilename(e.key);
                const outName = baseName + (isESM ? '.mjs' : '.cjs');
                const outFile = path.join(bundledDir, outName);
                try {
                    await esbuild.build({
                        entryPoints: [e.entryFile],
                        bundle: true,
                        platform: 'node',
                        format: isESM ? 'esm' : 'cjs',
                        target: 'node22',
                        outfile: outFile,
                        packages: 'external',
                        banner: isESM ? { js: banner } : undefined,
                        logLevel: 'silent',
                    });
                    artifacts.add(outFile);
                } catch {
                    try { fs.unlinkSync(outFile); } catch { }
                    entryOk = false;
                    break;
                }
                if (isESM) {
                    newExports[e.key] = './__bundled__/' + outName;
                } else {
                    // CJS 包：若 bundle 末尾是 module.exports = require_xxx()（整体赋值），
                    // cjs-module-lexer 静态分析拿不到命名导出。此时定位主入口的 __commonJS 块，
                    // 块内抓 exports.X = 形式，追加显式声明让 lexer 识别。
                    try {
                        const code = fs.readFileSync(outFile, 'utf8');
                        const m = code.match(/module\.exports\s*=\s*require_(\w+)\s*\(\s*\)\s*;?\s*$/m);
                        if (m) {
                            const fnName = m[1];
                            const startPat = 'var require_' + fnName + ' = __commonJS({';
                            const start = code.indexOf(startPat);
                            if (start >= 0) {
                                let depth = 0, i = start + startPat.length - 1, end = -1;
                                while (i < code.length) {
                                    const ch = code[i];
                                    if (ch === '{') depth++;
                                    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
                                    i++;
                                }
                                if (end >= 0) {
                                    const block = code.substring(start, end + 1);
                                    const keys = new Set();
                                    const re = /\bexports\d*\.([a-zA-Z_$][\w$]*)\s*=/g;
                                    let mm;
                                    while ((mm = re.exec(block)) !== null) keys.add(mm[1]);
                                    if (keys.size > 0) {
                                        const decls = [...keys].map(k =>
                                            `try { module.exports[${JSON.stringify(k)}] = module.exports[${JSON.stringify(k)}]; } catch {}`);
                                        fs.appendFileSync(outFile, '\n' + decls.join('\n') + '\n');
                                    }
                                }
                            }
                        }
                    } catch { }
                    newExports[e.key] = { import: './__bundled__/' + outName, require: './__bundled__/' + outName, default: './__bundled__/' + outName };
                }
            }

            if (!entryOk) {
                fs.rmSync(bundledDir, { recursive: true, force: true });
                skipped++;
                continue;
            }

            // 保留通配符键和 package.json
            for (const w of parse.wildcards) {
                if (j.exports && j.exports[w]) newExports[w] = j.exports[w];
            }
            if (j.exports && j.exports['./package.json']) {
                newExports['./package.json'] = j.exports['./package.json'];
            }

            fs.writeFileSync(pj + '.orig', JSON.stringify(j));

            // scripts 引用保护
            const protectedByScripts = new Set();
            if (j.scripts) {
                for (const v of Object.values(j.scripts)) {
                    const re = /([\w./\\-]+\.(?:js|cjs|mjs))/g;
                    let m;
                    while ((m = re.exec(v)) !== null) protectedByScripts.add(path.normalize(m[1]).replace(/\\/g, '/'));
                }
            }

            // 通配符覆盖路径保护
            const wildcardPrefixes = parse.wildcards
                .map(w => w.replace(/^\.\//, '').replace(/\/\*.*$/, '/'))
                .filter(Boolean);

            j.exports = newExports;
            if (newExports['.']) {
                j.main = isESM ? newExports['.'] : (newExports['.'].require || newExports['.'].default || newExports['.']);
            } else {
                delete j.main;
            }
            if (isESM && j.main) j.module = j.main;
            fs.writeFileSync(pj, JSON.stringify(j, null, 2));

            // 删除原 JS
            let deleted = 0;
            const walkDel = d => {
                for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                    if (f.isDirectory()) {
                        if (f.name === 'node_modules' || f.name === '__bundled__') continue;
                        walkDel(path.join(d, f.name));
                    } else if (/\.(js|mjs|cjs)$/.test(f.name)) {
                        const full = path.join(d, f.name);
                        const rel = path.relative(pkgDir, full).replace(/\\/g, '/');
                        if (protectedByScripts.has(rel)) continue;
                        if (wildcardPrefixes.some(p => rel.startsWith(p))) continue;
                        fs.unlinkSync(full); deleted++;
                    }
                }
            };
            walkDel(pkgDir);
            totalDeleted += deleted;
            merged++;
            console.log(chalk.gray(`  ✓ ${relName} (${parse.entries.length} 入口)`));
        }

        return { merged, skipped, totalDeleted };
    },
    // ==================== 清空资源 ====================
    collectReferencedFiles = nmRoot => {
        const refs = new Set();
        const walk = d => {
            for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, f.name);
                if (f.isDirectory()) {
                    if (f.name === 'node_modules' && d !== nmRoot) continue;
                    walk(full);
                } else if (/\.(mjs|cjs|js)$/.test(f.name)) {
                    let code;
                    try { code = fs.readFileSync(full, 'utf8'); } catch { continue; }
                    const re = /(?:from|require|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;
                    let m;
                    while ((m = re.exec(code)) !== null) {
                        const abs = path.resolve(path.dirname(full), m[1]);
                        refs.add(abs);
                        if (!path.extname(abs)) {
                            for (const ext of ['.js', '.mjs', '.cjs', '/index.js', '/index.mjs']) {
                                if (fs.existsSync(abs + ext)) refs.add(abs + ext);
                            }
                        }
                    }
                }
            }
        };
        walk(nmRoot);
        return refs;
    },
    extractScript = cmd => {
        const m = cmd.match(/([\w./\\-]+\.(?:js|cjs|mjs))/);
        return m ? m[1] : null;
    },
    extractResources = (pkgDir, scriptCode) => {
        const strings = new Set();
        const re = /['"`]([A-Za-z0-9_.\-/\\]{2,100})['"`]/g;
        let m;
        while ((m = re.exec(scriptCode)) !== null) strings.add(m[1]);
        const items = [];
        for (const s of strings) {
            const first = s.split(/[\\/]/)[0];
            if (EXCLUDE_NAMES.has(first) || !first || first === '.' || first === '..') continue;
            if (fs.existsSync(path.join(pkgDir, first))) items.push(first);
        }
        return [...new Set(items)];
    },
    clearItem = (p, refs) => {
        const st = fs.statSync(p);
        if (st.isDirectory()) {
            for (const f of fs.readdirSync(p)) {
                const full = path.join(p, f);
                const sub = fs.statSync(full);
                if (sub.isDirectory()) clearItem(full, refs);
                else {
                    if (refs.has(full)) continue;
                    fs.rmSync(full, { force: true });
                }
            }
        } else {
            if (refs.has(p)) return;
            fs.writeFileSync(p, '');
        }
    },
    clearResources = async (nmDir, excludePkgs) => {
        const refs = collectReferencedFiles(nmDir);
        let cleared = 0;
        for (const pj of findPkgJsons(nmDir)) {
            let j;
            try { j = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch { continue; }
            if (!j.scripts) continue;
            const pkgDir = path.dirname(pj);
            const pkgRel = path.relative(nmDir, pkgDir).replace(/\\/g, '/');
            if (SKIP_PKGS.has(pkgRel) || excludePkgs.has(pkgRel)) continue;
            for (const k of ['postinstall', 'preinstall', 'install', 'prepare']) {
                const cmd = j.scripts[k];
                if (!cmd) continue;
                const scriptRel = extractScript(cmd);
                if (!scriptRel) continue;
                const scriptAbs = path.resolve(pkgDir, scriptRel);
                if (!fs.existsSync(scriptAbs)) continue;
                const code = fs.readFileSync(scriptAbs, 'utf8');
                const items = extractResources(pkgDir, code);
                for (const item of items) {
                    try { clearItem(path.join(pkgDir, item), refs); cleared++; } catch { }
                }
            }
        }
        return cleared;
    },
    // ==================== 清平台 ====================
    PLATFORM_MAP = { win32: ['win32', 'win64', 'windows'], darwin: ['darwin', 'macos', 'osx', 'mac'], linux: ['linux'], freebsd: ['freebsd'], openbsd: ['openbsd'], sunos: ['sunos', 'solaris'], aix: ['aix'] },
    ARCH_MAP = { x64: ['x64', 'x86_64', 'amd64'], arm64: ['arm64', 'aarch64'], arm: ['arm'], ia32: ['ia32', 'x86'], ppc64: ['ppc64', 'ppc64le'], s390x: ['s390x'], riscv64: ['riscv64'] },
    ALL_PLATFORMS = ['win32', 'win64', 'windows', 'darwin', 'macos', 'osx', 'linux', 'freebsd', 'openbsd', 'sunos', 'solaris', 'aix'],
    ALL_ARCHS = ['x64', 'x86_64', 'amd64', 'arm64', 'aarch64', 'arm', 'ia32', 'x86', 'ppc64', 'ppc64le', 's390x', 'riscv64'],
    myPlat = PLATFORM_MAP[process.platform] || [process.platform], myArch = ARCH_MAP[process.arch] || [process.arch],
    isOtherPlatformName = name => {
        const lower = name.toLowerCase();
        const plats = ALL_PLATFORMS.filter(p => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(lower));
        const archs = ALL_ARCHS.filter(a => new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(lower));
        if (plats.length === 0 && archs.length === 0) return false;
        const hasOtherPlat = plats.some(p => !myPlat.includes(p));
        const hasOtherArch = archs.some(a => !myArch.includes(a));
        return hasOtherPlat || hasOtherArch;
    },
    isPureBinaryPackage = dir => {
        let hasJS = false, hasBinary = false;
        const walk = d => {
            for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                if (f.isDirectory()) walk(path.join(d, f.name));
                else {
                    if (/\.(js|mjs|cjs|ts)$/.test(f.name)) hasJS = true;
                    else if (/\.(node|exe|dll|so|dylib|bin)$/i.test(f.name) || !path.extname(f.name)) hasBinary = true;
                }
            }
        };
        try { walk(dir); } catch { }
        return hasBinary && !hasJS;
    },
    prunePlatform = async nmDir => {
        let removed = 0;
        const del = t => {
            try { fs.rmSync(t, { recursive: true, force: true }); removed++; } catch { }
        };
        const scanPrebuild = (dir, rel) => {
            for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                if (!f.isDirectory()) continue;
                if (isOtherPlatformName(f.name)) del(path.join(dir, f.name));
            }
        };
        const scanAll = (dir, relBase) => {
            for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                if (!f.isDirectory()) continue;
                const full = path.join(dir, f.name);
                const rel = relBase ? relBase + '/' + f.name : f.name;
                if (f.name === 'prebuilds' || f.name === 'prebuilt') scanPrebuild(full, rel);
                scanAll(full, rel);
            }
        };
        scanAll(nmDir, '');
        // @scope/平台包
        const scanScoped = (dir, relBase) => {
            for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                if (!f.isDirectory()) continue;
                const full = path.join(dir, f.name);
                const rel = relBase ? relBase + '/' + f.name : f.name;
                if (f.name.startsWith('@')) {
                    for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
                        if (!sub.isDirectory()) continue;
                        const subFull = path.join(full, sub.name);
                        if (isOtherPlatformName(sub.name) && isPureBinaryPackage(subFull)) del(subFull);
                    }
                } else if (f.name === 'node_modules') {
                    scanScoped(full, rel);
                } else {
                    const nested = path.join(full, 'node_modules');
                    if (fs.existsSync(nested)) scanScoped(nested, rel + '/node_modules');
                }
            }
        };
        scanScoped(nmDir, '');
        return removed;
    },
    // ==================== 清开发文件 ====================
    pruneDevFiles = async nmDir => {
        const PATTERNS = [
            /(^|\/)tsconfig\.json$/,
            /(^|\/)\.nycrc(\.(json|yml))?$/,
            /(^|\/)\.editorconfig$/, /(^|\/)\.prettierignore$/, /(^|\/)\.eslintignore$/,
            /(^|\/)\.dockerignore$/, /(^|\/)\.gitignore$/, /(^|\/)\.gitattributes$/, /(^|\/)\.npmignore$/,
            /\.(md|markdown)$/i, /\.(gyp|gypi)$/i, /\.(yml|yaml)$/i, /\.(h|c)$/,
            /\.d\.ts$/, /\.map$/, /metafile-.*\.json$/,
            /(^|\/)\.eslintrc(\.(json|yml|js|cjs))?$/, /(^|\/)\.babelrc(\.(json|js))?$/,
            /(^|\/)package-lock\.json$/, /(^|\/)\.package-lock\.json$/, /(^|\/)yarn\.lock$/,
        ];
        const DIR_SKIP = new Set(['__bundled__', 'node_modules']);
        let deleted = 0;
        const walk = d => {
            for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, f.name);
                if (f.isDirectory()) {
                    if (DIR_SKIP.has(f.name)) continue;
                    if (f.name === '.github' || f.name === '.circleci') {
                        fs.rmSync(full, { recursive: true, force: true });
                        deleted++;
                        continue;
                    }
                    walk(full);
                } else {
                    const rel = path.relative(nmDir, full).replace(/\\/g, '/');
                    if (PATTERNS.some(re => re.test(rel))) {
                        try { fs.unlinkSync(full); deleted++; } catch { }
                    }
                }
            }
        };
        walk(nmDir);
        return deleted;
    },
    pruneIntermediates = async nmDir => {
        let deleted = 0;
        const walk = d => {
            for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, f.name);
                if (f.isDirectory()) walk(full);
                else if (f.name.endsWith('.orig')) {
                    try { fs.unlinkSync(full); deleted++; } catch { }
                }
            }
        };
        walk(nmDir);
        return deleted;
    },
    applyFilesRules = async nmDir => {
        let deleted = 0;
        const LICENSE_RE = /^licen[sc]e(s)?(\..*)?$/i;
        const TS_RE = /\.(ts|cts|mts)$/;

        // 1) 删顶层 node 假包（npm 上名为 node 的包，仅提供 node.exe，运行时不需要）
        const nodePkg = path.join(nmDir, 'node');
        if (fs.existsSync(nodePkg)) {
            try { fs.rmSync(nodePkg, { recursive: true, force: true }); deleted++; } catch { }
        }

        // 2) 递归删 node-<platform>* 假包
        const walkForFakeNode = d => {
            let entries;
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
            for (const f of entries) {
                if (!f.isDirectory()) continue;
                const full = path.join(d, f.name);
                if (/^node-(win|darwin|linux|freebsd|sunos|aix)/.test(f.name)) {
                    try { fs.rmSync(full, { recursive: true, force: true }); deleted++; } catch { }
                    continue;
                }
                walkForFakeNode(full);
            }
        };
        walkForFakeNode(nmDir);

        // 3) 删 license/licence 文件或目录 + .ts/.cts/.mts 文件
        const walk = d => {
            let entries;
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
            for (const f of entries) {
                const full = path.join(d, f.name);
                if (f.isDirectory()) {
                    if (f.name === '__bundled__') continue;
                    if (LICENSE_RE.test(f.name)) {
                        try { fs.rmSync(full, { recursive: true, force: true }); deleted++; } catch { }
                        continue;
                    }
                    walk(full);
                } else {
                    if (LICENSE_RE.test(f.name) || TS_RE.test(f.name)) {
                        try { fs.unlinkSync(full); deleted++; } catch { }
                    }
                }
            }
        };
        walk(nmDir);

        return deleted;
    },
    // ==================== 导出函数 ====================
    markVerified = async tempDir => {
        const p = path.join(tempDir, SNAPSHOT_FILE);
        if (!await fs.pathExists(p)) return;
        try {
            const old = await fs.readJson(p);
            old.verified = true;
            await fs.writeJson(p, old, { spaces: 2 });
        } catch { }
    },
    optimizeNodeModules = async (tempDir, config = {}) => {
        const excludePkgs = new Set(config.exclude || []);
        const nmDir = path.join(tempDir, 'node_modules');
        const snapPath = path.join(tempDir, SNAPSHOT_FILE);

        if (!await fs.pathExists(nmDir)) {
            console.log(chalk.gray('[优化] node_modules 不存在，跳过'));
            return { skipped: true };
        }
        if (!await fs.pathExists(snapPath)) {
            console.log(chalk.gray('[优化] 未找到依赖快照，跳过优化'));
            return { skipped: true };
        }
        const snap = await fs.readJson(snapPath);
        if (snap.verified === true
            && snap.platform === process.platform
            && snap.arch === process.arch
            && snap.builderVersion === BUILDER_VERSION) {
            console.log(chalk.gray('[优化] 快照已验证，跳过优化'));
            // 关键：跳过优化也要先把 verified 清 false，构建成功后再由 build.js 写回 true
            // 若构建中途失败，下次会重跑优化
            await clearVerified(tempDir);
            return { skipped: true, cached: true };
        }
        // 未验证 → 需要执行优化。若旧快照带有标志位，先清掉 verified
        await clearVerified(tempDir);

        const beforeFiles = (await fs.readdir(nmDir)).length, t0 = Date.now();
        try {
            // 阶段1: 合并
            console.log(chalk.blue('[优化 1/6] 合并 JS...'));
            const m = await mergeAll(nmDir, excludePkgs);
            console.log(chalk.gray(`  合并 ${m.merged} 包，跳过 ${m.skipped}，删 ${m.totalDeleted} 个 JS`));

            // 阶段2: 清空资源
            console.log(chalk.blue('[优化 2/6] 清空复制到项目根的资源...'));
            const c = await clearResources(nmDir, excludePkgs);
            console.log(chalk.gray(`  清空 ${c} 项`));

            // 阶段3: 清平台二进制
            console.log(chalk.blue('[优化 3/6] 清理非当前平台二进制...'));
            const p = await prunePlatform(nmDir);
            console.log(chalk.gray(`  清理 ${p} 项`));

            // 阶段4: 清开发文件
            console.log(chalk.blue('[优化 4/6] 清理开发文件...'));
            const d = await pruneDevFiles(nmDir);
            console.log(chalk.gray(`  清理 ${d} 个文件`));

            // 阶段5: 清中间产物
            console.log(chalk.blue('[优化 5/6] 清理中间产物...'));
            const i = await pruneIntermediates(nmDir);
            console.log(chalk.gray(`  清理 ${i} 个文件`));

            // 阶段6: 清除不参与运行的文件（与 build.js 的 files 数组对齐）
            console.log(chalk.blue('[优化 6/6] 清除不参与运行的文件...'));
            const fr = await applyFilesRules(nmDir);
            console.log(chalk.gray(`  清理 ${fr} 项`));

            await writeSnapshotFlags(tempDir);   // 写 platform/arch/version，同时 verified=false

            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            console.log(chalk.green(`[优化] 完成，耗时 ${elapsed}s`));

            return { merged: m.merged, cleared: c, platform: p, devFiles: d, intermediates: i, filesRules: fr };
        } catch (err) {
            // 失败时删除依赖快照，下次强制重装 + 重优化
            try { await fs.remove(snapPath); } catch { }
            throw err;
        }
    };

export { markVerified, optimizeNodeModules };
