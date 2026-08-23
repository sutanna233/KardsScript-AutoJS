# KardsScript Auto.js

这是项目唯一维护的 Auto.js6 实现，用于截图、视觉标定与自动对战。

`main.js` 是观察模式，不会点击 KARDS；`auto-main.js` 是自动模式，只有费用颜色、来源位置和动作结果均确认时才执行操作。

## 导入与运行

1. 在雷电模拟器 9（64 位）中创建并使用 **Xiaomi 15 Pro（Xiaomi 15PRO）** 模拟机型，再安装适配当前 Android 版本的 Auto.js。
2. 导入整个 `autojs/` 文件夹。调试运行 `main.js`，自动运行 `auto-main.js`。
3. 允许截图权限，切回 KARDS 主界面；如果运行观察入口 `main.js`，还需按 Auto.js 提示开启无障碍权限。自动入口 `auto-main.js` 不调用 `auto.waitFor()`，但当前驱动通过 `su`/Root shell 发送触控事件，需要设备提供可用的 Root/特权 shell。
4. 在 Auto.js 控制台核对 `[页面/场景]` 日志。

`lib/config.js` 的 `mode` 必须先保持 `observe`。页面分类、回合、手牌边界和合法目标探测都经实机验证前，禁止开启游戏动作。

`lib/driver.js` 是唯一允许产生触控的模块：它要求 KARDS 前台、当前帧视觉合法目标、目标置信度达标及显式动作开关四项同时满足。
