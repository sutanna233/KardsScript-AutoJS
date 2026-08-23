# KardsScript 项目文档

## 项目概述

KardsScript 是一个 Android 端 KARDS（二战卡牌游戏）自动对战挂机工具。

**目标**：自动启动/匹配/换牌/对局/结算/再匹配/异常恢复，用户可编辑 AI 决策树。

**框架**：Auto.js6（JS 脚本运行时，运行在 AutoJS App 上）

**核心特点**：
- 自动模式不调用无障碍服务，但当前驱动通过 `su`/Root shell 发送 `input touchscreen` 事件；调试入口 `main.js` 因调用 `auto.waitFor()` 可能需要无障碍权限
- 纯规则+像素分析的视觉识别，不训练模型
- JSON 决策树 DSL，用户可自定义策略
- 合法目标必须视觉确认，不凭空生成坐标

---

## 架构设计

### 整体流程

```
截图循环 (750ms/帧)
    ↓
① 页面分类 → 识别导航页面（HOME/MODE_MENU/DECK_LIST/BATTLE...）
    ↓
② 场景分类 → 识别对局场景（OUR_TURN/OPPONENT_TURN/RESULT）
    ↓
③ 手牌检测 → 检测手牌数量（0-9张）
    ↓
④ 合法目标探测 → 帧间差分找高亮变化
    ↓
⑤ 决策树执行 → JSON DSL 解析 + 策略选择
    ↓
⑥ 输入驱动 → input touchscreen tap
```

### 模块划分

| 模块 | 文件 | 职责 |
|------|------|------|
| 入口 | `main.js` | 截图循环、初始化、启动运行时 |
| 配置 | `lib/config.js` | 坐标、槽位、阈值、区域定义 |
| 领域模型 | `lib/domain.js` | Scene/Screen/Action 枚举 |
| 坐标常量 | `lib/coordinates.js` | 固定按钮坐标（1280x720） |
| 视觉引擎 | `lib/vision.js` | 像素采样→场景分类→手牌→单位→合法目标 |
| 决策引擎 | `lib/decision.js` | JSON DSL 解析 + 校验 + 执行 |
| 策略层 | `lib/strategy.js` | 卡牌/单位选择→目标排序→守卫优先 |
| 输入驱动 | `lib/driver.js` | input touchscreen tap 封装 |
| 运行时 | `lib/runtime.js` | 状态机：场景流转→动作执行→失败处理 |

### 核心闭环

```
BotRuntime.tick(observation)
  ├─ 检查 KARDS 是否在前台
  ├─ 检查场景是否超时
  ├─ if 非对局页面 → tapVerifiedUi（点击固定按钮）
  ├─ if 我方回合 → execute
  │   ├─ 有 pending 动作？→ 点击 legalTarget
  │   └─ 无 pending？→ 决策树 decide → 选择动作源
  └─ if 对方回合 → 等待
```

---

## 视觉识别方案

### ① 页面分类（KardsUiScreenClassifier）

**原理**：对每个锚点区域采样三个特征，匹配阈值规则。

**三个特征**：
- **L（亮度）**：平均 luma = R×0.2126 + G×0.7152 + B×0.0722
- **S（饱和度）**：(max(R,G,B) - min(R,G,B)) / max(R,G,B) × 255
- **E（边缘密度）**：相邻像素亮度差 > 36 的比例

**采样方式**：
```javascript
for (y = top; y < bottom; y += stride)    // stride=24 跳跃加速
    for (x = left; x < right; x += stride)
        // 累加 luminance, saturation, edges
```

**匹配规则**：
```javascript
// 每个页面定义一组锚点阈值
uiRules: [
    { id: "home", screen: "HOME", anchors: [
        { r: "topUi", minL: 48 },        // 顶部亮度 ≥ 48
        { r: "menuCenter", minL: 60 },   // 中心亮度 ≥ 60
        { r: "rightPanel", minS: 65 }    // 右侧饱和度 ≥ 65
    ]},
    // ... 其他页面
]
```

**优先级**：规则有 priority 字段，高优先级先匹配。

---

### ② 场景分类（SceneClassifier + 模板匹配）

**模板匹配**：
```javascript
// 用 images.findImage 在指定区域搜索模板图片
var point = images.findImage(frame, template, {
    threshold: 0.82,  // 匹配阈值
    region: [x, y, width, height]  // 搜索区域
});
```

**已覆盖的模板**：

| 模板 | 用途 | 识别的场景 |
|------|------|-----------|
| `battle-turn-ours.png` | 结束回合按钮（橙色） | OUR_TURN |
| `battle-turn-ours-white.png` | 结束回合按钮（白色） | OUR_TURN |
| `battle-turn-opponent.png` | 结束回合按钮（灰色） | OPPONENT_TURN |
| `mulligan-header.png` | 换牌标题栏 | MULLIGAN |
| `result-next-reward.png` | 结算继续按钮 | RESULT |

**辅助判断**：底部 UI 区域亮度
- 亮度 ≥ 35 且饱和度 ≥ 30 → OUR_TURN
- 亮度 20-35 → OPPONENT_TURN

---

### ③ 手牌检测（HandCardDetector）

**两种布局**：
```javascript
var layouts = [
    { id: "middle", sampleY: 460, top: 375, bottom: 548 },  // 旧版
    { id: "bottom", sampleY: 650, top: 590, bottom: 720, center: 640, gap: 145 }  // 新版
];
```

**检测逻辑**：
```javascript
// 对每个手牌数量（1-9），检查最左侧卡牌位置
for (count = 1; count <= 9; count++) {
    var x = leftmostX[count];  // 预校准的 x 坐标
    if (hasCardAt(frame, x, sampleY)) {
        matches.push(count);
    }
}
// 只接受唯一匹配的布局
if (matches.length === 1) return matches[0];
```

**卡牌判断条件**：
```javascript
// 采样 31×31 像素区域
avgBrightness > 60  // 卡牌比深色战场背景亮
avgWarmth > 10      // 卡牌偏暖（R-B > 10）
```

---

### ④ 合法目标探测（帧间差分）

**原理**：选中牌/单位后，游戏会高亮可选目标。通过帧间差分检测高亮变化。

**流程**：
```
1. 选中牌/单位前截一帧 (before)
2. 选中后截一帧 (after)
3. 计算每个槽位的 highlight score
4. score > 0.12 → 候选合法目标
```

**计算公式**：
```javascript
function highlight(before, after, slot) {
    var delta = difference(before, after, slot);  // 亮度差
    var gain = saturation(after) - saturation(before);  // 饱和度增益
    return (delta / 255 * 0.7 + gain / 255 * 0.3).clamp(0, 1);
}
```

**Guard 检测**：
```javascript
// 在敌方单位槽位上方搜索护盾图标
var guardBounds = [
    Math.max(0, unitBounds[0] - 0.03),
    Math.max(0, unitBounds[1] - 0.08),
    Math.min(1, unitBounds[2] + 0.03),
    Math.min(1, unitBounds[1] + 0.10)
];
var match = images.findImage(frame, guardTemplate, { threshold: 0.90, region: guardBounds });
```

---

## 决策树 DSL

### 节点类型

| 类型 | 说明 |
|------|------|
| `priority` | 从前到后选择第一条有动作的分支 |
| `sequence` | 依次执行所有子动作 |
| `condition` | `whenAll` 条件成立时执行 `then` |
| `action` | 执行具体动作（PLAY_CARD / ATTACK / END_TURN 等） |

### 示例：默认策略

```json
{
  "schemaVersion": 1,
  "name": "默认全自动中速",
  "root": {
    "id": "root",
    "type": "priority",
    "children": [
      {
        "id": "play",
        "type": "condition",
        "whenAll": [{ "field": "hasPlayableCard", "operator": "EQ", "value": "true" }],
        "then": {
          "id": "play-best",
          "type": "action",
          "action": {
            "kind": "PLAY_CARD",
            "cardSort": ["USER_PRIORITY_DESC", "DEPLOYMENT_COST_DESC"],
            "targetSort": ["THREAT_DESC", "ENEMY_HQ_FIRST"],
            "legalOnly": true
          }
        }
      },
      {
        "id": "operate",
        "type": "condition",
        "whenAll": [{ "field": "hasOperableUnit", "operator": "EQ", "value": "true" }],
        "then": {
          "id": "operate-best",
          "type": "action",
          "action": {
            "kind": "OPERATE_UNIT",
            "actorSort": ["ATTACK_DESC"],
            "targetSort": ["THREAT_DESC", "ENEMY_HQ_FIRST"],
            "legalOnly": true
          }
        }
      },
      {
        "id": "end-turn",
        "type": "action",
        "action": { "kind": "END_TURN" }
      }
    ]
  }
}
```

### 条件字段

| 字段 | 说明 | 当前状态 |
|------|------|----------|
| `scene` | 当前场景 | ✅ 正常 |
| `credits` | 当前费用 | ❌ 始终 null（无 OCR） |
| `handCount` | 手牌数量 | ✅ 正常 |
| `hasPlayableCard` | 有可出的牌 | ⚠️ 不考虑费用 |
| `hasOperableUnit` | 有可操作的单位 | ❌ 始终 false |
| `hasLegalTarget` | 有合法目标 | ✅ 正常 |
| `canLethal` | 能否斩杀 | ❌ 始终 false |
| `enemyUnitCount` | 敌方单位数 | ✅ 正常 |
| `playerUnitCount` | 我方单位数 | ✅ 正常 |
| `frontlineControlled` | 是否控制前线 | ✅ 正常 |
| `confidence` | 视觉置信度 | ✅ 正常 |

### 排序器

| 排序器 | 说明 |
|--------|------|
| `USER_PRIORITY_DESC` | 用户优先级降序 |
| `DEPLOYMENT_COST_DESC` | 部署费用降序 |
| `ATTACK_DESC` | 攻击力降序 |
| `THREAT_DESC` | 威胁度降序 |
| `ENEMY_HQ_FIRST` | 优先攻击敌方总部 |
| `KILLABLE_FIRST` | 优先击杀可消灭的目标 |

---

## 坐标系统

### 归一化坐标（0-1）

所有坐标都归一化到 0-1 范围，适配不同分辨率。

**转换公式**：
```javascript
pixel_x = normalized_x * screen_width
pixel_y = normalized_y * screen_height
```

### 固定坐标（1280x720）

| 元素 | 归一化 bounds | 像素中心 |
|------|--------------|----------|
| 开始按钮 | [0.04, 0.22, 0.08, 0.28] | (78, 181) |
| 训练模式 | [0.15, 0.22, 0.26, 0.27] | (265, 175) |
| 默认卡组 | [0.09, 0.22, 0.28, 0.50] | (232, 260) |
| 卡组确认 | [0.81, 0.56, 0.89, 0.62] | (1090, 422) |
| 换牌确认 | [0.42, 0.58, 0.58, 0.67] | (640, 450) |
| 结束回合 | [0.84, 0.68, 0.97, 0.76] | (1157, 518) |
| 结算继续 | [0.42, 0.60, 0.58, 0.68] | (640, 468) |
| 重连按钮 | [0.38, 0.38, 0.62, 0.45] | (640, 588) |
| 弹窗关闭 | [0.72, 0.06, 0.76, 0.10] | (952, 58) |

### 战场槽位

```
        敌方后排        敌方前排        我方前排        我方后排
    left  mid  right  left  mid  right  left  mid  right  left  mid  right
y:  0.18-0.34          0.34-0.48       0.50-0.64       0.64-0.78

x:  0.08-0.25  0.41-0.59  0.75-0.92
```

### 手牌位置（采样点）

| 手牌数 | 最左侧 x | 间距 |
|--------|----------|------|
| 1 张 | 640 | - |
| 2 张 | 587 | 53 |
| 3 张 | 535 | 52 |
| 4 张 | 482 | 53 |
| 5 张 | 430 | 52 |
| 6 张 | 377 | 53 |
| 7 张 | 325 | 52 |
| 8 张 | 272 | 53 |
| 9 张 | 220 | 52 |

---

## 运行时状态机

### 场景流转

```
UNKNOWN
  ↓ (页面分类)
MENU / MODE_MENU / DECK_LIST / DECK_DETAIL
  ↓ (点击)
MULLIGAN
  ↓ (确认换牌)
OUR_TURN / OPPONENT_TURN
  ↓ (出牌/攻击)
OUR_TURN / OPPONENT_TURN
  ↓ (结束回合)
OPPONENT_TURN / OUR_TURN
  ↓ (对手回合结束)
OUR_TURN
  ↓ (重复)
RESULT
  ↓ (点击继续)
RECONNECTING / UNKNOWN
```

### 防御机制

| 机制 | 说明 |
|------|------|
| 场景超时 | 同一场景超过 160 帧（2分钟）自动停止 |
| 连续失败 | 连续 4 次动作失败自动停止 |
| endTurn 冷却 | 结束回合后 8 秒内不重复点击 |
| KARDS 前台检查 | 每帧检查当前包名，不在前台则暂停 |
| 合法目标确认 | 必须视觉确认，不凭空生成坐标 |

---

## 已知问题

### 无 OCR（P0）

**影响**：
- `credits` 始终 null → 决策树 `hasPlayableCard` 不考虑费用
- `canLethal` 始终 false → 无法判断斩杀
- 不知道卡牌费用/攻防/总部血量

**建议**：
- AutoJS 内置 `images.recognizeText()` + Tesseract
- 或调用 DSH 视觉工具远程识别

---

### 无卡牌识别（P1）

**影响**：
- 出牌只能按固定优先级排序
- 不能根据对局情况选牌
- `USER_PRIORITY_DESC` 排序器失效

**建议**：
- 至少区分 3-5 种常用牌（模板匹配）
- 或接入卡牌数据库（费用/攻防/效果）

---

### 单位状态缺失（P1）

**影响**：
- `canOperate` 始终 false
- 不知道刚部署的单位能否攻击
- `OPERATE_UNIT` 动作基本废了

**建议**：
- 检测单位是否有"可操作"标记（通常是绿色边框）
- 或根据部署时间估算（刚部署的不能攻击）

---

### 手牌检测布局（P2）

**影响**：
- 新旧版本布局不同（middle vs bottom）
- 可能误检或漏检

**建议**：
- 两种布局都尝试，只接受唯一匹配
- 或加入模板匹配确认

---

### 模板匹配不完整（P2）

**影响**：
- 只覆盖 4 个关键按钮
- 卡牌详情关闭、投降按钮等未做

**建议**：
- 补全"卡牌详情关闭"模板
- 防止点错卡住流程

---

## 建议的下一步

### 阶段 1：验证闭环（1-2 天）

1. **实机测试**：在雷电模拟器运行 `main.js`，确认视觉识别能跑
2. **日志系统**：加入文件日志，方便调试
3. **截图保存**：出错时保存截图，分析问题

### 阶段 2：补全视觉（3-5 天）

4. **接入 OCR**：读取 Kredit（费用）和 HP（血量）
5. **补全模板**：卡牌详情关闭、投降按钮
6. **Guard 检测**：模板匹配护盾图标

### 阶段 3：优化策略（1 周）

7. **斩杀判断**：总部血量 ≤ 我方总攻击力
8. **守卫优先**：攻击时优先打守护单位
9. **战场控制**：优先抢前线

### 阶段 4：测试对局（2-3 天）

10. **完整流程**：匹配 → 换牌 → 出牌 → 攻击 → 结束 → 再匹配
11. **异常处理**：掉线重连、弹窗关闭、超时恢复
12. **稳定性测试**：连续运行 10 局不出错

---

## 测试

### 离线测试

```bash
# 进入 autojs 目录
cd J:\dev\KardsScript\autojs

# 运行视觉测试
node test/vision-replay.test.js

# 运行决策测试
node test/decision-replay.test.js

# 运行运行时测试
node test/runtime-replay.test.js
```

### 实机测试

1. 在雷电模拟器安装 Auto.js6
2. 导入 `autojs/` 目录
3. `config.js` 中设置 `mode: "observe"`（只观察不操作）
4. 运行 `main.js`
5. 打开 KARDS，观察控制台输出

---

## 附录：AutoJS API 参考

### 截图

```javascript
requestScreenCapture(true);  // 请求截图权限
var frame = captureScreen();  // 获取当前帧
```

### 图像处理

```javascript
var img = images.read(path);  // 读取图片
var point = images.findImage(frame, template, {  // 模板匹配
    threshold: 0.8,
    region: [x, y, w, h]
});
var text = images.recognizeText(frame, region, {  // OCR
    language: "eng"
});
```

### 像素操作

```javascript
var color = images.pixel(frame, x, y);  // 获取像素颜色
var r = (color >> 16) & 0xff;  // 提取 R 通道
var g = (color >> 8) & 0xff;   // 提取 G 通道
var b = color & 0xff;          // 提取 B 通道
```

### 输入

```javascript
// 对 KARDS 有效的方式
shell("input touchscreen tap " + x + " " + y, true);

// 部分有效（卡组详情面板）
swipe(x1, y1, x2, y2, duration);
```

### 文件操作

```javascript
files.exists(path);           // 检查文件是否存在
files.read(path);             // 读取文件
files.write(path, content);   // 写入文件
files.join(dir, name);        // 拼接路径
```

### 引擎控制

```javascript
engines.myEngine();           // 获取当前引擎
engines.all();                // 获取所有引擎
engine.forceStop();           // 停止引擎
```

---

## 附录：配置参数说明

### config.js 核心参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `tickMs` | 750 | 截图循环间隔（毫秒） |
| `templateThreshold` | 0.82 | 模板匹配置信度阈值 |
| `guardTemplateThreshold` | 0.90 | 守护模板匹配置信度阈值 |
| `minUiConfidence` | 0.80 | UI 分类最低置信度 |
| `minTargetConfidence` | 0.70 | 合法目标最低置信度 |
| `minTargetHighlightDelta` | 0.16 | 目标高亮最小变化量 |
| `targetHighlightFullDelta` | 0.30 | 目标完全高亮变化量 |
| `minUnitEdgeDensity` | 0.20 | 单位槽位边缘密度阈值 |
| `maxSameSceneFrames` | 160 | 同场景最大帧数（超时停止） |
| `maxConsecutiveFailures` | 4 | 连续失败最大次数 |
| `endTurnSettleMs` | 8000 | 结束回合冷却时间（毫秒） |
| `mode` | "automatic" | 运行模式（automatic/observe） |
| `allowNavigation` | true | 是否允许页面导航 |
| `allowBattleActions` | true | 是否允许战斗操作 |
