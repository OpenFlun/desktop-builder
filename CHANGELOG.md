# 变更日志
## [4.1.3] - 2026-08-07 22:36
### 修复
- 修复了构建后安装成功时应用中心和控制面板,没有正确应用 'uninstallDisplayName' 字段值的问题;

## [4.1.2] - 2026-08-07 16:12
### 修正
- Windows下 'inno.versionInfoCompany' 字段默认值更正为从 package.json 读取 author
- 其它细节优化修正;
### 修复
- 修复了配置的卸载图标无效的问题;
### 更新
- 依赖更新为最新版本;

## [4.1.1] - 2026-08-05 19:24
### 修正
- 声明inno实际字段默认值以下为准（当前版本已对配置默认值进行修正，确保与代码实现一致）：
  - `appName`：默认从 `package.json` 的 `name` 读取，若不存在则为 `'deskApp'`
  - `build.publisher`：默认从 `package.json` 的 `author` 读取
  - `build.shortcutName`：默认使用 `build.appName`
  - `build.inno.appName`：默认使用 `build.appName`
  - `build.inno.appVersion`：默认从 `package.json` 的 `version` 读取
  - `build.inno.appPublisher`：默认使用 `build.publisher`
  - `build.inno.appId`：默认使用 `build.appId`
  - `build.inno.defaultDirName`：默认使用 `build.appName`
  - `build.inno.defaultGroupName`：默认使用 `build.appName`
  - `build.inno.outputDir`：默认使用 `build.outputDir`
  - `build.inno.outputBaseFilename`：默认 `<build.appName>Setup.exe`
  - `build.inno.shortcutName`：默认使用 `build.shortcutName
  - `build.inno.versionInfoVersion`：默认使用 `inno.appVersion`
  - `build.inno.versionInfoCompany`：默认使用 `build.appName`
### 修复
- 修复了某些特殊场景下构建时报快捷方式配置错误的问题;
- 修复了默认值不对的问题;