# KardsScript 资产清单（2026-08-23）

本文档盘点项目全部已有资产，供后续开发直接复用，避免重复裁剪模板或重造工具。

## 1. 按钮/UI 模板（autojs/templates/buttons/，85 张 PNG）

模板裁剪记录见同目录 `manifest.json`（含每张模板的来源截图与像素坐标）。运行时**必须页面限定**使用，禁止跨页面全屏搜索。

### 主页（HOME）
| 模板 | 用途 |
|------|------|
| home-start.png | 开始按钮 |
| home-cards.png / home-shop.png | 左侧卡牌/商店导航 |
| home-arena-shortcut.png / home-open-packs.png / home-missions.png / home-reserve-box.png | 主页快捷入口 |
| start-button.png | 开始按钮（另一版本） |

### 模式菜单（MODE_MENU）
| 模板 | 用途 |
|------|------|
| mode-battle-selected.png / mode-battle-unselected.png | **对战模式行**（PvP 入口，选中/未选中） |
| mode-training-selected.png / mode-training-unselected.png | 训练模式行 |
| mode-arena.png / mode-arena-selected.png | 竞技场行 |
| mode-campaign.png / mode-campaign-selected.png | 战役模式行 |
| mode-battle-code.png / mode-battle-code-selected.png | 战斗代码行 |
| mode-events.png / mode-events-locked.png | 赛事模式行 |
| （根目录）mode-training-1280x720.png 等 3 张 | 训练模式整行模板（旧版） |

### 卡组详情（DECK_DETAIL）
| 模板 | 用途 |
|------|------|
| **deck-ranked.png / deck-ranked-selected.png** | 排位切换（未选中/选中） |
| **deck-casual-selected.png / deck-casual-unselected.png** | 休闲切换（选中/未选中） |
| **deck-start.png** | 对战卡组开始按钮 |
| deck-card-back.png / deck-table-decoration.png / deck-headquarters.png / deck-emotes.png | 卡组装饰选项卡 |
| deck-edit.png / deck-delete.png / deck-copy.png / deck-favorite.png | 卡组管理按钮 |
| training-deck-1/2/3.png | 训练卡组三选一 |
| arena-enter.png | 竞技场进入按钮 |
| campaign-battle-zone.png / campaign-newbie.png | 战役关卡 |

### 战斗（BATTLE）
| 模板 | 用途 |
|------|------|
| **battle-turn-ours-current.png** | 我方回合结束按钮（当前版，右侧中部） |
| battle-turn-ours-white.png | 白色结束回合变体 |
| battle-turn-opponent.png | 对方回合按钮 |
| battle-turn-ours-legacy.png / battle-turn-opponent-legacy.png / battle-turn-ours-pre-right-middle.png / battle-turn-ours.png | 旧版/历史参考，**不得直接用于点击** |
| battle-menu.png / battle-settings-current.png / battle-surrender-current.png | 战斗内菜单/设置/投降 |
| guard-marker.png / guard-marker-enemy.png | 守护图标（我方小版/敌方大版） |

### 换牌与结算（MULLIGAN / RESULT）
| 模板 | 用途 |
|------|------|
| mulligan-header.png / mulligan-confirm.png / mulligan-replace-marker.png | 换牌页标题/确认/标记 |
| result-continue-current.png / result-leave-battle-current.png / result-view-battle-current.png / result-next-reward.png | 结算页按钮（当前版） |

### 弹窗与其他页面
| 模板 | 用途 |
|------|------|
| popup-close-promo-current.png | 促销弹窗关闭 X |
| mission-decline-1/2/3.png | 每日任务拒绝按钮 |
| settings-*.png（7 张） | 设置页各选项卡 |
| collection-*.png（5 张） | 收藏页 |
| empty-packs-back.png / empty-packs-shop.png | 卡包空页 |
| cards-nav-left.png / shop-nav-left.png | 左侧导航 |

## 2. 卡图模板（autojs/templates/cards/，99 张）

按国家分组的卡牌卡图 PNG：德国 kGermany-1~22、苏联 kSoviet-23~40、美国 kUSA-41~60、英国 kBritain-61~82、日本 kJapan-83~100。
**注意**：模板识别接入前不得宣称完成卡牌识别；截图→卡牌 ID 匹配未单独验证。

## 3. 单位类型模板（autojs/templates/types/）

- 根目录 7 张：`infantry.png`、`tank.png`、`artillery.png`、`fighter.png`、`bomber.png`、`infantry-rear.png`、`tank-rear.png`
- `masks/` 7 张：对应二值轮廓 mask
- `masks-inner/` 7 张：去边框内圈 mask（对闪卡动画不变，是生产路径）

实测校准阈值在 `config.js`（typeMaskThreshold 0.62 等）。

## 4. 数据文件（autojs/data/）

| 文件 | 说明 |
|------|------|
| carddb.json（656 KB） | **运行时卡牌数据库**，来自外部工程，按 ID/中文名/英文名查询 |
| card-index.json | 卡牌索引 |
| carddb-curated.json | 精选备份，**不是运行时数据源**，不得用于识别/决策 |

## 5. 核心库（autojs/lib/，11 个模块）

| 模块 | 职责 |
|------|------|
| config.js | 全部配置（坐标、阈值、uiRules、targetSlots、节奏参数） |
| coordinates.js | 固定坐标常量（含 MODE_VERSUS / RANKED_TOGGLE / CASUAL_TOGGLE / DECK_START_PVP） |
| domain.js | Scene/Screen/Action 枚举与几何工具 |
| vision.js | 视觉引擎（页面分类→场景分类→手牌→单位→目标） |
| driver.js | 唯一触控入口（input touchscreen tap/swipe） |
| runtime.js | 状态机（页面流转→动作执行→失败处理） |
| strategy.js | 策略层（卡牌/单位选择→目标排序） |
| decision.js | 决策树 DSL 解析/校验/执行 |
| user-strategy.js | 用户策略读写/校验/编译为 DSL |
| carddb.js | 卡牌数据库查询 |
| floating-controller.js | 悬浮急停按钮（inrt 环境自动降级为空操作） |

## 6. 入口脚本（autojs/ 根目录）

| 脚本 | 用途 |
|------|------|
| main.js | 观察模式入口（mode=observe） |
| auto-main.js | 自动对战入口（mode=automatic，一局可审计） |
| launcher.js | 策略配置 GUI（"彗星助手"控制台） |
| apk-main.js | 打包入口（bundle 产物，launcher+runner 内联） |
| smoke.js / autodrive.js / battle-drive.js | 实机验证脚本（截图/导航/战斗） |
| difftest.js / presstest.js | 调试工具 |

## 7. 测试（autojs/test/，8 个，全部 node 直跑）

ocr / vision-replay / decision-replay / runtime-replay / card-recognition / template-match / carddb / user-strategy。

运行：`Get-ChildItem autojs/test -Filter *.test.js | ForEach-Object { node $_.FullName }`

## 8. 工具（autojs/tools/，71 个）

- **打包**：build-standalone-apk.js / bundle-standalone-apk.js / prepare-apk-entry.js / sync-device.ps1
- **离线回放**：png-decode.js / offline-fixture-vision.js / diagnose-screen-rules.js / node-match.js（NMSE 模板匹配，修过"找最大 MSE"bug）
- **OCR 探针**：offline-fee-ocr-test.js / ocr-fixtures-batch.js / live-ocr-debug.js 等
- **战斗探针**：one-attack-test.js / play-when-our-turn-test.js / frontline-move-live-test.js / unit-action-live-probe.js 等
- **项目根 tools/**：add-native-libs-to-apk.py（多 AAR/裸 .so 注入 APK）

## 9. 文档（docs/，12 个）

- standalone-apk-acceptance-2026-08-23.md — **最新验收记录（六条件全过）**
- standalone-apk-handoff-2026-08-22.md — 独立 APK 交接
- hardware-test-report-2026-08-20.md — 实机测试报告（弹窗/重连/导航结论）
- project-overview.md — 项目架构总览
- decision-tree-dsl.md / vision-and-targeting.md / autojs-migration.md / card-appearance-calibration.md / three-games-run-record-2026-08-22.md
- 实机日志 JSONL ×3

## 10. 其他

- `fixtures/ref/`：坐标参考（kards-coordinates.json、hand-positions-all.json、导出/校验 PS 脚本）
- `schemas/decision-tree.schema.json`：决策树 JSON Schema
- `autojs/assets/comet-assistant-icon.png`：应用图标
- `native-shell/`：Gradle 壳工程（已弃用方案，仅保留参考）
- `vendor/AutoJs6/`：AutoJs6 6.7.0 定制构建工程（**不入 Git**）

## 关键红线（复用资产时必读）

1. 模板必须**页面限定**使用：跨页面 findImage 会误匹配相似 UI。
2. 旧版模板（*-legacy、pre-right-middle）仅作历史参考，不得用于点击。
3. 点击/拖拽唯一入口是 `driver.js`，禁止脚本里直接调 input。
4. 页面置信度不足、KARDS 不在前台、无视觉确认目标时不得操作。
5. `carddb-curated.json` 不是运行时数据源。
