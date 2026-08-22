# KardsScript

KARDS 自动对战挂机工具的 Auto.js6 工程。

## 当前已实现的基础层

- Auto.js6 截图与页面/场景视觉识别；
- 像素分析、模板匹配、手牌检测与合法目标探测；
- JSON 决策树 DSL、校验器与安全解释器；
- 启动、对局、结算、重连和未知界面恢复路径；
- 默认策略、离线回放测试与 Auto.js 实机诊断工具。

## 运行

1. 在雷电模拟器安装适配当前 Android 版本的 Auto.js6。
2. 导入 `autojs/` 文件夹并运行 `autojs/main.js`。
3. 允许无障碍和截图权限，切回 KARDS 主界面。
4. 默认保持 `autojs/lib/config.js` 的 `mode` 为 `observe`。

## 规则示例

默认规则位于 `fixtures/default-decision-tree.json`。目标动作的 `legalOnly` 强制为 `true`：目标坐标只能来自游戏 UI 选中后的视觉反馈，规则树只决定合法目标的排序。

- [实机测试报告](docs/hardware-test-report-2026-08-20.md)
```powershell
Get-ChildItem autojs/test -Filter *.test.js | ForEach-Object { node $_.FullName }
```

