# 彗星助手独立 APK 验收记录（2026-08-23）

## 验收结论：通过

独立 APK 完成修复并完成一次完整实机对局闭环。

## 六项验收条件逐项核对

### 1. 修复 AutoJs6 inrt 打包资源错误（abc_vector_test）✅

- 根因：Auto.js6 6.7.0 内置 ApkBuilder 生成的模板 APK 资源索引损坏（对应 Issue #471）。
- 方案：弃用内置打包器，改为直接构建 `vendor/AutoJs6` 的 inrt Gradle 变体。
- 验证：安装后启动不再出现 `abc_vector_test` 崩溃。

### 2. 补齐 AutoJs6 JNI 依赖（termexec、OpenCV、libc++）✅

Gradle inrt 变体不会自动合入本地 AAR 的 native 库，已通过 `tools/add-native-libs-to-apk.py` 手动注入 16 个 `.so`（四 ABI × 4 库）：

- `libjackpal-termexec2.so` / `libjackpal-androidterm5.so`（shell 执行）
- `libopencv_java4.so`（images.findImage 模板匹配）
- `libc++_shared.so`（OpenCV 的 STL 运行时，缺它会导致 Mat.n_Mat 无法解析）

验证：logcat 出现 `Images: OpenCV: initialized`，`OpenCV/StaticHelper` 输出 x86_64 ABI 信息，未再出现 `UnsatisfiedLinkError` / `No implementation found`。

### 3. 修复脚本运行时错误 ✅

- `floaty.checkPermission` TypeError：独立 inrt 运行时不暴露该 API。已修两处：
  - `autojs/launcher.js`：`ensureController()` 直接跳过悬浮窗权限探测，不阻塞启动；
  - `autojs/lib/floating-controller.js`：try/catch 包裹权限探测，失败时静默返回 null。
- `images.findImage` OpenCV 崩溃：随第 2 项修复。
- 额外处理：`SplashActivity` 强制运行 `main.js`，故把打包资源中的 `main.js` 与 `apk-main.js` 同步为同一内容，避免执行到占位脚本。

### 4. APK 可启动并可启动自动对战 ✅

- 包名：`com.kardsscript.comet`，版本名 6.7.0（AutoJs6 基座）。
- 安装：`adb install -r -d CometAssistant-v1.0.0.apk` → Success。
- 启动：`SplashActivity` → `ScriptExecuteActivity` → `开始运行 [main.js]`，进程持续运行。
- 注：debug 构建含 LeakCanary，它注册了一个额外 launcher Activity；用 monkey 启动会进入 LeakLauncherActivity，必须显式 `am start -n .../SplashActivity`。

### 5. 雷电模拟器（127.0.0.1:5555）完成一次可验证实机测试 ✅

日志：`docs/standalone-apk-full-game-2026-08-23.jsonl`（对应模拟器归档 `runs/games-1787414073878.jsonl`）。

关键事件序列：

| 时间 (ms) | 事件 |
|---|---|
| 0 | run-start，读取 `/sdcard/KardsScript/user-strategy.json` 成功 |
| ~17800 | HOME 识别并点击进入 |
| ~24442 | MODE_MENU，点击训练模式 |
| ~47047 | DECK_LIST 选卡组 |
| ~64959 | MULLIGAN 换牌确认 |
| ~76122 | 进入 BATTLE / OUR_TURN |
| ~109968 | PLAY_CARD：拖牌到己方自由部署区，单位出现确认 |
| ~144928 | MOVE_TO_FRONTLINE：单位前移确认 |
| ~415846 | ATTACK_UNIT：前线单位攻击敌方总部，棋盘状态变化确认 |
| ~84134 / 236008 / 298476 等 | 多次 END_TURN 成功切换 OUR_TURN/OPPONENT_TURN |
| 620798 | RESULT 结算页识别（template-result-continue，置信度 0.99） |
| 620798 | `game-complete`，`completedGames: 1`，`done: true` |

### 6. APK、日志、结果与剩余问题记录 ✅

- 最终 APK：`J:\dev\KardsScript\CometAssistant-v1.0.0.apk`（约 220 MB，debug 签名）
- 构建工具：`tools/add-native-libs-to-apk.py`（已支持多 AAR + 裸 .so 注入）
- 实机日志：`docs/standalone-apk-real-test-2026-08-23.jsonl`、`docs/standalone-apk-full-game-2026-08-23.jsonl`
- 构建工程：`vendor/AutoJs6/`（不入 Git）

## 剩余问题（不阻塞本次验收，但需后续处理）

1. **费用 OCR 全为 null**：出牌依赖橙色费用徽章色块而非数值；`credits: null`、`cost: null` 贯穿全程。后续恢复 `readCardCosts` 或改进费用区域采样。
2. **GUI 内图标未显示**：logcat 报 `Resources$NotFoundException: drawable not found: .../assets/comet-assistant-icon.png`（打包工程 assets-inrt/project/assets 与脚本 UI 的相对路径解析问题）。仅影响界面图标，不影响运行。
3. **偶发误识别**：战斗中出现一次 MODE_MENU 误判（mode-menu rule 命中战斗帧），随后自动恢复；可考虑提高页面切换守卫。
4. **debug 包混入 LeakCanary**：正式分发建议切 release 变体或在 Gradle 中移除 debugImplementation。
5. 由用户提出的下一轮需求（先于 APK 继续打包，改 Auto.js 直接测试）：桌面启动时每日任务/商店广告弹窗恢复路径、休闲/排位模式路径、可调节奏参数（含安全默认值）、缩短默认操作间隔。
