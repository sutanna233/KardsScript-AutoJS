// 拟人化模块离线测试
var humanize = require("../lib/humanize");
var passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; }
    else { failed++; console.error("  ✗ " + msg); }
}

console.log("═══ humanize.test.js ═══");

// ─── 基本结构 ─────────────────────────────────────────────────────────────────
assert(typeof humanize.jitterTap === "function", "jitterTap 是函数");
assert(typeof humanize.jitterTapAdaptive === "function", "jitterTapAdaptive 是函数");
assert(typeof humanize.jitterStart === "function", "jitterStart 是函数");
assert(typeof humanize.jitterEnd === "function", "jitterEnd 是函数");
assert(typeof humanize.humanDelay === "function", "humanDelay 是函数");
assert(typeof humanize.thinkTime === "function", "thinkTime 是函数");
assert(typeof humanize.tickInterval === "function", "tickInterval 是函数");
assert(typeof humanize.swipeDuration === "function", "swipeDuration 是函数");
assert(typeof humanize.tapDuration === "function", "tapDuration 是函数");
assert(typeof humanize.adaptiveRadius === "function", "adaptiveRadius 是函数");

// ─── 禁用模式 ─────────────────────────────────────────────────────────────────
humanize.enabled = false;
var t = humanize.jitterTap(100, 200, 8);
assert(t.x === 100 && t.y === 200, "disabled 时 jitterTap 无偏移");
assert(humanize.humanDelay(300) === 300, "disabled 时 humanDelay 无扰动");
assert(humanize.thinkTime(200) === 0, "disabled 时 thinkTime 返回 0");
assert(humanize.tickInterval(300) === 300, "disabled 时 tickInterval 无扰动");
assert(humanize.tapDuration() === 120, "disabled 时 tapDuration 固定 120");
humanize.enabled = true;

// ─── 坐标抖动范围 ─────────────────────────────────────────────────────────────
humanize.enabled = true;
var inRange = true;
for (var i = 0; i < 2000; i++) {
    var r = humanize.jitterTap(500, 300, 8);
    if (Math.abs(r.x - 500) > 8 || Math.abs(r.y - 300) > 8) { inRange = false; break; }
}
assert(inRange, "jitterTap 偏移不超过 ±radius");

// 确认有实际偏移（不会全是 0）
var hasOffset = false;
for (var i = 0; i < 500; i++) {
    var r = humanize.jitterTap(500, 300, 8);
    if (r.x !== 500 || r.y !== 300) { hasOffset = true; break; }
}
assert(hasOffset, "jitterTap 实际产生偏移");

// ─── 自适应半径 ───────────────────────────────────────────────────────────────
// 大按钮：187px 宽 × 56px 高 → minDim=56 → 56*0.12=6.7 → 7px（< 上限 8）
var rad1 = humanize.adaptiveRadius([0.82, 0.67, 0.98, 0.77], 1280, 720, 8);
assert(rad1 >= 2 && rad1 <= 8, "大按钮半径在 [2,8] 内: " + rad1);

// 小按钮：48px 宽 × 40px 高 → minDim=40 → 40*0.12=4.8 → 5px
var rad2 = humanize.adaptiveRadius([0.042, 0.22, 0.08, 0.28], 1280, 720, 8);
assert(rad2 >= 2 && rad2 <= 6, "小按钮半径较小: " + rad2);

// 极小目标：35px → 35*0.12=4.2 → 4px
var rad3 = humanize.adaptiveRadius([0.56, 0.07, 0.59, 0.13], 1280, 720, 8);
assert(rad3 >= 2 && rad3 <= 5, "极小目标半径更小: " + rad3);

// 无效 bounds 返回安全默认
var rad4 = humanize.adaptiveRadius(null, 1280, 720, 8);
assert(rad4 === 3, "无效 bounds 返回 3px 默认");

// ─── 自适应抖动范围 ───────────────────────────────────────────────────────────
var adaptiveIn = true;
for (var i = 0; i < 2000; i++) {
    var r = humanize.jitterTapAdaptive(500, 300, [0.0, 0.0, 1.0, 1.0], 1280, 720, 8);
    if (Math.abs(r.x - 500) > 8 || Math.abs(r.y - 300) > 8) { adaptiveIn = false; break; }
}
assert(adaptiveIn, "jitterTapAdaptive 偏移不超过 maxRadius");

// ─── humanDelay 范围 ──────────────────────────────────────────────────────────
var delayIn = true;
for (var i = 0; i < 1000; i++) {
    var d = humanize.humanDelay(600, 0.35);
    if (d < 350 || d > 850) { delayIn = false; break; }
}
assert(delayIn, "humanDelay 在合理范围内 (base±variance)");

// ─── thinkTime 范围 ───────────────────────────────────────────────────────────
// 50ms 基准（默认）：正常 30~75ms，偶发 8% 长停顿 → 最大约 325ms
var think50 = true, maxThink50 = 0, avgThink50 = 0;
for (var i = 0; i < 3000; i++) {
    var t = humanize.thinkTime(50);
    if (t < 10 || t > 400) { think50 = false; break; }
    if (t > maxThink50) maxThink50 = t;
    avgThink50 += t;
}
assert(think50, "thinkTime(50) 在 [10, 400] 内");
console.log("  thinkTime(50): max=" + maxThink50 + "ms, avg=" + Math.round(avgThink50 / 3000) + "ms");

// 200ms 基准：正常 120~300ms，偶发长停顿 → 最大约 1300ms
var think200 = true, maxThink200 = 0;
for (var i = 0; i < 3000; i++) {
    var t = humanize.thinkTime(200);
    if (t < 10 || t > 1400) { think200 = false; break; }
    if (t > maxThink200) maxThink200 = t;
}
assert(think200, "thinkTime(200) 在 [10, 1400] 内");
console.log("  thinkTime(200): max=" + maxThink200 + "ms");

// ─── tickInterval 范围 ────────────────────────────────────────────────────────
var tickIn = true;
for (var i = 0; i < 1000; i++) {
    var t = humanize.tickInterval(300);
    if (t < 150 || t > 400) { tickIn = false; break; }
}
assert(tickIn, "tickInterval 在 [150, 400] 内（base 300）");

// ─── swipeDuration 范围 ───────────────────────────────────────────────────────
var swipeIn = true;
for (var i = 0; i < 1000; i++) {
    var d = humanize.swipeDuration(300, 450);
    if (d < 120 || d > 900) { swipeIn = false; break; }
}
assert(swipeIn, "swipeDuration 在 [120, 900] 内");

// 距离越长时长越长（统计趋势）
var shortAvg = 0, longAvg = 0;
for (var i = 0; i < 500; i++) {
    shortAvg += humanize.swipeDuration(100, 450);
    longAvg += humanize.swipeDuration(600, 450);
}
assert(longAvg / 500 > shortAvg / 500, "长距离拖拽时长 > 短距离拖拽时长");

// ─── tapDuration 范围 ─────────────────────────────────────────────────────────
var tapIn = true;
for (var i = 0; i < 500; i++) {
    var d = humanize.tapDuration();
    if (d < 60 || d > 200) { tapIn = false; break; }
}
assert(tapIn, "tapDuration 在 [60, 200] 内");

// ─── swipe 端点抖动 ───────────────────────────────────────────────────────────
var startIn = true, endIn = true;
for (var i = 0; i < 1000; i++) {
    var s = humanize.jitterStart(400, 300, 5);
    if (Math.abs(s.x - 400) > 5 || Math.abs(s.y - 300) > 5) { startIn = false; break; }
    var e = humanize.jitterEnd(600, 500, 7);
    if (Math.abs(e.x - 600) > 7 || Math.abs(e.y - 500) > 7) { endIn = false; break; }
}
assert(startIn, "jitterStart 偏移不超过 ±radius");
assert(endIn, "jitterEnd 偏移不超过 ±radius");

// ─── 统计分布验证：偏移不是均匀的（三角分布中心密集）────────────────────────────
var nearZero = 0, nearEdge = 0;
for (var i = 0; i < 10000; i++) {
    var r = humanize.jitterTap(500, 300, 8);
    var dx = Math.abs(r.x - 500);
    if (dx <= 2) nearZero++;
    if (dx >= 7) nearEdge++;
}
// 三角分布：中心（≤2px）应明显多于边缘（≥7px）
assert(nearZero > nearEdge * 3, "三角分布中心密集 (nearZero=" + nearZero + " > nearEdge*3=" + nearEdge * 3 + ")");

// ─── 结果 ─────────────────────────────────────────────────────────────────────
console.log("\n  通过: " + passed + "  失败: " + failed);
if (failed > 0) process.exit(1);
console.log("  ✓ 全部通过\n");
