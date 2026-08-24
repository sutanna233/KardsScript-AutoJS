# KardsScript 项目约定

## 项目定位

- Android 端 KARDS 自动对战工具，唯一维护工程是 `autojs/`。
- 运行框架为 Auto.js6；不维护 Kotlin/Gradle 原生工程。
- 目标是视觉识别、导航、换牌、出牌、攻击、结算和异常恢复；完整闭环仍不应视为稳定完成。

## 当前运行环境

- 工作目录：`J:\dev\KardsScript`
- 模拟器：雷电模拟器 9（64 位），模拟机型必须为 **Xiaomi 15 Pro（Xiaomi 15PRO）**。
- 分辨率：1280×720 横屏；坐标、模板和实机结论均以此为准。
- ADB：`127.0.0.1:5555`；KARDS 包名：`com.android1939.kardsapk`。
- 自动驱动当前通过 `su`/Root shell 发送 `input touchscreen` 事件，因此需要可用的 Root/特权 shell。
- 生产入口 `auto-main.js` 不调用 `auto.waitFor()`；调试入口 `main.js` 会调用它，通常需要无障碍权限。两者都需要截图权限。

## 运行与验证

同步脚本：

```powershell
adb -s 127.0.0.1:5555 push autojs/ /sdcard/AutoJs6/KardsScript/
```

直接启动 Auto.js6 脚本：

```powershell
adb -s 127.0.0.1:5555 shell am start -n org.autojs.autojs6/org.autojs.autojs.external.open.RunIntentActivity -a android.intent.action.VIEW -d file:///sdcard/AutoJs6/KardsScript/autojs/<script>.js
```

运行离线测试：

```powershell
Get-ChildItem autojs/test -Filter *.test.js | ForEach-Object { node $_.FullName }
```

实机日志主要写入：

- `/sdcard/AutoJs6/KardsScript/auto-main-log.jsonl`
- `/sdcard/AutoJs6/KardsScript/runs/games-*.jsonl`

## 独立 APK 打包（已验证配方，2026-08-23 修正）

完整流程：改代码 → `node autojs/tools/bundle-standalone-apk.js`（重生成 `apk-main.js`）→ 复制 `apk-main.js`+`project.json` 到 `vendor/AutoJs6/app/src/main/assets-inrt/project/` → Gradle `assembleInrtDebug` → 注入原生库 → zipalign → apksigner → 安装。

关键坑（实机踩过）：

- **inrt 的 Gradle 不会把 .so 打进 APK**（`packageInrtDebug` 报 "no .so files"），即使 `app/src/main/jniLibs/` 和 `merged_native_libs` 里都有。必须手动注入。
- **正确注入源 = `apk-native-sources/`（16 个）+ OpenCV AAR（4 个）= 共 20 个 .so**，不是只注入 termexec AAR：
  - `apk-native-sources/`：`libc++_shared` + `libjackpal-termexec2` + `libjackpal-androidterm5` + `libmediainfo`，×4 ABI
  - `vendor/AutoJs6/libs/org-opencv-4_8_0/opencv-4.8.0.aar`：`libopencv_java4` ×4 ABI
- **只注入 termexec AAR（8 个）会在战斗时报 `images.findImage` 失败 / `org.opencv.core.Mat.n_Mat() UnsatisfiedLinkError`**：`libopencv_java4.so` 依赖 `libc++_shared.so`，缺它则 OpenCV 加载失败、Java 层 `Mat.n_Mat()` 无实现。`libc++_shared.so` 必须注入。
- 注入脚本支持混用 AAR 与单个 .so：`python tools/add-native-libs-to-apk.py <built.apk> <opencv.aar> <apk-native-sources/**.so...> <out.apk>`（.so 的 ABI 取自其父目录名）。
- 构建产物：`vendor/AutoJs6/app/build/outputs/apk/inrt/debug/comet-v6.7.0-universal.apk`；zipalign/apksigner 用 `C:\Users\User\scoop\apps\android-clt\current\build-tools\36.0.0\`。
- 生成物不入库：`apk-main.js`、APK、`vendor/`、`native-shell/`、`apk-native-sources/`、截图均不进公开 Git。

## 输入与安全红线

- KARDS Unreal 引擎使用 `input touchscreen tap/swipe`；普通 `input tap` 不可靠，不作为主路径。
- 默认配置必须保持 `mode: "observe"`、`allowNavigation: false`、`allowBattleActions: false`，专项实机测试才可有界开启。
- 先判页面，再在该页面限定区域使用对应模板；禁止跨页面全屏模板搜索和盲点固定坐标。
- 点击后必须等待页面变化；页面等待超时应停止，不得重复点击。
- 手牌数量、费用、来源框必须跨至少两帧稳定；费用或布局不确定时不得拖牌或结束回合。
- 攻击、移动和出牌目标必须来自当前帧视觉确认的合法目标；识别不确定时安全停机。
- 运行期间避免 `toast()` 和逐帧 `console.log()`，防止遮挡手牌和破坏 OCR。
- 重连弹窗、每日任务、结果页等异常页面必须先处理，再回到导航状态机。

## 代码分层

- `autojs/lib/vision.js`：页面、回合、手牌、单位和目标识别。
- `autojs/lib/decision.js`：声明式 JSON 决策树 DSL，不执行用户任意代码。
- `autojs/lib/strategy.js`：卡牌/单位选择和目标排序。
- `autojs/lib/driver.js`：唯一输入驱动入口；接入拟人化（自适应 tap 抖动、swipe 端点变异、时长随机化、导航节奏扰动）。
- `autojs/lib/runtime.js`：场景状态机、动作握手和失败恢复；战斗动作前调用拟人化思考延迟。
- `autojs/lib/humanize.js`：拟人化 / 反脚本检测层（三角分布坐标抖动、时间变异、思考延迟、tick 扰动）；纯同步、零额外 shell 调用。
- `autojs/strategy/`：用户可编辑策略；`autojs/templates/`：页面专用模板。

## 拟人化 / 反脚本检测（humanize）

目标：让输入行为在统计特征上接近真人，降低可检测信号（固定坐标、等间距动作、直线固定时长拖拽、零反应延迟）。

- **总开关**：`config.humanize.enabled`（默认 `true`；设 `false` 退化为原始固定行为，用于回归测试）。driver 在 `create()` 时以 config 为唯一开关同步模块级标志。
- **坐标抖动（自适应）**：tap 偏移半径 = `min(tapJitterRadius, 目标最小边像素 × 0.12)`，下限 2px。大按钮（187px）→ 8px，小按钮（48px）→ 5px，极小目标（35px）→ 4px。用三角分布（两次随机求和）近似正态，95% 偏移落在 ±3px 内。
- **swipe 端点抖动**：起点 `swipeJitterRadius`(默认 5) / 终点(默认 7) 各自加偏移；时长按距离随机化（120~900ms）。
- **tap 按压时长**：随机 60~200ms（原固定 120ms）。
- **思考延迟**：战斗动作（出牌/移动/攻击）前插入 `thinkTimeBaseMs`(默认 50ms) 比例的随机延迟，偶发 8% 长停顿模拟犹豫。
- **tick 扰动**：主循环观察间隔加入 ±15% 随机变化，避免完美等间距心跳。
- **导航节奏**：`navPaceMs` 加入 ±30% 随机变异。
- **用户可配**：`user-strategy.json` 的 `humanize` 对象（enabled / tapJitterRadius 2~20 / swipeJitterRadius 2~15 / paceVariance 0.1~0.6 / thinkTimeBaseMs 20~2000）。
- **覆盖范围**：所有 tap（导航/单位/目标/结束回合/弹窗）走 `tap()` 自适应抖动；所有拖拽（出牌/攻击/移动）走 swipe 端点抖动 + 时长随机化。
- **测试**：`autojs/test/humanize.test.js`（32 项，含三角分布中心密度验证）；`runtime-replay.test.js` 关闭拟人化以保持坐标断言确定性。

## 出牌安全护栏（2026-08-24 新增）

- **单卡出牌次数上限**：`config.maxCardPlayAttemptsPerCard`（默认 2，用户可在 `user-strategy.json` 编辑，范围 1~5）。同一张手牌被反复尝试出牌但**未真实打出**（下一帧该牌 id 仍在手牌中）时累计计数，达到上限即本回合封锁该牌，转向下一张或结束回合。
- **目的**：硬性打断"手牌误判/幻影牌误判可出 → 费用不足反复拖牌 → 卡死"循环。不追求识别完美，用护栏兜底。
- **实现**：`runtime.js` 的 `cardPlayAttempts`（按 card.id 计数）+ `lastAttemptedCardId`（判断牌是否真打出：出牌后下一帧该 id 消失才清零，仍在则保留计数）。回合转换时清空。
- **注意**：出牌确认的"手牌减少一张"会被拖拽动画误判（detectHand 数量短暂抖动），`playAttempts` 会被反复重置，所以不能用 `playAttempts` 做卡死判定，必须用本机制按 card.id 追踪。

## 性能基线（2026-08-24 实测，emulator-5556 1280×720）

- 视觉观察帧：p50 从 2836ms → 1462ms（-48%），p90 从 10.8s → 1.7s（-84%）。
- 瓶颈本质是 **Rhino 纯 JS 循环 + 每次 pixel() 的 JNI 调用**，不是单次 JNI（实测 2 万次 JNI 仅 337ms）。
- 已做优化：像素采样加粗（frontline/banner/orangeMoveCost）、HQ 重扫限频 3s、hand/guard/指纹缓存、BFS 内联、稳态跳帧（stale 帧画面未变则跳过状态机）。
- **像素采样陷阱**：`detectOrangeCostBadge` 的步长是精细校准的（改步长会把灰色费用误判为橙色），`feature()` 的边缘密度 E 对 stride 敏感——这两处的采样密度**不能动**（回归测试 vision-replay 会抓到）。
- `captureScreen()` 本身约 880ms/帧（系统层，不可优化），不占 observeMs。

## 当前已知限制

- 项目仍在开发中，存在未知 Bug；脚本可能卡住、停止运行或需要手动恢复，不保证稳定挂机。
- 费用 OCR、7–9 张扇形手牌坐标、完整卡牌识别、攻防/总部血量 OCR 仍有限制。
- 单位可操作状态、自动攻击、结算后再匹配和全部异常恢复仍需更多独立实机证据。
- 模板必须匹配当前 UI 版本；历史模板不得直接用于自动点击。
- 分辨率不为 1280×720 时，不得假设现有坐标和模板仍安全。

### 2026-08-24 实测发现的识别缺陷（未根治）

- **手牌数量检测对 3 张及以下扇形误判**：实测 3 张手牌被 `bottomHandCountBySpan` 的 envelope 兜底公式 `(w-120)/120+1` 误判为 5 张（envelope 592px 落入未校准区间）。校准表只覆盖 4/5/6 张（620/680/720px），1–3 张小手牌无校准数据。误判出幻影牌后若其 costBounds 落在真实牌暖色卡面，会被 `detectOrangeCostBadge` 误判为橙色可出 → 费用 0 时反复出牌卡死（已由"单卡出牌上限"护栏兜底打断，未根治识别）。
- **HQ 详情检视界面无自动关闭**：误触我方总部卡面会弹出 HQ 详情大卡（背景暗化 + 左上"总部"提示框），runner 无此页面识别与关闭逻辑，会卡住。需加识别规则 + 点卡片外部/返回键关闭。
- **误入排位疑点**：用户报告 runner 误入排位（配置 modeType=training）。`coordinates.js` 的 `MODE_TRAINING` 中心 (357,259) 与历史记录 (226,175) 不一致，疑似坐标偏移导致误触对战模式。未定位确认。
- **实机环境差异**：本轮实测用的是 `emulator-5556`（机型 2410DPN6CC / Android 9），非约定的雷电 5555 + Xiaomi 15 Pro。分辨率一致（1280×720）故坐标兼容，但机型差异未覆盖验证。

### 2026-08-24 每日首胜奖励页

- 用户实测每日首胜奖励页会显示“每日首胜”、20金币、“轻触领取”和右上“查看战场”；此前未建模为独立页面，runner 会落入 UNKNOWN 而卡住。
- 已增加 `DAILY_FIRST_WIN` 组合识别（顶部暗化 + 标题 + 查看战场按钮 + 金币堆 + 底部奖励提示），领取动作固定点击底部奖励提示区域；不得点击右上“查看战场”。
- 原生 1280×720 实机截图与用户缩放附图的特征值不同，实测校准以原生画面为准；附图仅作页面结构证据，不能直接复用其亮度上限。

### 2026-08-24 雷电 Android 14 启动日志写入异常

- 实测设备 `emulator-5554` 为 Android 14 / API 34；启动独立 APK 后完整异常为：`FileNotFoundException: /sdcard/AutoJs6/KardsScript/auto-main-log.jsonl: open failed: ENOENT (No such file or directory)`。
- 同时系统日志明确记录 `MediaProvider: Creating or writing to a non-default top level directory is not allowed!`；`/sdcard/AutoJs6` 在新实例中不存在。
- 根因不是 KARDS 识别或 OpenCV，而是 Android 14 共享存储限制：`auto-main.js` 第 33 行吞掉 `files.ensureDir(archiveDir)` 的失败，第 34 行又未捕获地写入公共目录，最终显示 `Wrapped org.autojs.autojs.pio.UncheckedIOException`。
- Android 9 的 `emulator-5556` 与 Android 14 新实例行为不同；日志、运行状态和策略文件应优先迁移到应用私有目录，或显式处理 Android 11+ 的共享存储授权/目录创建失败。
- 已修复：`auto-main.js` 启动时对运行目录做可写性探测，公共目录不可用时回退到 `context.getFilesDir()` 私有目录；日志、悬浮状态和归档统一使用探测结果，归档目录按归档文件路径创建。

### 2026-08-24 1.1.4 持续实机页面采集（emulator-5556，1280×720）

- **促销广告误判**：真实截图 `跳岛战术礼包` 的关闭 X 包围盒约为 `[1092,122,1126,158]`，中心约 `(1109,140)`；当前 `regions.popupClosePromo` 从 x=1145 才开始，促销模板无法命中。该广告曾被实时探针误判为 `DAILY_QUEST`，另一次被误判为 `BATTLE/white-end-turn-ui`，不得在这类误判下执行导航点击。
- **主页误判**：关闭广告后真实画面为 HOME，但实时探针返回 `SHOP/shop`，说明 HOME 与 SHOP 的宽松颜色规则仍有重叠。
- **已正确采集页面**：模式菜单 `MODE_MENU/mode-menu`（置信度 1.0）、训练模式选中后的卡组列表 `DECK_LIST/training-deck-chooser-selected`（0.92）、卡组详情 `DECK_DETAIL/deck-detail`（1.0）。
- **换牌页回放误判**：真实截图含“选择要替换的卡牌”和底部“确认”的 MULLIGAN 页面，使用 1.1.4 vision 回放却返回 `BATTLE/grey-end-turn`（0.90）；换牌模板或右侧回合控件规则需要进一步校准。
- 以上页面截图保存在项目工作区的 `page-*.png` 测试产物中；本轮未执行出牌、攻击或结束回合。
- **设置页误判**：实机打开战斗齿轮后的“设置/投降”浮层仍返回 `BATTLE/OUR_TURN`；进入完整设置页后仍返回 `MODE_MENU/mode-menu`。`battle-settings-menu.png`、`settings-tab.png` 等按钮模板虽存在，但当前页面分类没有在 `observe()` 的早期路径使用它们。

## 重要文档索引

- `README.md`：安装、权限、模拟器机型、风险声明和用户说明。
- `autojs/README.md`：Auto.js6 导入与运行。
- `docs/project-overview.md`：完整架构和技术说明。
- `docs/vision-and-targeting.md`：视觉识别与合法目标设计。
- `docs/assets-inventory.md`：现有模板、卡图和数据资产清单。
- `docs/hardware-test-report-2026-08-20.md`：历史实机测试与限制。
- `docs/reliability-update-v2.md`：稳定性参数和安全重试策略。
- `docs/standalone-apk-acceptance-2026-08-23.md`：独立 APK 验收记录。

## 项目公开说明

- README 顶部保留 QQ 群：`910392625` 和仓库 banner。
- 必须明确自动化脚本可能违反游戏规则并导致账号限制/封禁；用户应谨慎使用并自行承担后果，项目作者及贡献者不对相关损失负责。
- 必须明确项目仍在开发，不能承诺稳定运行或无人值守挂机。

## Git 协作约定

- 当前远程仓库：`https://github.com/sutanna233/KardsScript-AutoJS.git`。
- 用户提出功能、文档或 Bug 修改需求时，先在 GitHub 创建 issue，完成后评论并关闭。
- 每个有意义的工作单元单独提交，commit message 使用简洁中文；只提交本次相关文件，保留用户已有未提交改动。
