# 变更日志
## [4.0.0] - 2026-08-03 20:30
### 破坏性更新
**Windows 安装程序从 NSIS 切换为 Inno Setup**
  此前 Windows 平台默认使用 `electron-builder` 的 NSIS 目标（`nsis` 配置），现改为基于 **Inno Setup**（`inno` 配置）生成安装包。这意味着：
  - 原有的 `build.nsis` 配置项将**不再生效**，您需要将相关设置迁移到新增的 `build.inno` 对象中;->可先重命名配置文件,然后安装新版,最后对照迁移配置;
  - 安装包扩展名仍为 `.exe`，但构建流程和内部行为已完全不同（例如向导样式、语言支持、卸载逻辑等均基于 Inno Setup）;
  - 该变更为**不可逆**，如需继续使用 NSIS，请锁定 `@flun/desktop-builder` 至 `v3.x及以下` 版本。

**Windows 安装程序改用 Inno Setup,因为它提供更强大的自定义能力和更现代的向导界面,并且安装速度极快;**

### 优化
- **`appName` 不再强制要求配置**
  此前 `appName` 为必填项，未配置会导致构建失败。现在若未指定，将自动按以下优先级回退：
>1. 读取项目 `package.json` 的 `name` 字段；
>2. 若仍不存在，使用默认值 `'deskApp'`。
- 构建缓存机制改进：依赖快照对比更精确，避免不必要的 `npm install`，加快重复构建速度。

### Inno Setup依赖(Windows系统务必先下载安装)
  - 官网:https://jrsoftware.org/isdl.php
  - 国内 https://gitee.com/OpenFlun/inno-setup/releases

**`注意安装时一定要选择默认安装路径,不然会因为找不到文件而构建失败;`**


## [3.0.5] - 2026-07-26 14:11
### 优化
- 依赖包更新;
## [3.0.4] - 2026-07-25 11:06
### 优化
- 将'build.js'中的镜像源由华为改为阿里;