# 工作记录与交接（2026-08-24）

> 交接对象：下一位开发者（codex）。本文档记录 2026-08-24 这一轮的工作成果、当前项目状态、待根治问题（附定位线索）和必须知道的技术坑。

---

## 一、本次完成的工作

### 1. 拟人化 / 反脚本检测（humanize）

新增 `autojs/lib/humanize.js`，让输入行为在统计特征上接近真人，降低被反作弊检测的信号：

- 坐标抖动（自适应目标尺寸，三角分布，95% 落在 ±3px 内）
- swipe 端点抖动 + 时长随机化（120~900ms，按距离）
- tap 按压时长随机 60~200ms
- 战斗动作前思考延迟（`thinkTimeBaseMs` 默认 50ms，8% 偶发长停顿）
- 主循环 tick ±15% 扰动、导航节奏 ±30% 变异
- 总开关 `config.humanize.enabled`（默认 true，设 false 退化为原始行为用于回归测试）
- 用户可在 `user-strategy.json` 的 `humanize` 对象里调参

接入点：`driver.js`（tap/swipe）、`runtime.js`（thinkBeforeAction）、`auto-main.js`（tick）。

### 2. 性能优化（实测数据）

| 指标 | 优化前 | 优化后 | 幅度 |
|---|---|---|---|
| observeMs p50 | 2836ms | 1462ms | **-48%** |
| observeMs p90 | 10.8s | 1.7s | **-84%** |

已做的优化（`vision.js` / `runtime.js`）：
- 像素采样加粗：frontline（2.6万→2.8千次/帧）、banner、orangeMoveCost
- HQ 重扫限频 3 秒（一回合多个动作只重扫一次）
- hand/guard/指纹缓存（OPPONENT_TURN 复用手牌、guard 每 4 帧、稳态跳帧）
- detectHqByHealth 的 BFS 内联 for 循环（去掉 forEach 闭包开销）
- detectFormationHqBounds 的 chainMembers 截断前 8
- 稳态跳帧（画面指纹未变则 vision 返回 `stale:true`，runtime 完全跳过状态机）

### 3. OpenCV 崩溃修复

症状：`images.findImage` 报 `org.opencv.core.Mat.n_Mat() UnsatisfiedLinkError`。
根因：注入的原生库缺 `libc++_shared.so`（OpenCV 的 C++ 运行时依赖）。
修复：注入源改为 `apk-native-sources/`（16 个）+ OpenCV AAR（4 个）= **20 个 .so**。详见 AGENTS.md「独立 APK 打包」。

### 4. 单卡出牌次数上限护栏（防卡死）

新增 `config.maxCardPlayAttemptsPerCard`（默认 2，用户可在 user-strategy.json 编辑，范围 1~5）。

- 场景：手牌数量误判出幻影牌 + 幻影牌徽章误判橙色 → 费用 0 时反复拖牌卡死。
- 机制：`runtime.js` 的 `cardPlayAttempts` 按 card.id 计数；出牌后下一帧该 id 仍在手牌中 = 未真打出，计数保留；达上限则本回合封锁该牌，转向下一张或结束回合。
- 为什么不能用现成的 `playAttempts`：出牌确认的"手牌减少一张"会被拖拽动画误判，`playAttempts` 被反复重置，永远触不了顶。

---

## 二、当前交付状态

- **最新版本**：`CometAssistant-v1.1.4.apk`，已发布到 GitHub Release v1.1.4（Latest）。
- 代码已推送 main，最新提交 `b33dacd`。
- 离线测试 10 个全部通过。
- 实机连打多局（16 分钟、多局）回合判定正常，无超时停机。

---

## 三、待根治问题（按优先级，附定位线索）

### 🔴 P0 误入排位（影响真人玩家，最高优先）

- 现象：配置 `modeType=training`，但 runner 实机误入了排位（PvP 真人）。用户已手动退出。
- 线索：`coordinates.js` 的 `MODE_TRAINING` 中心 (357,259) 与 AGENTS.md 历史记录 (226,175) **不一致**；`MODE_VERSUS` 中心 (320,180) 与训练模式历史坐标 (226,175) 的 y 接近。**疑似 MODE_TRAINING 坐标偏移落到了"对战模式"行上**。
- 排查方向：导航到模式菜单截图，确认 `MODE_TRAINING` / `MODE_VERSUS` 两个坐标的真实落点；检查 `driver.js` MODE_MENU 分支（138~147 行）的 modeType 分支是否正确走训练路径。
- **修复前不要在实机开 allowBattleActions 跑全自动**（会坑真人）。

### 🟠 P1 手牌数量检测对小手牌误判（幻影牌源头）

- 现象：3 张手牌被 `detectHand` 误判为 5 张（某帧）或 4 张（另一帧）。
- 根因：`bottomHandCountBySpan` 的 envelope 校准表只覆盖 4/5/6 张（620/680/720px），3 张的 envelope（~592px）落入兜底公式 `(w-120)/120+1` 误判为 5。
- 连锁：幻影牌的 costBounds 落在真实牌暖色卡面 → `detectOrangeCostBadge` 误判橙色可出 → 费用 0 反复出牌卡死。
- 已有兜底：单卡出牌上限护栏能打断卡死循环，但识别本身未修。
- 根治方向：收集 1~4 张手牌的真实截图校准 envelope 区间；或改用"数牌峰/数费用徽章"而非 envelope 宽度。样本 fixture：`fixtures/stuck-ourturn-zerocost.png`（3 张误判 5）、`fixtures/ourturn-zero-cost-3cards.png`（3 张误判 4）。

### 🟠 P1 HQ 详情检视界面卡死

- 现象：误触我方总部卡面 → 弹出 HQ 详情大卡（背景暗化 + 左上"总部"提示框）→ runner 无法退出卡死。
- 样本：用户截图已存 `fixtures/hq-detail-inspect.png`（注意这是模拟器窗口截图 1041x598，非游戏内 1280x720，坐标需重新实测）。
- 根治方向：加 HQ 详情/卡牌检视界面的 uiRules 识别规则 + 点击卡片外部/返回键关闭逻辑。

### 🟡 P2 偶发回合识别卡死

- 现象：runner 曾卡在 OPPONENT_TURN → 90s 不活跃 → 服务器断连 → 断连弹窗死循环。
- 断连弹窗本身识别**正确**（RECONNECT，置信度 1.0），问题在触发它的"回合误判"根因未定位。
- 本轮连打多局未复现。已建立监控思路（连续卡 30s 自动截图抓现场，见 `monitor-stuck.ps1`）。
- 线索：`detectBattleTurn` 判定链 `orange>=0.02 → 白(L>=35&&E>=0.24) → 灰(S>=50判对方)`，灰色判定用饱和度 S>=50 存疑（灰色应低饱和）。

---

## 四、给下一位开发者的技术要点

### 环境

- **本轮实机用的是 `emulator-5556`**（机型 2410DPN6CC / Android 9），不是 AGENTS.md 约定的雷电 5555 + Xiaomi 15 Pro。分辨率一致（1280×720）故坐标兼容，但机型差异未覆盖验证。若换回雷电 5555，ADB 用 `127.0.0.1:5555`。
- 模拟器没装独立 Auto.js6（`org.autojs.autojs6` 不存在），只有打包出的 `com.kardsscript.comet`。可用 `RunIntentActivity` 直接跑 /sdcard 上的脚本调试：
  ```
  adb -s emulator-5556 shell am start -n com.kardsscript.comet/org.autojs.autojs.external.open.RunIntentActivity -a android.intent.action.VIEW -d file:///sdcard/AutoJs6/KardsScript/<script>.js
  ```

### 性能调试方法（重要）

- **瓶颈是 Rhino 纯 JS 循环 + pixel() JNI 调用次数**，不是单次 JNI（实测 2 万次 JNI 仅 337ms）。
- vision.js 的 `observe()` 有分段埋点（`observation.perf`），慢帧时 auto-main.js 会把 perf 写进日志，直接看哪个阶段贵。
- 探针脚本（在 `autojs/` 下，可直接 RunIntentActivity 跑，不用打包）：`pixel-probe.js`（验证批量读像素）、`vision-probe.js`（单函数计时）、`observe-probe.js`/`observe-probe2.js`（缓存/跳帧验证）、`classify-probe.js`（单次场景判定）。
- **像素采样陷阱**：`detectOrangeCostBadge` 的步长、`feature()` 的 stride 都是精细校准的，**不能为了提速改**（会把灰色费用误判橙色 / 页面分类阈值失效）。回归测试 vision-replay 会抓到。

### 打包配方（已验证，别踩坑）

见 AGENTS.md「独立 APK 打包」。关键点：inrt Gradle 不会打 .so 进 APK，必须用 `tools/add-native-libs-to-apk.py` 手动注入 `apk-native-sources/`(16) + OpenCV AAR(4) 共 20 个 .so，否则 findImage 崩。

### Git

- 仓库：`https://github.com/sutanna233/KardsScript-AutoJS.git`
- 交付约定：最新 APK 发 GitHub Release，**保留旧 Release 不删**。
- 不入库：APK、`vendor/`、`native-shell/`、`apk-native-sources/`、`apk-main.js`（生成物）、截图、AGENTS.md、CLAUDE.md。

---

## 五、下一步建议（给 codex）

1. **先修 P0 误入排位**：验证 MODE_TRAINING 坐标落点，这是最危险的（影响真人）。
2. 修 P1 手牌小手牌误判（需校准样本，可先加自动截图采样积累数据）。
3. 修 P1 HQ 详情界面识别+关闭。
4. P2 偶发回合卡死：等监控抓到现场再定位。
5. 所有改动先跑 `Get-ChildItem autojs/test -Filter *.test.js | ForEach-Object { node $_.FullName }` 确认 10 个测试全过。
