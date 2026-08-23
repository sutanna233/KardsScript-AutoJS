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
- `autojs/lib/driver.js`：唯一输入驱动入口。
- `autojs/lib/runtime.js`：场景状态机、动作握手和失败恢复。
- `autojs/strategy/`：用户可编辑策略；`autojs/templates/`：页面专用模板。

## 当前已知限制

- 项目仍在开发中，存在未知 Bug；脚本可能卡住、停止运行或需要手动恢复，不保证稳定挂机。
- 费用 OCR、7–9 张扇形手牌坐标、完整卡牌识别、攻防/总部血量 OCR 仍有限制。
- 单位可操作状态、自动攻击、结算后再匹配和全部异常恢复仍需更多独立实机证据。
- 模板必须匹配当前 UI 版本；历史模板不得直接用于自动点击。
- 分辨率不为 1280×720 时，不得假设现有坐标和模板仍安全。

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
