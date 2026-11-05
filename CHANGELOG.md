# 变更日志

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

## [6.4.3] - 2026-11-04 20:34
### 优化
- 细节优化+依赖包升级;

## [6.4.2] - 2026-10-30 10:31
### 优化
- 未知命令由"先提示再让用户执行 help"改为直接打印帮助内容,退出码仍为非零;
- 提取 printHelp 供 help 分支与未知命令分支共用,避免帮助文本在两处重复维护;
- 帮助入口统一写作 `help` 子命令,`--help`、`-h` 继续可用;

### 文档
- README 新增"命令行"章节:说明 `bin` 命令名、`build`/`--debug` 参数与 `help` 用法,
  补齐此前只散落在"快速开始"中的命令说明;