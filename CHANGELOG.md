# 变更日志

## [6.5.2] - 2026-11-06 11:22
### 优化
- 细节优化+依赖包升级;

## [6.5.1] - 2026-11-05 08:21
### 优化
- 依赖包升级;

## [6.5.0] - 2026-11-05 08:17
### 新增
- 命令行新增 `example` 子命令,重新生成 `desktopAppConfig.js` 与 `build/` 到项目根目录;
  此前这两个文件只由 `postinstall` 自动复制,误删后无法手动恢复;

### 优化
- 命令行入口从 `index.js` 迁至 `bin/cli.js`,`bin` 字段同步更新;命令名 `desktop-builder` 不变;
  `index.js` 精简为库入口,只导出 `build`;
- `build.js` 移除 `printHelp` 与 `runCLI`,CLI 逻辑集中到 `bin/cli.js`;
- `copy-files.js` 输出改用 chalk 按语义着色,移除 emoji 前缀,与其他作用域包一致;

### 文档
- README 目录结构按文件类型分组,与 `package.json` 的 `files` 字段顺序一致,并补 `bin/cli.js`;
- README 命令行章节补充 `example` 子命令;
- `index.d.ts` 移除已删除的 `runCLI` 引用;