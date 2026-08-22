# KardsScript 项目指南

## 唯一维护工程
- 项目唯一实现是 `autojs/` 下的 Auto.js6 脚本；已删除弃用的 Kotlin/Gradle `android-app/` 工程。
- 新功能、测试和实机验证只针对 Auto.js6，不再运行 Gradle/Android Studio 构建。

## 运行与验证
- 在雷电模拟器导入 `autojs/`，运行 `main.js`。
- 默认保持 `autojs/lib/config.js` 的 `mode` 为 `observe`。
- 离线测试：`Get-ChildItem autojs/test -Filter *.test.js | ForEach-Object { node $_.FullName }`。
- Auto.js 输入必须使用 `input touchscreen tap`；普通 `input tap` 对 Unreal 引擎无效。

## 安全约束
- `autojs/lib/driver.js` 是唯一触控入口。
- 页面置信度不足、KARDS 不在前台或没有视觉确认的合法目标时不得操作。
