# KardsScript 项目约定

## 问题解决方法论：波利亚四步法

### 核心框架
波利亚四步法是解决复杂问题的系统性思维框架，特别适用于 KardsScript 项目的渐进式开发：

1. **理解问题（Understand the Problem）**
   - 明确目标：自动对战闭环需要哪些能力？
   - 识别约束：Auto.js6 框架限制、性能要求、准确率要求
   - 重新表述：将"实现自动化"分解为具体子问题
   - 可视化：画出系统架构图、数据流图

2. **拟定计划（Devise a Plan）**
   - **类比**：参考其他游戏自动化项目的解决方案
   - **分解**：将大问题分解为可管理的子模块（OCR、卡牌识别、状态检测）
   - **逆向**：从期望结果倒推需要的输入和处理步骤
   - **特例**：先实现最简单的情况（如只识别费用），再逐步扩展
   - **一般化**：设计可复用的视觉识别框架

3. **执行计划（Carry Out the Plan）**
   - 逐步实施：每次只改进一个模块（如先完善 OCR）
   - 验证每步：每个功能都需要在实际对局中测试
   - 调整计划：根据测试结果调整优先级和实现方案
   - 记录过程：及时更新 AGENTS.md 和项目文档

4. **回顾反思（Look Back）**
   - 检查结果：验证功能是否达到预期效果
   - 总结方法：记录成功经验和失败教训
   - 推广应用：将成功模式应用到其他类似问题
   - 寻找新问题：从当前实现中发现新的改进点

### 在 KardsScript 中的具体应用

#### 示例 1：解决费用 OCR 问题
1. **理解问题**：需要读取卡牌费用（0-12的数字），位于卡牌左上角
2. **拟定计划**：利用 Auto.js6 内置 OCR，定义费用区域，添加验证逻辑
3. **执行计划**：扩展 `ocrNumber()` 函数，添加费用区域定义，测试准确率
4. **回顾反思**：评估 OCR 在不同分辨率下的表现，优化采样区域

#### 示例 2：解决"手牌识别"问题
1. **理解问题**：只知道手牌数量，不知道具体卡牌
2. **拟定计划**：基于已校准的卡牌图标模板和卡库元数据识别卡牌类型
3. **执行计划**：实现颜色特征提取，建立卡牌特征数据库
4. **回顾反思**：测试识别准确率，优化特征提取算法

#### 示例 3：解决"决策树优化"问题
1. **理解问题**：当前决策树条件失效（credits/canLethal）
2. **拟定计划**：实现基于费用的出牌策略，添加威胁评估
3. **执行计划**：更新决策树条件字段，优化排序算法
4. **回顾反思**：测试不同策略的效果，调整参数

### 使用指南
- **遇到新问题时**：先按四步法分析，再动手实现
- **代码审查时**：用四步法回顾实现是否合理
- **遇到瓶颈时**：回到第一步重新理解问题
- **功能完成后**：用第四步总结经验教训

### 优势
- **系统性**：避免盲目尝试，提高开发效率
- **可验证**：每个阶段都有明确的验证标准
- **可扩展**：新功能可以逐步添加，不影响现有系统
- **可复用**：解决模式可以应用到其他类似项目

## 项目概述
Android 端 KARDS（二战卡牌游戏）自动对战挂机工具。基于 **Auto.js6** 运行，不依赖无障碍服务。
目标：自动启动/匹配/换牌/对局/结算/再匹配/异常恢复，用户可编辑 AI 决策树。

## 技术架构
- **框架：Auto.js6**（JS 脚本运行时，运行在 AutoJS App 中）
- 截图：`requestScreenCapture()` + `captureScreen()`
- 视觉：像素采样（亮度/饱和度/边缘密度）+ 模板匹配（`images.findImage`）
- 决策：JSON 决策树 DSL（priority/condition/action 节点，不执行任意代码）
- 输入：`shell("input touchscreen tap x y")`（普通 `input tap` 对 Unreal 引擎无效）
- **项目唯一维护工程：`autojs/`**；已删除 Kotlin 原生工程，不再运行 Gradle/Android Studio 构建。

## 当前环境
- 工作目录：`J:\dev\KardsScript`
- AutoJS 项目目录：`J:\dev\KardsScript\autojs\`
- 运行方式：在雷电模拟器安装 Auto.js6，导入 `autojs/` 目录，运行 `main.js`
- 雷电模拟器 ADB：`127.0.0.1:5555`
- KARDS 包名：`com.android1939.kardsapk`
- 模拟器分辨率：1280x720（横屏，游戏内）

## 输入方法（重要！）
- `input tap` ❌ 对 KARDS 无效（Unreal 引擎）
- `input swipe` ⚠️ 部分有效（卡组详情面板）
- **`input touchscreen tap` ✅ 有效**（模式选择、卡组选择、按钮点击）
- `input swipe 短距离` ✅ 有效（打开卡组详情）

## 项目结构
```
KardsScript/
├── autojs/                  # 主工程（AutoJS 脚本）
│   ├── main.js              # 入口：截图循环 750ms/帧
│   ├── lib/
│   │   ├── config.js        # 核心配置（坐标、槽位、阈值、区域）
│   │   ├── domain.js        # 领域模型（Scene/Screen/Action 枚举）
│   │   ├── coordinates.js   # 固定坐标常量（1280x720）
│   │   ├── vision.js        # 视觉引擎（像素采样→场景分类→手牌→单位→合法目标）
│   │   ├── decision.js      # 决策树引擎（JSON DSL 解析+校验+执行）
│   │   ├── strategy.js      # 策略层（卡牌/单位选择→目标排序→守卫优先）
│   │   ├── driver.js        # 输入驱动（input touchscreen tap）
│   │   └── runtime.js       # 状态机（场景流转→动作执行→失败处理）
│   ├── strategy/             # 用户可编辑的决策树 JSON
│   ├── test/                 # 离线测试（vision/decision/runtime）
│   ├── tools/                # 离线调试工具
│   └── templates/            # 模板匹配图片（结束回合按钮、换牌确认等）
├── fixtures/                 # 测试截图和坐标数据
│   └── ref/                  # 坐标参考文件
└── docs/                     # 文档
```

## 视觉识别方案
三层流水线，纯规则+像素分析，不训练模型：

### ① 页面分类（KardsUiScreenClassifier）
- 对每个锚点区域采样亮度(L)/饱和度(S)/边缘密度(E)
- 匹配 `uiRules` 中的锚点阈值规则，优先级最高的命中即为当前页面
- 识别：HOME / MODE_MENU / DECK_LIST / DECK_DETAIL / BATTLE / MULLIGAN / RESULT 等

### ② 场景分类（SceneClassifier + 模板匹配）
- `detectBattleTurn()`：模板匹配结束回合按钮颜色，判断 OUR_TURN / OPPONENT_TURN
- `detectResultScreen()`：模板匹配结算按钮
- `detectMulliganScreen()`：模板匹配换牌标题
- 底部 UI 区域亮度辅助判断：亮≥35 = 我方回合，灰 20-35 = 对方回合

### ③ 手牌检测（HandCardDetector）
- 两种布局：middle（y=460，旧版）/ bottom（y=650，新版底部扇形）
- 逐个校准位置采样亮度+暖色调（R-B），唯一匹配确认手牌数量
- 返回卡牌包围盒，不识别卡牌内容

### ④ 合法目标探测
- 部署不等待格子视觉变化：使用已确认费用、来源框和己方自由区域，拖动后用结果变化确认。
- 攻击按真实交互先点击己方单位，再拖动到当前识别出的敌方单位或 HQ；不把不存在的视觉提示当作前置条件。
- Guard 检测：只在敌方单位区域内匹配护盾图标。

### 当前识别限制
- 费用 OCR 已接入并有多数一致校验，但攻防、总部血量和卡名尚未稳定识别。
- 尚未完成完整卡牌识别，出牌仍不能依赖卡名和完整卡牌属性。
- 7–9 张底部扇形手牌的动态坐标仍需真实截图继续校准。
- 单位是否可操作仍需独立实机验证，不能仅凭单位存在就发起攻击。

## 决策树 DSL
- JSON Schema 约束的声明式 DSL，禁止执行任意代码
- 节点类型：priority（优先选择）/ condition（条件判断）/ sequence（序列）/ action（动作）
- 动作类型：PLAY_CARD / OPERATE_UNIT / MOVE_TO_FRONTLINE / ATTACK / END_TURN
- 目标安全语义：除 END_TURN 外必须 `legalOnly: true`，只点击视觉层确认的合法目标
- 条件字段：scene / credits / handCount / hasPlayableCard / hasOperableUnit / hasLegalTarget / canLethal / enemyUnitCount / playerUnitCount / frontlineControlled / confidence
- 排序器：USER_PRIORITY_DESC / DEPLOYMENT_COST_DESC / ATTACK_DESC / THREAT_DESC / ENEMY_HQ_FIRST 等
- 默认策略：出牌 → 操作单位 → 结束回合

## 已测量的 KARDS 坐标（1280x720 横屏）
坐标定义在 `autojs/lib/coordinates.js` 和 `autojs/lib/config.js` 的 `targetSlots` 中。

### 固定坐标
| 元素 | 坐标 (x,y) |
|------|------------|
| 开始按钮 | [54,161,102,201] → 点击中心 (78,181) |
| 训练模式 | [187,156,266,194] → 点击中心 (226,175) |
| 默认卡组 | [117,156,281,361] → 点击中心 (199,258) |
| 卡组确认 | [812,403,890,444] → 点击中心 (851,424) |
| 换牌确认 | [421,418,577,482] → 点击中心 (499,450) |
| 结束回合 | [1055,488,1242,544] → 点击中心约 (1148,516) |
| 结算继续 | [421,438,577,490] → 点击中心 (499,464) |
| 重连按钮 | [382,278,616,327] → 点击中心 (499,302) |
| 弹窗关闭 | [718,56,764,97] → 点击中心 (741,76) |

### 战场槽位（config.js targetSlots）
| 槽位 | 归一化 bounds |
|------|--------------|
| 敌方总部 | [0.40, 0.10, 0.60, 0.40] |
| 我方总部 | [0.40, 0.60, 0.60, 0.90] |
| 结束回合 | [0.82, 0.67, 0.98, 0.77] |
| 敌方后排 | left/mid/right × [0.18-0.34] |
| 敌方前排 | left/mid/right × [0.34-0.48] |
| 我方前排 | left/mid/right × [0.50-0.64] |
| 我方后排 | left/mid/right × [0.64-0.78] |

### 手牌位置（1280x720，采样点）
| 手牌数 | 最左侧 x |
|--------|----------|
| 1 张 | 640 |
| 2 张 | 587 |
| 3 张 | 535 |
| 4 张 | 482 |
| 5 张 | 430 |
| 6 张 | 377 |
| 7 张 | 325 |
| 8 张 | 272 |
| 9 张 | 220 |

## 当前问题
1. 7–9 张扇形手牌的费用区域和拖拽来源框仍需独立实机验证；现有数量探针已覆盖 7–9 张回放样本。
2. 卡牌全文识别、攻防/总部血量 OCR 尚未达到可用于策略决策的稳定性。
3. 单位可操作状态和完整攻击动作尚未完成独立实机验证；中心列已避开总部/分界线误报。
4. 模板必须按页面和当前 UI 版本维护，旧版模板不得直接用于自动点击。
5. 完整对局闭环、结算后再匹配和异常恢复仍未宣称通过。

## 离线回放与实机校准工具
### 新增工具（纯 Node，Windows 上可直接 node 运行）
- `autojs/tools/png-decode.js`：纯 Node PNG 解码器（内置 zlib，无需 Auto.js images 模块），返回模拟 ImageWrapper
- `autojs/tools/offline-fixture-vision.js`：加载 fixtures 真实截图跑完整 vision 观察（页面/场景/手牌/单位/目标）
- `autojs/tools/diagnose-screen-rules.js`：输出所有锚点区域特征 + 逐规则匹配判定，用于校准 uiRules 阈值
- `autojs/tools/debug-card-type.js`：调测卡牌类型识别阈值

### 校准结论（重要！）
1. **结束回合按钮实测坐标**：当前实机版本真实按钮位于屏幕右侧中部 `[0.82, 0.67]-[0.98, 0.77]`（像素约 1055-1242 x 488-544）。`config.endTurnUi`、`targetSlots.end-turn`、`coordinates.END_TURN` 和 `vision.findTemplate` 搜索区均以此为准；旧版右下记录仅保留作历史参考
2. **battle 规则阈值校准**：rightPanel minS 110→60、endTurnUi minS 80→40（不同地图 S 差异大，旧阈值过苛刻）；mulligan 规则 topUi maxL 28→50、rightPanel maxL 30→52、endTurnUi maxL 45→58
3. **fixtures 文件名不可靠**（audit-our-turn/audit-opponent-turn 内容与命名可能相反），不能当 ground truth；判断回合以按钮实际颜色为准
4. **Node 环境限制**：Auto.js 的 images.read()/ocr()/findImage 在纯 Node 不可用，模板匹配与 OCR 只能在模拟器里的 AutoJS 环境验证

### 单测清单（node autojs/test/*.test.js 全部通过）
- ocr.test.js / vision-replay.test.js / decision-replay.test.js / runtime-replay.test.js / card-recognition.test.js / template-match.test.js

### 模板匹配（找图匹配）结论
1. **Node 版模板匹配**：`autojs/tools/node-match.js`（导出 matchTemplate），纯像素 NMSE + 三级金字塔扫描，离线验证 Auto.js `images.findImage` 逻辑。已修复"找最大 MSE"的 bug（原版会锁到最差位置）。
2. `templates/buttons/` 作为页面专用模板库使用；模板命中必须同时满足页面分类和限定搜索区域。
3. **模板匹配不是全局安全操作**：跨页面会误匹配相似 UI，必须先判页面、再用对应模板集。
4. 结束回合模板已按新版右侧中部区域重裁，旧版模板仅保留为 `-legacy` 参考。

## AutoJS 环境接入（已验证）
### AutoJS6 运行方式（关键）
- 模拟器已装 `org.autojs.autojs6`，项目目录 `/sdcard/AutoJs6/KardsScript/`
- **可靠运行方式**：`adb shell am start -n org.autojs.autojs6/org.autojs.autojs.external.open.RunIntentActivity -a android.intent.action.VIEW -d file:///sdcard/AutoJs6/KardsScript/<脚本>.js`
- 必须**直接指定组件**，否则系统弹 ResolverActivity 选择器（点不准）
- **关键坑**：AutoJS 启动脚本会抢占前台 → 脚本开头必须 `app.launchPackage("com.android1939.kardsapk")` 把 KARDS 拉回前台，否则 captureScreen 截到桌面/菜单
- **结果读取**：logcat 里 AutoJS 的 GlobalConsole 不一定可靠，脚本应把结果 `files.write/append` 到 `/sdcard/AutoJs6/KardsScript/xxx.jsonl`，Windows 端用 `adb shell cat` 读

### AutoJS API 差异（陷阱）
- `images` 模块**没有 exists()**：`images.exists(path)` 报错"无法找到函数 exists"。判断模板文件用 `files.exists(path)`
- `images.findImage` 的 region 宽高**必须能容纳模板**，否则报"宽度超限: 模板图像[W]>限定区域[X]"
- `images.clip`/`images.read` 会转移 bitmap 所有权；模板 `recycle()`

### 已验证可用的 AutoJS 环境脚本（autojs/ 下）
- `smoke.js`：截图+vision观察+findImage模板匹配冒烟，结果写 smoke-result.json
- `autodrive.js`：模板匹配定位按钮 + input touchscreen tap 导航，结果写 autodrive-log.jsonl
- `battle-drive.js`：持续循环截屏识别+找结束回合按钮+点击，结果写 battle-drive-log.jsonl

### 已验证结论
1. ✅ AutoJS 可运行脚本、获取截图权限、vision.observe 正常运行、images.findImage 模板匹配工作、input touchscreen tap 驱动有效、KARDS 可拉回前台
2. ✅ 动态循环驱动（battle-drive 每帧识别）正常，日志可靠
3. ✅ 导航状态机已从训练卡组列表进入卡组详情，再进入 MULLIGAN → BATTLE/OUR_TURN；该专项测试保持 `allowBattleActions=false`。
4. ✅ 局部费用 OCR、多数一致校验和浮层关闭保护已通过实机回放验证。
5. ⚠️ 服务器不活跃断开仍可能中断测试；遇到重连弹窗必须按异常页面处理，不得继续执行战斗动作。

### 当前实机状态
1. 导航状态机已通过训练模式卡组列表 → 卡组详情 → MULLIGAN → BATTLE/OUR_TURN 的实机专项测试。
2. 服务器不活跃断开仍是外部测试风险；出现重连弹窗时必须先恢复连接并重新识别页面。
3. 模式菜单和导航模板必须使用当前 UI 的页面限定识别，不得回退到历史全屏误匹配方案。

4. “由于不活跃，您已断开连接”弹窗已加入 `RECONNECT` 页面规则，必须先点击重新连接，再继续 HOME/模式导航；不得把该弹窗当作 HOME。
5. Auto.js 动作探针与正式运行均要求至少两帧扇形手牌稳定，禁止用单帧数量直接结束回合或拖牌。

## 当前待验证
1. 7–9 张扇形手牌的独立坐标与费用区域校准。
2. 已确认费用卡牌的安全拖牌、部署格判定和单次出牌闭环。
3. 单位可操作状态、前线/守护优先攻击和结束回合动作。
4. 结算、再匹配以及网络断开后的异常恢复。

- 项目唯一维护工程为 `autojs/`；不再运行 Gradle/Android Studio 构建。
- 位置：`C:\Users\User\.agents\skills\image-grid-locate\`
- 用途：通过叠加带编号坐标网格读取截图中元素位置
- 配套脚本：`scripts/grid_overlay.py`
- 换算：`--convert G7 --fx/--fy` 出坐标、`--convert G6:H7` 出包围盒

## 实机环境记录

- 雷电模拟器 ADB 为 `127.0.0.1:5555`，分辨率为 `1280x720`；ADB 命令必须显式指定该设备。
- `autojs/` 已同步至 `/sdcard/AutoJs6/KardsScript/autojs/`，可通过 `RunIntentActivity` 启动 Auto.js6 脚本。
- `smoke.js` 已验证截图、页面/回合识别、模板匹配和 JSONL 日志链路；战斗动作专项测试仍需单独开启。

## 2026-08-20 实机续测更新

以下结论以 `docs/hardware-test-report-2026-08-20.md` 和模拟器 JSONL 日志为准：

### 已实测通过

- 导航状态机已从训练卡组列表进入卡组详情，再进入 MULLIGAN → BATTLE/OUR_TURN；导航测试使用 `allowBattleActions=false`，不执行战斗动作。
- 训练模式选中状态通过模式菜单训练行的橙色像素比例判断；不要在模式菜单中对旧训练模板做全屏搜索。
- 导航点击必须等待页面变化；同一页面最多等待 7 秒，超时后停止，不得每帧重复点击。
- Auto.js6 局部 OCR 可读取费用徽章。费用值必须经过多数一致校验；`81`、`31` 等粘连 OCR 结果不得解释成 `8`、`3`。
- 运行时 `toast()` 和逐帧 `console.log()` 会遮挡底部手牌并破坏 OCR；自动运行时必须关闭这类浮层输出，诊断结果写入 JSONL。
- 费用未确认、手牌布局未确认或卡牌数量探针冲突时：不得拖牌，也不得把空手牌当成可结束回合的依据。

### 当前实机限制

- 底部扇形手牌按左侧采样点表支持动态间距；6 张布局已能从实机帧识别。7–9 张仍需继续用真实截图校准卡费区域和拖拽来源框。
- OCR 读到费用不等于卡牌来源坐标已确认；只有费用、手牌数量、来源框三者都确认时才允许 `PLAY_CARD`。
- 导航通过不等于完整对局通过。自动出牌、攻击、守护单位优先级、结算再匹配仍需独立实机验证。
- 默认配置继续保持 `mode: "observe"`、`allowNavigation: false`、`allowBattleActions: false`，除非进行有界、可回滚的专项测试。

### 两日交付边界

优先完成训练模式 MVP：进入对局、换牌、已确认费用的安全出牌、结束回合和基础攻击；完整卡牌识别、复杂策略和所有异常恢复不作为已完成项，除非有对应实机证据。

## 当前具体技术路线（以此为准）

### 1. 运行与输入层

- 唯一运行框架是 Auto.js6，入口为 `autojs/main.js`，运行在雷电模拟器中的 KARDS 客户端上。
- 每帧通过 `requestScreenCapture()` / `captureScreen()` 获取 1280×720 横屏截图；默认循环间隔约 750 ms。
- KARDS Unreal 引擎使用 `shell("input touchscreen tap x y")` 执行点击；卡组详情等需要拖动的场景使用短距离 `input swipe`。不使用普通 `input tap` 作为主路径。
- 自动动作必须经过运行时开关控制：`mode`、`allowNavigation`、`allowBattleActions` 任一未开启时只识别或只导航，不得误触战斗。

### 2. 页面识别层

1. 先用 `KardsUiScreenClassifier` 对页面锚点采样亮度、饱和度和边缘密度，粗分 HOME、MODE_MENU、DECK_LIST、DECK_DETAIL、MULLIGAN、BATTLE、RESULT 等页面。
2. 页面确定后，只在该页面的限定区域搜索对应模板；禁止跨页面全屏搜索，避免把战场元素误判为菜单按钮。
3. 模板匹配使用 `images.findImage`。模板必须与当前 UI 版本、分辨率和布局一致；旧布局模板只能标记为 legacy，不得直接用于点击。
4. 每次点击后等待页面状态发生变化，单页面等待上限 7 秒；超时立即记录失败并停止重复点击。

### 3. 导航状态机

导航严格按 `HOME → MODE_MENU → DECK_LIST → DECK_DETAIL → MULLIGAN → BATTLE` 顺序推进：

- HOME：定位并点击开始。
- MODE_MENU：用训练行橙色选中像素比例判断训练模式，不依赖旧训练模板；必要时只点击当前页面内的训练行或确认按钮。
- DECK_LIST：默认选择第一个卡组。
- DECK_DETAIL：确认卡组后进入换牌页。
- MULLIGAN：识别换牌确认按钮并点击一次，等待进入战场。
- BATTLE：导航状态机只负责确认已进入对局；战斗动作由独立的 battle-action 开关控制。
- 任意阶段遇到重连、弹窗或结果页，先处理当前异常页面，再回到状态机，不允许直接套用下一页坐标。

### 4. 战场与回合识别层

- 通过结束回合按钮模板及其颜色/亮度判断 OUR_TURN 与 OPPONENT_TURN；以当前新版按钮区域为准，不使用旧版 y≈337 坐标。
- 通过战场槽位的归一化区域识别敌我总部、敌我前排/后排单位，并从当前画面生成敌方可拖动目标。
- 守护图标只在敌方槽位内检测；先按敌方/我方区域分区，再做模板匹配，避免把友方守护单位识别成敌方目标。
- “前线优先、前线守护优先、无守护再攻击总部”属于目标排序规则；目标必须先被当前画面识别且处于敌方区域。

### 5. 手牌与费用识别层

- 先估计扇形手牌数量，再根据数量选择对应的左侧采样点和动态间距；6 张布局已有实机校准，7–9 张仍需真实截图继续校准。
- 对每张手牌的费用徽章做局部 OCR；同一费用至少跨多帧多数一致后才算确认。
- OCR 返回 `81`、`31` 等粘连结果时视为不可信，不得拆成单数字费用。
- “费用已确认”不代表“拖拽来源已确认”。只有手牌数量、费用、来源框三项同时满足置信度阈值，才允许执行 `PLAY_CARD`。
- 自动运行期间关闭 `toast()` 和逐帧 `console.log()`，避免浮层遮挡手牌；诊断信息写入 JSONL 文件。

### 6. 决策与动作执行层

决策使用 `autojs/strategy/*.json` 中的声明式 DSL，不在运行时执行任意脚本：

1. OUR_TURN 且存在已确认可出的牌：按费用/用户优先级选择一张，拖到已确认的合法部署格。
2. 没有安全出牌时，检查已确认可操作的己方单位；按“敌方前线守护 → 敌方后排守护 → 敌方前线 → 敌方总部”排序攻击目标。
3. 没有可执行动作，才点击结束回合。
4. 任一识别结果不确定、敌方目标或来源框未确认，执行安全停机并记录原因，不能退化成盲点坐标或无脑跳过回合。

### 7. 验证与交付顺序

- 离线：使用 `autojs/test/*.test.js` 和 `autojs/tools/*` 回放真实截图，验证页面、回合、手牌、模板和决策结果。
- 实机：先跑 `smoke.js` / 观察模式确认截图和识别，再单独打开导航，最后才打开出牌/攻击动作；每一步都保留 JSONL 日志和可回滚开关。
- 两日内按“导航闭环 → 换牌 → 安全出牌 → 结束回合 → 基础攻击”顺序交付；卡牌全文识别、复杂策略和完整异常恢复必须以新的实机证据为完成标准。

## 2026-08-21 规则与卡牌数据更新

- 2026-08-22 实机复核：右侧“结束回合”按钮呈橙色只能证明当前是我方回合且按钮可点，不能证明“已无其他操作”。当画面中仍有可行动己方单位时，必须先执行单位操作，不得因按钮橙色强制 `END_TURN`。
- 可行动己方单位的实机标志是左上角移动费用数字变为橙色；灰色数字表示本回合不可移动/攻击。不存在稳定的绿色行动框，不能将绿色边框作为必要条件。
- 单位行动状态以运行时回合账本为主：新部署单位本回合锁定，成功移动/攻击的单位本回合锁定，进入下一己方回合再清除。颜色识别只作视觉辅助，不能单独证明“已行动”。
- KARDS 没有固定部署槽位，也没有部署高亮。出牌应将手牌拖到己方自由部署区域；配置中的 `deploymentSlots` 只是已测量的候选落点，运行时必须按当前己方单位占位动态选择，并用结果变化确认。
- 完整卡牌数据库来源为外部工程 `J:\dev\测试\233\kards-agent\cards\kards_api_cards.json`，已复制到 `autojs/data/carddb.json`，运行时通过 `autojs/lib/carddb.js` 按卡牌 ID、中文名或英文名查询。
- `autojs/data/carddb-curated.json` 是精选资料备份，不是运行时数据源，不得用于卡牌识别或策略决策。
- 卡图模板位于 `autojs/templates/cards/`，当前为 99 张本地 PNG；模板识别接入前不得宣称已经完成完整卡牌识别。数据库字段可以查询，但截图到卡牌 ID 的匹配仍需单独验证。
- 卡牌费用 OCR 已可用于费用可负担判断；卡名、类型、国家、稀有度、攻防和效果只有在模板/卡名匹配成功后才能从数据库取得，失败必须保持 `UNKNOWN`。

## 2026-08-23 资产盘点与新功能开发

- **完整资产清单**：`docs/assets-inventory.md`，涵盖 85 张按钮模板（含 manifest 裁剪坐标）、99 张卡图、21 张单位类型模板/mask、3 个数据文件、11 个 lib 模块、8 个测试、71 个工具、12 个文档。开发新功能前先查清单复用现有模板，禁止重复裁剪。
- **独立 APK 已验收**：`CometAssistant-v1.0.0.apk` 通过六项验收（详见 `docs/standalone-apk-acceptance-2026-08-23.md`），完整对局闭环日志在 `docs/standalone-apk-full-game-2026-08-23.jsonl`。
- **对战模式（PvP）路径**：休闲/排位不是模式菜单独立行。路径为：对战模式行（模板 `mode-battle-selected/unselected`，manifest 坐标 x=255,y=155）→ 卡组详情页右侧"排位/休闲"切换（模板 `deck-ranked(-selected)`/`deck-casual-(un)selected`，x=922/1078,y=510）→ 开始按钮（模板 `deck-start`，x=920,y=565）。运行时必须先用模板判断当前选中状态再决定是否切换。
- **新增配置**：`config.modeType`（training/casual/ranked，默认 training）、节奏参数 `cardPlayPaceMs`/`unitActionPaceMs`/`endTurnPaceMs`/`navPaceMs`；`user-strategy.js` 中 SAFE/PACE_MIN/PACE_MAX 保证安全项不可被用户关闭。
- **APK 打包红线**：Auto.js6 6.7.0 内置 ApkBuilder 资源索引损坏（abc_vector_test），禁用；正式打包用 `vendor/AutoJs6` Gradle inrt 变体 + `tools/add-native-libs-to-apk.py` 注入 termexec/OpenCV/libc++ 共 16 个 .so + zipalign + apksigner。


## 2026-08-24 续测记录
- 用户确认每日任务弹窗关闭方式为点击弹窗外空白区域，不是“拒绝任务”按钮。
- 恢复已实机验证的右下空白坐标 `DAILY_QUEST_DISMISS: [1050/1280, 600/720, 1190/1280, 690/720]`；启动恢复逻辑不得在 UNKNOWN 页面盲点该坐标。
- 2026-08-24 实机截图显示每日任务规则原阈值 `menuCenter minL:90` 过高（实测 L=83.3），已降至 80；右下空白关闭坐标保持原值。该规则必须先识别 DAILY_QUEST，再由 driver 点击弹窗外空白。
