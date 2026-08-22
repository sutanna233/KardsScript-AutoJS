# 彗星助手独立 APK 交接报告（2026-08-22）

## 目标

为 KardsScript 交付无需另装 Auto.js6 的 APK，名称为“彗星助手”，包含：

- 用户可编辑策略 GUI；
- 浮窗控制器与自动对战脚本；
- 用户提供的红发角色图标；
- 模拟器安装、GUI 保存、脚本启动验证。

## 当前结论

GUI、图标、策略保存和 APK 安装均已验证；独立 APK 的脚本启动仍有一个已定位的 JNI 缺库问题，尚未完成最终复测，因此不能宣称交付完成。

原始 Auto.js6 6.7.0 内置 inrt 打包器不应继续使用：它会生成资源索引损坏的 APK，启动时报 `abc_vector_test` 不存在（对应 Issue #471 的症状）。

## 已完成并验证

### 项目侧改动

- `autojs/launcher.js`：策略 GUI，深色金色样式，包含“仅保存”和“保存并启动自动对战”。
- `autojs/lib/user-strategy.js`：用户策略读写与校验。
- `autojs/lib/floating-controller.js`：浮窗启停控制。
- `autojs/auto-main.js`：读取 `/sdcard/KardsScript/user-strategy.json`；不再读取旧原生壳的 app-specific 路径。
- `autojs/assets/comet-assistant-icon.png`：由用户给出的红发角色图生成，已用于 GUI 和应用图标。
- `autojs/tools/bundle-standalone-apk.js`：把 CommonJS 模块打成单文件入口 `autojs/apk-main.js`。
- `autojs/project.json`：名称为 `彗星助手`，入口为 `apk-main.js`，图标为 `assets/comet-assistant-icon.png`。

离线验证已通过：

```powershell
node autojs\tools\bundle-standalone-apk.js
node autojs\test\user-strategy.test.js
node autojs\test\decision-replay.test.js
node autojs\test\runtime-replay.test.js
```

### GUI 与图标实机验证

已构建并安装过包名为 `com.kardsscript.comet` 的 APK。模拟器截图 `J:\dev\KardsScript\comet-launch.png` 显示：

- 标题为“彗星助手”；
- 顶部显示用户的红发角色图标；
- 出牌规则、前线策略和每回合动作上限 GUI 正常显示。

策略文件已在模拟器真实存在：

```text
/sdcard/KardsScript/user-strategy.json
```

读取到的内容为：

```json
{
  "schemaVersion": 1,
  "name": "基础策略",
  "actionOrder": ["OPERATE_UNIT", "PLAY_CARD", "END_TURN"],
  "cardPreference": "VISUAL_CONFIDENCE",
  "preferFrontlineUnits": true,
  "maxCardPlaysPerTurn": 3,
  "maxUnitActionAttemptsPerUnit": 3
}
```

## 独立运行时构建路线

官方源码已克隆到（构建用目录，不应提交 Git）：

```text
J:\dev\KardsScript\vendor\AutoJs6
```

为了绕过旧打包器，采用“直接构建完整 inrt APK”方式，而非用 Auto.js6 已安装版本的 `ApkBuilder` 再打一次包。

已做的源码侧定制：

- `app/build.gradle.kts`
  - inrt `applicationId`：`com.kardsscript.comet`
  - inrt 名称：`彗星助手`
  - FileProvider authority：`com.kardsscript.comet.fileprovider`
  - 删除 inrt 的 `jniLibs.excludes += "*"`（独立包需要 JNI）。
- `app/src/main/AndroidManifest.xml`
  - 插件权限从 `org.autojs.permission.PLUGIN` 改为 `com.kardsscript.comet.permission.PLUGIN`，使它可与已安装的 Auto.js6 共存。
- `app/src/main/res/mipmap/ic_launcher.png`
  - 替换为 `autojs/assets/comet-assistant-icon.png`。
- `app/src/main/assets-inrt/project/`
  - 已放入 `apk-main.js`、`project.json`、`assets/comet-assistant-icon.png`、`templates/` 和 `strategy/`。
- 因本项目不使用 RapidOCR 和 ImageQuant，已移除二者 Gradle 模块；`OcrRapid.kt` 保留空实现，避免 NDK 编译依赖。
- `LogBottomSheet.kt` 修正为 inrt 的 `AutoJs.instance`，修复当前 AutoJs6 master 的 inrt Kotlin 编译错误。
- `colors_inrt_compat.xml` 增加 `console_debug` 与 `console_verbose` 资源别名，修复 inrt 资源链接错误。

构建命令：

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot'
$env:ANDROID_HOME='C:\Users\User\scoop\apps\android-clt\current'
.\gradlew.bat :app:assembleInrtDebug --no-daemon --console=plain
```

构建产物：

```text
J:\dev\KardsScript\vendor\AutoJs6\app\build\outputs\apk\inrt\debug\comet-v6.7.0-universal.apk
```

外部交付副本：

```text
J:\dev\KardsScript\CometAssistant-v1.0.0.apk
```

## 当前阻塞点：精确根因

APK 已可安装、GUI 可打开，但点击“保存并启动自动对战”后，脚本启动时崩溃：

```text
java.lang.UnsatisfiedLinkError: couldn't find "libjackpal-termexec2.so"
at jackpal.androidterm.TermExec.<clinit>
at org.autojs.autojs.runtime.api.Shell.init
```

原因：inrt 变体原本设计为“模板 APK”，Gradle 没有把 `jackpal-androidterm-libtermexec-1_0` 的 AAR 原生库合并进最终 APK。虽然已删除 `jniLibs.excludes += "*"`，最新输出仍没有 `lib/` 条目（Gradle 对本地 AAR 的 inrt 打包没有纳入该依赖）。

缺失库的官方 AAR 在：

```text
vendor\AutoJs6\libs\jackpal-androidterm-libtermexec-1_0\libtermexec-release.aar
```

其中确实含有：

```text
jni/x86_64/libjackpal-termexec2.so
jni/x86_64/libjackpal-androidterm5.so
jni/x86_64/libc++_shared.so
jni/x86_64/libmediainfo.so
```

所有 ABI 的 `.so` 已提取到：

```text
vendor\AutoJs6\app\src\main\jniLibs\
```

但 Gradle 产物仍未出现 `lib/` 条目，建议下一位 agent 直接完成下面的 APK 注入与重签名方案。

## 推荐的下一步（最快）

已新增脚本：

```text
J:\dev\KardsScript\tools\add-native-libs-to-apk.py
```

它会把 AAR 中 `jni/<abi>/*.so` 注入 APK 的 `lib/<abi>/*.so`。按以下顺序执行：

```powershell
cd J:\dev\KardsScript

python tools\add-native-libs-to-apk.py `
  vendor\AutoJs6\app\build\outputs\apk\inrt\debug\comet-v6.7.0-universal.apk `
  vendor\AutoJs6\libs\jackpal-androidterm-libtermexec-1_0\libtermexec-release.aar `
  CometAssistant-jni-unsigned.apk

C:\Users\User\scoop\apps\android-clt\current\build-tools\36.0.0\zipalign.exe `
  -f -p 4 CometAssistant-jni-unsigned.apk CometAssistant-jni-aligned.apk

C:\Users\User\scoop\apps\android-clt\current\build-tools\36.0.0\apksigner.bat sign `
  --ks C:\Users\User\.android\debug.keystore `
  --ks-key-alias androiddebugkey `
  --ks-pass pass:android --key-pass pass:android `
  --out CometAssistant-v1.0.0.apk CometAssistant-jni-aligned.apk

adb -s 127.0.0.1:5555 install -r CometAssistant-v1.0.0.apk
adb -s 127.0.0.1:5555 shell monkey -p com.kardsscript.comet 1
```

然后验证：

```powershell
python -c "import zipfile; z=zipfile.ZipFile('CometAssistant-v1.0.0.apk'); print([x.filename for x in z.infolist() if 'libjackpal-termexec2.so' in x.filename])"
adb -s 127.0.0.1:5555 logcat -c
# 在 GUI 点“保存并启动自动对战”
adb -s 127.0.0.1:5555 logcat -d | Select-String 'UnsatisfiedLinkError|FATAL EXCEPTION|libjackpal'
```

预期：最终 APK 至少包含 `lib/x86_64/libjackpal-termexec2.so`，且点击启动后不再出现本报告所列的 `UnsatisfiedLinkError`。

如仍出现其他 `.so` 缺失，先列出 APK 的 `lib/` 条目和新的堆栈；不要回退到旧 Auto.js6 内置 inrt 打包器。

## 完成验收条件

只有同时满足以下条件才可标记完成：

1. `CometAssistant-v1.0.0.apk` 能安装，包名为 `com.kardsscript.comet`；
2. 启动时不再出现 `abc_vector_test` 或 `libjackpal-termexec2.so` 崩溃；
3. GUI 显示“彗星助手”和用户图标；
4. 修改策略并点“仅保存”后，`/sdcard/KardsScript/user-strategy.json` 随选择更新；
5. 点“保存并启动自动对战”后，脚本引擎进入运行态；
6. APK、`vendor/`、`native-shell/`、截图和日志均不可加入公开 Git；`AGENTS.md` 和 `CLAUDE.md` 已由 `.gitignore` 排除。
