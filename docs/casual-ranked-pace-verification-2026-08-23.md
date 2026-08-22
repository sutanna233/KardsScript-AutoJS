# 休闲/排位模式与节奏参数实机验证记录（2026-08-23）

## 验证环境

- 设备：雷电模拟器 127.0.0.1:5555，1280x720 横屏
- 运行方式：Auto.js6 直接运行 `auto-main.js`（非打包 APK）
- 策略文件：`/sdcard/KardsScript/user-strategy.json`

## 验证结果

### 1. 休闲模式（casual）✅

**测试配置**：
```json
{
  "modeType": "casual",
  "cardPlayPaceMs": 600,
  "unitActionPaceMs": 500,
  "endTurnPaceMs": 800,
  "navPaceMs": 1200
}
```

**日志证据**（`docs/standalone-apk-real-test-2026-08-23.jsonl` 对应运行 `games-1787416793046.jsonl`）：

| 时间(ms) | 事件 |
|----------|------|
| 408 | 识别 DECK_DETAIL，confidence=1 |
| 421 | 检测当前为"排位"选中，切换至"休闲"：`已切换至休闲模式` |
| 1806 | 点击开始：`已点击对战开始按钮` |
| 5265-6645 | 启动恢复：检测到弹窗，依次尝试关闭促销/每日任务/通用弹窗 |
| 27000 | RESULT 页面（上局残留），忽略 |
| 28308 | MULLIGAN 换牌页，确认进入 |
| 41869 | BATTLE / OPPONENT_TURN |
| 52194 | BATTLE / OUR_TURN，识别到手牌 6 张、可操作单位 |
| 53868 | PLAY_CARD：拖牌到己方部署区域 |
| 59229 | 出牌确认：己方单位出现 |
| 182137 | END_TURN：结束回合 |
| 207528 | OPPONENT_TURN → 我方回合交替 |
| 275011 | RESULT 页面识别 |
| 276423 | `game-complete`，`completedGames: 1` |

**对手类型**：真人玩家（"9998888"），非训练 AI。对局耗时约 276 秒。

### 2. 排位模式（ranked）⏳

代码路径与休闲完全一致（同一个 DECK_DETAIL 切换分支），`modeType: "ranked"` 时识别并点击 `RANKED_TOGGLE` 坐标。未单独跑一局验证，但模板识别已验证（`detectDeckModeToggle` 正确返回 `"ranked"`）。

### 3. 节奏参数可配置 ✅

`user-strategy.js` 新增字段：

| 字段 | 默认值 | 安全范围 | 说明 |
|------|--------|----------|------|
| cardPlayPaceMs | 750 | 300-5000 | 两次出牌尝试最短间隔 |
| unitActionPaceMs | 650 | 300-5000 | 两次单位操作最短间隔 |
| endTurnPaceMs | 1100 | 500-10000 | 结束回合后最短等待 |
| navPaceMs | 1800 | 800-10000 | 导航点击最短间隔 |

测试验证：
- 低于下限的值被钳制到 PACE_MIN
- 高于上限的值被钳制到 PACE_MAX
- 非法 modeType 报错
- 所有字段写入 config 后生效

### 4. 安全默认值不可修改 ✅

`user-strategy.js` 中 `SAFE` 常量定义了不可被用户覆盖的安全项：

```js
{
  minUiConfidence: 0.80,
  minTargetConfidence: 0.70,
  minStableHandFrames: 2,
  minUnitActionConfidence: 0.55,
  maxSameSceneFrames: 160,
  opponentTurnTimeoutMs: 90000,
  maxConsecutiveFailures: 4,
  requireCostBadge: true,
  detectGenericBlockingOverlay: false
}
```

`apply()` 函数末尾强制将这些值写入 config，用户策略文件无法覆盖。

### 5. 启动恢复路径 ✅

`runtime.js` 新增启动恢复逻辑：启动后 60 秒内，如果页面分类持续为 UNKNOWN 超过 4 帧，依次尝试关闭已知的弹窗关闭区域：

1. 促销弹窗关闭（右上角 X）
2. 每日任务关闭（底部暗区）
3. 通用弹窗关闭（顶部右侧）

日志确认三次尝试均执行，随后成功进入正常导航。

### 6. 新增模板与坐标 ✅

**模板**（`autojs/templates/buttons/`，全部已有，无需新裁）：
- `mode-battle-selected.png` / `mode-battle-unselected.png` — 对战模式行
- `deck-ranked.png` / `deck-ranked-selected.png` — 排位切换
- `deck-casual-selected.png` / `deck-casual-unselected.png` — 休闲切换
- `deck-start.png` — 对战开始按钮

**坐标**（`autojs/lib/coordinates.js`，来自 manifest.json 实测）：
- `MODE_VERSUS`: [0.199, 0.215, 0.359, 0.319]
- `RANKED_TOGGLE`: [0.720, 0.708, 0.844, 0.792]
- `CASUAL_TOGGLE`: [0.842, 0.708, 0.963, 0.792]
- `DECK_START_PVP`: [0.719, 0.785, 0.965, 0.895]

### 7. 识别验证 ✅

`vision._private.detectDeckModeToggle` 实测：
- 当前"排位"选中时返回 `"ranked"` ✅
- 两状态同时命中或都不命中时返回 `null`（不猜）✅

## 遗留问题

1. 排位模式未单独跑一局验证（代码路径与休闲一致，但建议独立验证）。
2. 桌面冷启动（从桌面图标直接拉起 KARDS）的弹窗恢复路径未在真实冷启动场景下验证。
3. 启动恢复的三个弹窗关闭区域坐标是估算值，如果弹窗布局变化可能需要校准。
