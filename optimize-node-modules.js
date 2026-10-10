import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';
import chalk from 'chalk';

const require = createRequire(import.meta.url),
    SELF_HASH = (() => {
        try {
            const src = fs.readFileSync(new URL(import.meta.url), 'utf8');
            return require('crypto').createHash('sha256').update(src).digest('hex').slice(0, 16);
        } catch { return 'unknown'; }
    })(),
    subpath = (...parts) => './' + path.posix.join(...parts),
    BUNDLED_DIR = '__bundled__', NM_DIR = 'node_modules', PKG_JSON = 'package.json', CUR_PLAT = process.platform,
    CUR_ARCH = process.arch, ENTRY_EXTS = ['.js', '.cjs', '.mjs', '/index.js', '/index.cjs', '/index.mjs'],
    JS_RE = /\.(js|mjs|cjs)$/, DOT_SLASH_RE = /^\.\//, POSIX_RE = /\\/g, PKG_SUBPATH = subpath(PKG_JSON),
    SCRIPT_FILE_RE = /([\w./\\-]+\.(?:js|cjs|mjs))/, SCRIPT_FILE_RE_G = new RegExp(SCRIPT_FILE_RE.source, 'g'),
    SNAPSHOT_FILE = '.deps-snapshot.json', SKIP_PKGS = new Set(['esbuild', '@esbuild', 'node-gyp-build',
        'node-gyp-build-optional-packages', 'node-addon-api', 'node']),
    EXCLUDE_NAMES = new Set([PKG_JSON, 'package-lock.json', NM_DIR, '.git', '.gitignore', '.npmignore']),
    PLATFORM_MAP = {
        win32: ['win32', 'win64', 'windows'], darwin: ['darwin', 'macos', 'osx', 'mac'],
        linux: ['linux'], freebsd: ['freebsd'], openbsd: ['openbsd'], sunos: ['sunos', 'solaris'], aix: ['aix']
    }, myPlat = PLATFORM_MAP[CUR_PLAT] || [CUR_PLAT],
    ARCH_MAP = { x64: ['x64', 'x86_64', 'amd64'], arm64: ['arm64', 'aarch64'], ia32: ['ia32', 'x86', 'i386'], arm: ['arm'] },
    myArch = ARCH_MAP[CUR_ARCH] || [CUR_ARCH], INDEX_FILES = ['index.js', 'index.cjs', 'index.mjs'],
    // ==================== 通用工具 ====================
    toPosix = p => p.replace(POSIX_RE, '/'),
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
    writeSnapshotFlags = async tempDir => {
        const p = path.join(tempDir, SNAPSHOT_FILE);
        if (!await fs.pathExists(p)) return;
        const old = await fs.readJson(p);
        old.platform = CUR_PLAT, old.arch = CUR_ARCH, old.optimizeHash = SELF_HASH, old.verified = false, old.optimized = true;
        await fs.writeJson(p, old, { spaces: 2 });
    },
    clearVerified = async tempDir => {
        const p = path.join(tempDir, SNAPSHOT_FILE);
        if (!await fs.pathExists(p)) return;
        try {
            const old = await fs.readJson(p);
            if (old.verified !== false) old.verified = false, await fs.writeJson(p, old, { spaces: 2 });
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
            if (entry === NM_DIR) { result.push(...findPackages(full)); continue; }
            if (entry.startsWith('@')) {
                for (const sub of fs.readdirSync(full)) {
                    const pkgDir = path.join(full, sub);
                    if (fs.statSync(pkgDir).isDirectory()) {
                        result.push(pkgDir);
                        const nested = path.join(pkgDir, NM_DIR);
                        if (fs.existsSync(nested)) result.push(...findPackages(nested));
                    }
                }
            } else {
                result.push(full);
                const nested = path.join(full, NM_DIR);
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
                else if (JS_RE.test(f.name)) n++;
            }
        };
        walk(dir);
        return n;
    },
    findPkgJsons = dir => {
        const out = [],
            walk = d => {
                for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                    const full = path.join(d, f.name);
                    if (f.isDirectory()) {
                        if (f.name === '.bin' || f.name === NM_DIR) continue;
                        walk(full);
                    } else if (f.name === PKG_JSON) out.push(full);
                }
            };
        walk(dir);
        return out;
    },
    // ==================== 合并 ====================
    keyToFilename = key => {
        if (key === '.') return 'index';
        return key.replace(DOT_SLASH_RE, '').replace(/\//g, '__');
    },
    parseEntriesAll = (pkgDir, j) => {
        const isESM = (j.type === 'module'), prefer = isESM ? ['import', 'module', 'node', 'default', 'require']
            : ['require', 'node', 'default', 'import', 'module'], entries = [], wildcards = [],
            tryPath = rel => {
                const p = path.join(pkgDir, rel);
                if (fs.existsSync(p)) return p;
                const exts = ENTRY_EXTS;
                for (const ext of exts) if (fs.existsSync(p + ext)) return p + ext;
                return null;
            };

        if (j.exports && typeof j.exports === 'object') {
            const keys = Object.keys(j.exports), allConditional = keys.every(k => !k.startsWith('.'));
            if (allConditional) {
                const picked = pickCond(j.exports, prefer);
                if (!picked) return { ok: false };
                const abs = tryPath(picked);
                if (!abs) return { ok: false };
                entries.push({ key: '.', entryFile: abs });
                return { ok: true, entries, wildcards };
            }
            for (const key of keys) {
                if (key === PKG_SUBPATH) continue;
                if (key.includes('*')) { wildcards.push(key); continue; }
                const val = j.exports[key], picked = pickCond(Array.isArray(val) ? val[0] : val, prefer);
                if (!picked) continue;
                if (!JS_RE.test(picked)) continue;
                const abs = path.join(pkgDir, picked);
                if (!fs.existsSync(abs)) continue;
                entries.push({ key, entryFile: abs });
            }
            if (entries.length === 0) return { ok: false };
            return { ok: true, entries, wildcards };
        }

        // 无 exports,用 main/module
        let entryFile = null;
        if (j.module) entryFile = tryPath(j.module);
        if (!entryFile && j.main) entryFile = tryPath(j.main);
        if (!entryFile) {
            for (const c of INDEX_FILES) {
                const p = path.join(pkgDir, c);
                if (fs.existsSync(p)) { entryFile = p; break; }
            }
        }
        if (!entryFile || !fs.existsSync(entryFile)) return { ok: false };
        entries.push({ key: '.', entryFile });
        return { ok: true, entries, wildcards };
    },
    mergeAll = async (nmDir, excludePkgs) => {
        let esbuild;
        try { esbuild = require('esbuild'); }
        catch { throw new Error('esbuild 未找到,请确认 @flun/desktop-builder 依赖已安装'); }

        const packages = findPackages(nmDir);
        let merged = 0, skipped = 0, totalDeleted = 0;
        // 调试模式:预扫各包的 postinstall 资源目录,用于统计被阶段1 删除的资源 JS
        let resMap = null, resLog = null;
        if (process.env.OPTIMIZE_DEBUG) {
            resMap = new Map(), resLog = [];
            for (const pkgDir of packages) {
                const pj = path.join(pkgDir, PKG_JSON);
                if (!fs.existsSync(pj)) continue;
                let j;
                try { j = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch { continue; }
                if (!j.scripts) continue;
                const items = new Set();
                for (const k of ['postinstall', 'preinstall', 'install', 'prepare']) {
                    const cmd = j.scripts[k];
                    if (!cmd) continue;
                    const sr = extractScript(cmd);
                    if (!sr) continue;
                    const sa = path.resolve(pkgDir, sr);
                    if (!fs.existsSync(sa)) continue;
                    for (const item of extractResources(pkgDir, fs.readFileSync(sa, 'utf8'))) items.add(item);
                }
                if (items.size > 0) resMap.set(pkgDir, items);
            }
        }

        for (const pkgDir of packages) {
            const pj = path.join(pkgDir, PKG_JSON);
            if (!fs.existsSync(pj)) { skipped++; continue; }
            let j;
            try { j = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch { skipped++; continue; }
            const relName = toPosix(path.relative(nmDir, pkgDir));
            if (excludePkgs.has(relName)) { skipped++; continue; }
            if (SKIP_PKGS.has(relName)) { skipped++; continue; }
            if (hasNativeModule(pkgDir)) { skipped++; continue; }
            if (countJS(pkgDir) <= 1) { skipped++; continue; }
            // 已优化过的包跳过
            const mainStr = String(j.main || ''), exportsStr = JSON.stringify(j.exports || '');
            if (mainStr.includes(BUNDLED_DIR) || exportsStr.includes(BUNDLED_DIR)) { skipped++; continue; }

            const parse = parseEntriesAll(pkgDir, j);
            if (!parse.ok) { skipped++; continue; }

            const isESM = (j.type === 'module'), bundledDir = path.join(pkgDir, BUNDLED_DIR), newExports = {},
                banner = "import { createRequire as __ebCR } from 'module'; var require = __ebCR(import.meta.url);",
                artifacts = new Set();

            fs.mkdirSync(bundledDir, { recursive: true });
            let entryOk = true;
            for (const e of parse.entries) {
                const baseName = keyToFilename(e.key), outName = baseName + (isESM ? '.mjs' : '.cjs'),
                    outFile = path.join(bundledDir, outName);
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
                        logLevel: 'silent'
                    });
                    artifacts.add(outFile);
                } catch {
                    try { fs.unlinkSync(outFile) } catch { }
                    entryOk = false;
                    break;
                }
                if (isESM) newExports[e.key] = subpath(BUNDLED_DIR, outName);
                else {
                    // CJS 包：若 bundle 末尾是 module.exports = require_xxx()（整体赋值）,
                    // cjs-module-lexer 静态分析拿不到命名导出,此时定位主入口的 __commonJS 块,
                    // 块内抓 exports.X = 形式,追加显式声明让 lexer 识别;
                    try {
                        const code = fs.readFileSync(outFile, 'utf8'),
                            m = code.match(/module\.exports\s*=\s*require_(\w+)\s*\(\s*\)\s*;?\s*$/m);
                        if (m) {
                            const fnName = m[1], startPat = 'var require_' + fnName + ' = __commonJS({',
                                start = code.indexOf(startPat);
                            if (start >= 0) {
                                let depth = 0, i = start + startPat.length - 1, end = -1;
                                while (i < code.length) {
                                    const ch = code[i];
                                    if (ch === '{') depth++;
                                    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
                                    i++;
                                }
                                if (end >= 0) {
                                    const block = code.substring(start, end + 1), keys = new Set(),
                                        re = /\bexports\d*\.([a-zA-Z_$][\w$]*)\s*=/g;
                                    let mm;
                                    while ((mm = re.exec(block)) !== null) keys.add(mm[1]);
                                    if (keys.size > 0) {
                                        const decls = [...keys].map(k => `try { module.exports[${JSON.stringify(k)}] =
                                            module.exports[${JSON.stringify(k)}]; } catch {}`);
                                        fs.appendFileSync(outFile, '\n' + decls.join('\n') + '\n');
                                    }
                                }
                            }
                        }
                    } catch { }
                    newExports[e.key] = {
                        import: subpath(BUNDLED_DIR, outName), require: subpath(BUNDLED_DIR, outName),
                        default: subpath(BUNDLED_DIR, outName)
                    };
                }
            }

            if (!entryOk) {
                fs.rmSync(bundledDir, { recursive: true, force: true }), skipped++;
                continue;
            }

            // 保留通配符键和 package.json
            for (const w of parse.wildcards) if (j.exports && j.exports[w]) newExports[w] = j.exports[w];
            if (j.exports && j.exports[PKG_SUBPATH]) newExports[PKG_SUBPATH] = j.exports[PKG_SUBPATH];

            fs.writeFileSync(pj + '.orig', JSON.stringify(j));
            // scripts 引用保护
            const protectedByScripts = new Set();
            if (j.scripts) {
                for (const v of Object.values(j.scripts)) {
                    const re = SCRIPT_FILE_RE_G;
                    let m;
                    while ((m = re.exec(v)) !== null) protectedByScripts.add(toPosix(path.normalize(m[1])));
                }
            }

            // 通配符覆盖路径保护
            const wildcardPrefixes = parse.wildcards.map(w => w.replace(DOT_SLASH_RE, '').replace(/\/\*.*$/, '/'))
                .filter(Boolean);

            j.exports = newExports;
            if (newExports['.'])
                j.main = isESM ? newExports['.'] : (newExports['.'].require || newExports['.'].default || newExports['.']);
            else delete j.main;
            if (isESM && j.main) j.module = j.main;
            fs.writeFileSync(pj, JSON.stringify(j, null, 2));

            // 删除原 JS
            let deleted = 0;
            const resItems = resMap ? (resMap.get(pkgDir) || null) : null,
                resJsHits = resItems ? new Map() : null;
            const walkDel = d => {
                for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                    if (f.isDirectory()) {
                        if (f.name === NM_DIR || f.name === BUNDLED_DIR) continue;
                        walkDel(path.join(d, f.name));
                    } else if (JS_RE.test(f.name)) {
                        const full = path.join(d, f.name), rel = toPosix(path.relative(pkgDir, full));
                        if (protectedByScripts.has(rel)) continue;
                        if (wildcardPrefixes.some(p => rel.startsWith(p))) continue;
                        if (resItems) {
                            const top = rel.split('/')[0];
                            if (resItems.has(top)) resJsHits.set(top, (resJsHits.get(top) || 0) + 1);
                        }
                        fs.unlinkSync(full); deleted++;
                    }
                }
            };
            walkDel(pkgDir), totalDeleted += deleted, merged++;
            if (resJsHits && resJsHits.size > 0 && resLog)
                for (const [k, v] of resJsHits) resLog.push(`      ${relName}: ${k} (${v} 个 JS)`);
            if (process.env.OPTIMIZE_DEBUG) console.log(chalk.gray(`  ✓ ${relName} (${parse.entries.length} 入口)`));
        }

        if (resLog && resLog.length > 0) {
            console.log(chalk.gray('  处理 JS 资源(用到则合并,未用到则提前清除):'));
            for (const line of resLog) console.log(chalk.gray(line));
        }
        return { merged, skipped, totalDeleted };
    },
    // ==================== 清空资源 ====================
    collectReferencedFiles = nmRoot => {
        const refs = new Set(),
            walk = d => {
                for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                    const full = path.join(d, f.name);
                    if (f.isDirectory()) {
                        if (f.name === NM_DIR && d !== nmRoot) continue;
                        walk(full);
                    } else if (JS_RE.test(f.name)) {
                        let code;
                        try { code = fs.readFileSync(full, 'utf8'); } catch { continue; }
                        const re = /(?:from|require|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;
                        let m;
                        while ((m = re.exec(code)) !== null) {
                            const abs = path.resolve(path.dirname(full), m[1]);
                            refs.add(abs);
                            if (!path.extname(abs)) {
                                for (const ext of ENTRY_EXTS) if (fs.existsSync(abs + ext)) refs.add(abs + ext);
                            }
                        }
                    }
                }
            };
        walk(nmRoot);
        return refs;
    },
    extractScript = cmd => {
        const m = cmd.match(SCRIPT_FILE_RE);
        return m ? m[1] : null;
    },
    extractResources = (pkgDir, scriptCode) => {
        const strings = new Set(), re = /['"`]([A-Za-z0-9_.\-/\\]{2,100})['"`]/g;
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
                const full = path.join(p, f), sub = fs.statSync(full);
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
            const pkgDir = path.dirname(pj), pkgRel = toPosix(path.relative(nmDir, pkgDir));
            if (SKIP_PKGS.has(pkgRel) || excludePkgs.has(pkgRel)) continue;
            const pkgItems = [];
            for (const k of ['postinstall', 'preinstall', 'install', 'prepare']) {
                const cmd = j.scripts[k];
                if (!cmd) continue;
                const scriptRel = extractScript(cmd);
                if (!scriptRel) continue;
                const scriptAbs = path.resolve(pkgDir, scriptRel);
                if (!fs.existsSync(scriptAbs)) continue;
                const code = fs.readFileSync(scriptAbs, 'utf8'), items = extractResources(pkgDir, code);
                for (const item of items)
                    try { clearItem(path.join(pkgDir, item), refs), cleared++, pkgItems.push(item); } catch { }
            }
            if (process.env.OPTIMIZE_DEBUG && pkgItems.length > 0) console.log(chalk.gray(`  ✓ ${pkgRel}: ${pkgItems.join(', ')}`));
        }
        return cleared;
    },
    // ==================== 清平台 ====================
    prunePlatform = async nmDir => {
        let removed = 0;
        const readHead = file => {
            try {
                const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(512);
                const n = fs.readSync(fd, buf, 0, 512, 0);
                fs.closeSync(fd);
                return n > 0 ? buf.slice(0, n) : null;
            } catch { return null; }
        },
            sniffPlat = buf => {
                if (!buf || buf.length < 4) return null;
                const hex = buf.toString('hex', 0, 4).toUpperCase();
                if (hex.startsWith('4D5A')) return 'win32';
                if (hex === '7F454C46') return 'linux';
                if (['CFFAEDFE', 'CEFAEDFE', 'FEEDFACE', 'FEEDFACF'].includes(hex)) return 'darwin';
                return null;
            },
            sniffArch = buf => {
                if (!buf || buf.length < 64) return null;
                const hex = buf.toString('hex', 0, 4).toUpperCase();
                try {
                    if (hex.startsWith('4D5A')) {
                        const off = buf.readUInt32LE(0x3C);
                        if (off + 6 > buf.length) return null;
                        const m = buf.readUInt16LE(off + 4);
                        return m === 0x8664 ? 'x64' : m === 0xAA64 ? 'arm64' : m === 0x14C ? 'ia32' : (m === 0x1C0 || m === 0x1C4) ? 'arm' : null;
                    }
                    if (hex === '7F454C46') {
                        const m = buf.readUInt16LE(0x12);
                        return m === 0x3E ? 'x64' : m === 0xB7 ? 'arm64' : m === 0x28 ? 'arm' : m === 0x03 ? 'ia32' : null;
                    }
                    if (hex === 'CFFAEDFE' || hex === 'CEFAEDFE') {
                        const c = buf.readUInt32LE(4);
                        return c === 0x01000007 ? 'x64' : c === 0x0100000C ? 'arm64' : c === 0x7 ? 'ia32' : c === 0xC ? 'arm' : null;
                    }
                    if (hex === 'FEEDFACF' || hex === 'FEEDFACE') {
                        const c = buf.readUInt32BE(4);
                        return c === 0x01000007 ? 'x64' : c === 0x0100000C ? 'arm64' : c === 0x7 ? 'ia32' : c === 0xC ? 'arm' : null;
                    }
                } catch { }
                return null;
            },
            suffixPlat = name => {
                const ext = path.extname(name).toLowerCase();
                if (ext === '.exe' || ext === '.dll') return 'win32';
                if (ext === '.dylib') return 'darwin';
                if (ext === '.so') return 'linux';
                return null;
            },
            delFile = p => {
                try { fs.unlinkSync(p), removed++; } catch { }
            },
            processDir = d => {
                let entries;
                try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
                for (const e of entries) {
                    const full = path.join(d, e.name);
                    if (e.isDirectory()) { processDir(full); continue; }
                    if (JS_RE.test(e.name)) continue;
                    let plat = suffixPlat(e.name), arch = null;
                    const head = readHead(full);
                    if (head) {
                        if (!plat) plat = sniffPlat(head);
                        arch = sniffArch(head);
                    }
                    const platBad = plat && !myPlat.includes(plat), archBad = plat && arch && !myArch.includes(arch);
                    if (platBad || archBad) {
                        if (process.env.OPTIMIZE_DEBUG) {
                            const rel = toPosix(path.relative(nmDir, full));
                            console.log(chalk.gray(`  ✓ ${rel} (${platBad ? '平台不符: ' + plat : '架构不符: ' + arch})`));
                        }
                        delFile(full);
                    }
                }
            };
        processDir(nmDir);
        return removed;
    },
    // ==================== 清开发文件 ====================
    pruneDevFiles = async nmDir => {
        let deleted = 0;
        const PATTERNS = [
            /(^|\/)tsconfig\.json$/,
            /(^|\/)\.nycrc(\.(json|yml))?$/,
            /(^|\/)\.editorconfig$/, /(^|\/)\.prettierignore$/, /(^|\/)\.eslintignore$/,
            /(^|\/)\.dockerignore$/, /(^|\/)\.gitignore$/, /(^|\/)\.gitattributes$/, /(^|\/)\.npmignore$/,
            /\.(md|markdown)$/i, /\.(gyp|gypi)$/i, /\.(yml|yaml)$/i, /\.(h|c)$/,
            /\.d\.ts$/, /\.map$/, /metafile-.*\.json$/,
            /(^|\/)\.eslintrc(\.(json|yml|js|cjs))?$/, /(^|\/)\.babelrc(\.(json|js))?$/,
            /(^|\/)package-lock\.json$/, /(^|\/)\.package-lock\.json$/, /(^|\/)yarn\.lock$/,
        ], DIR_SKIP = new Set([BUNDLED_DIR]),
            walk = d => {
                for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                    const full = path.join(d, f.name);
                    if (f.isDirectory()) {
                        if (DIR_SKIP.has(f.name)) continue;
                        if (f.name === '.github' || f.name === '.circleci') {
                            fs.rmSync(full, { recursive: true, force: true }), deleted++;
                            continue;
                        }
                        walk(full);
                    } else {
                        const rel = toPosix(path.relative(nmDir, full));
                        if (PATTERNS.some(re => re.test(rel))) try { fs.unlinkSync(full), deleted++; } catch { }
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
                else if (f.name.endsWith('.orig')) try { fs.unlinkSync(full), deleted++; } catch { }
            }
        };
        walk(nmDir);
        return deleted;
    },
    applyFilesRules = async nmDir => {
        let deleted = 0;
        // 1) 删顶层 node 假包（npm 上名为 node 的包,仅提供 node.exe,运行时不需要）
        const LICENSE_RE = /^licen[sc]e/i, TS_RE = /\.(ts|cts|mts)$/, nodePkg = path.join(nmDir, 'node');
        if (fs.existsSync(nodePkg)) try { fs.rmSync(nodePkg, { recursive: true, force: true }), deleted++; } catch { }

        // 2) 递归删 node-<platform>* 假包
        const walkForFakeNode = d => {
            let entries;
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
            for (const f of entries) {
                if (!f.isDirectory()) continue;
                const full = path.join(d, f.name);
                if (/^node-(win|darwin|linux|freebsd|sunos|aix)/.test(f.name)) {
                    try { fs.rmSync(full, { recursive: true, force: true }), deleted++; } catch { }
                    continue;
                }
                walkForFakeNode(full);
            }
        };
        walkForFakeNode(nmDir);

        // 3) 删 license/licence 文件或目录 + .ts/.cts/.mts 文件
        const walk = d => {
            let entries;
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return }
            for (const f of entries) {
                const full = path.join(d, f.name);
                if (f.isDirectory()) {
                    if (f.name === BUNDLED_DIR) continue;
                    if (LICENSE_RE.test(f.name)) {
                        try { fs.rmSync(full, { recursive: true, force: true }), deleted++; } catch { }
                        continue;
                    }
                    walk(full);
                }
                else if (LICENSE_RE.test(f.name) || TS_RE.test(f.name)) try { fs.unlinkSync(full), deleted++; } catch { }
            }
        };
        walk(nmDir);

        const cleanEmpty = d => {
            for (const e of fs.readdirSync(d, { withFileTypes: true }))
                if (e.isDirectory()) cleanEmpty(path.join(d, e.name));
            if (d !== nmDir) try { if (fs.readdirSync(d).length === 0) fs.rmdirSync(d), deleted++; } catch { }
        };
        cleanEmpty(nmDir);
        return deleted;
    },
    // ==================== 导出函数 ====================
    markVerified = async tempDir => {
        const p = path.join(tempDir, SNAPSHOT_FILE);
        if (!await fs.pathExists(p)) return;
        try {
            const old = await fs.readJson(p);
            old.verified = true, await fs.writeJson(p, old, { spaces: 2 });
        } catch { }
    },
    optimizeNodeModules = async (tempDir, config = {}) => {
        const excludePkgs = new Set(config.exclude || []), nmDir = path.join(tempDir, NM_DIR),
            snapPath = path.join(tempDir, SNAPSHOT_FILE);

        if (!await fs.pathExists(nmDir)) {
            console.log(chalk.gray('[优化] node_modules 不存在,跳过'));
            return { skipped: true };
        }
        await clearVerified(tempDir);  // 执行优化前清 verified,构建成功后再由 build.js 写回 true

        const t0 = Date.now();
        try {
            // 阶段1: 合并
            console.log(chalk.cyan('  [1/6] 合并 JS...'));
            const m = await mergeAll(nmDir, excludePkgs);
            console.log(chalk.green(`    合并 ${m.merged} 包,跳过 ${m.skipped},删 ${m.totalDeleted} 个 JS`));

            // 阶段2: 清空资源
            console.log(chalk.cyan('  [2/6] 清空复制到项目根的资源...'));
            const c = await clearResources(nmDir, excludePkgs);
            console.log(chalk.green(`    清空 ${c} 项`));

            // 阶段3: 清平台二进制
            console.log(chalk.cyan('  [3/6] 清理非当前平台二进制...'));
            const p = await prunePlatform(nmDir);
            console.log(chalk.green(`    清理 ${p} 项`));

            // 阶段4: 清开发文件
            console.log(chalk.cyan('  [4/6] 清理开发文件...'));
            const d = await pruneDevFiles(nmDir);
            console.log(chalk.green(`    清理 ${d} 个文件`));

            // 阶段5: 清中间产物
            console.log(chalk.cyan('  [5/6] 清理中间产物...'));
            const i = await pruneIntermediates(nmDir);
            console.log(chalk.green(`    清理 ${i} 个文件`));

            // 阶段6: 清除不参与运行的文件（与 build.js 的 files 数组对齐）
            console.log(chalk.cyan('  [6/6] 清除不参与运行的文件和空目录...'));
            const fr = await applyFilesRules(nmDir);
            console.log(chalk.green(`    清理 ${fr} 项`));

            await writeSnapshotFlags(tempDir);   // 写 platform/arch/version,同时 verified=false

            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            console.log(chalk.green(`[信息] 优化完成,耗时 ${elapsed}s`));

            return { merged: m.merged, cleared: c, platform: p, devFiles: d, intermediates: i, filesRules: fr };
        } catch (err) {
            // 失败时删除依赖快照,下次强制重装 + 重优化
            try { await fs.remove(snapPath); } catch { }
            throw err;
        }
    };

export { markVerified, optimizeNodeModules, clearVerified, SELF_HASH };