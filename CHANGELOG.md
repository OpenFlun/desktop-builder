# 变更日志

## [5.0.0] - 2026-10-01 22:43
### 破坏性变更
- 适配 electron-builder v27,配置文件格式发生不兼容变更,旧配置在 electron-builder v27 下会直接报错:
  - `npmRebuild` 移入 `nativeModules.npmRebuild`
  - `asar: false` 改为 `asar: { unpack: [...] }`,默认启用 asar
  - macOS 签名选项移入 `mac.sign` 对象
  - `syncDesktopName` 已被 electron-builder v27 移除,行为变为始终同步
- electron-builder 依赖升级至 `^27.0.0-alpha.9`

### 新增
- 配置模板新增 electron-builder v27 迁移说明注释
- 显式锁定 `toolsets.wine: 'system'`,避免默认值静默漂移

### 优化
- ASAR 配置改用 electron-builder v27 对象格式,消除 asar 禁用警告

## [4.1.7] - 2026-10-01 20:26
### 更新
- 更新了 "electron-builder" 依赖包;

## [4.1.6] - 2026-10-01 19:46
### 优化
- 配置模板文件新增了构建指令注释;
- 升级了一些依赖包;
