// ─────────────────────────────────────────────────────────────────────────────
// 拟人化模块（Anti-Bot / Humanize Layer）
// ─────────────────────────────────────────────────────────────────────────────
// 目标：让脚本的输入行为在统计特征上接近真人操作，降低以下可检测信号：
//   1. 每次点击完全相同的像素坐标
//   2. 动作间隔呈完美等间距（固定 tick）
//   3. 拖拽路径为完美直线 + 固定时长
//   4. 从"看到"到"操作"之间零延迟（机器反应）
//   5. 无偶发犹豫 / 停顿
//
// 设计原则：
//   - 所有随机偏移都足够小，不影响游戏判定（不点错按钮 / 不拖出部署区）
//   - 用三角分布（两次 Math.random 求和）近似正态，比均匀分布更接近人类手抖
//   - 所有参数可由 config.humanize 控制，enabled=false 时退化为原始行为
//   - 纯同步函数，不引入额外 shell 调用，零性能开销
// ─────────────────────────────────────────────────────────────────────────────

// 三角分布 [-1, 1]：两次均匀随机数的均值，中心密集、边缘稀疏，
// 比 Math.random() - 0.5 更贴近人类手抖的统计特征。
function _triangular() {
    return (Math.random() + Math.random()) / 2 - 0.5;
}

// 在 [-radius, +radius] 内产生一个三角形分布的整数偏移
function _offset(radius) {
    return Math.round(_triangular() * radius * 2);
}

// ─── 主接口 ──────────────────────────────────────────────────────────────────

var humanize = {
    // 总开关：false 时所有函数退化为无偏移 / 无延迟
    enabled: true,

    // ─── 坐标抖动 ────────────────────────────────────────────────────────────

    /**
     * 对 tap 坐标加入手抖偏移（固定半径版本）。
     * @param {number} x - 原始 x
     * @param {number} y - 原始 y
     * @param {number} radius - 最大偏移像素（默认 8）
     * @returns {{x:number, y:number}} 抖动后坐标
     */
    jitterTap: function (x, y, radius) {
        if (!this.enabled) return { x: x, y: y };
        var r = Math.max(3, radius || 8);
        return { x: x + _offset(r), y: y + _offset(r) };
    },

    /**
     * 根据目标尺寸自适应计算安全抖动半径。
     * 公式：min(maxRadius, 目标最小边像素 * 0.12)，下限 2px。
     * 187px 按钮 → 8px（上限），48px 按钮 → 5px，35px 关闭 X → 4px。
     * @param {number[]} bounds - 归一化 [x1,y1,x2,y2]
     * @param {number} width - 屏幕宽
     * @param {number} height - 屏幕高
     * @param {number} maxRadius - 全局上限（默认 8）
     * @returns {number} 安全抖动半径（像素）
     */
    adaptiveRadius: function (bounds, width, height, maxRadius) {
        if (!bounds || bounds.length !== 4) return 3;
        var w = (bounds[2] - bounds[0]) * (width || 1280);
        var h = (bounds[3] - bounds[1]) * (height || 720);
        var minDim = Math.min(w, h);
        var max = Math.max(3, maxRadius || 8);
        return Math.max(2, Math.min(max, Math.round(minDim * 0.12)));
    },

    /**
     * 自适应 tap 抖动：根据目标 bounds 自动选择安全半径。
     * @param {number} x - 中心 x
     * @param {number} y - 中心 y
     * @param {number[]} bounds - 目标归一化 bounds
     * @param {number} width - 屏幕宽
     * @param {number} height - 屏幕高
     * @param {number} maxRadius - 全局上限（默认 8）
     * @returns {{x:number, y:number}}
     */
    jitterTapAdaptive: function (x, y, bounds, width, height, maxRadius) {
        if (!this.enabled) return { x: x, y: y };
        var r = this.adaptiveRadius(bounds, width, height, maxRadius);
        return { x: x + _offset(r), y: y + _offset(r) };
    },

    /**
     * 对 swipe 起点加入偏移（手指按下时不精确）。
     */
    jitterStart: function (x, y, radius) {
        if (!this.enabled) return { x: x, y: y };
        var r = Math.max(2, radius || 5);
        return { x: x + _offset(r), y: y + _offset(r) };
    },

    /**
     * 对 swipe 终点加入偏移（松手时不精确）。
     */
    jitterEnd: function (x, y, radius) {
        if (!this.enabled) return { x: x, y: y };
        var r = Math.max(3, radius || 7);
        return { x: x + _offset(r), y: y + _offset(r) };
    },

    // ─── 时间变异 ────────────────────────────────────────────────────────────

    /**
     * 对固定时延加入 ±variance 的随机扰动。
     * 例：humanDelay(300, 0.35) → 约 195 ~ 405ms
     * @param {number} baseMs - 基准毫秒
     * @param {number} variance - 变异比例 0~1（默认 0.35）
     * @returns {number} 扰动后毫秒
     */
    humanDelay: function (baseMs, variance) {
        if (!this.enabled) return baseMs;
        var v = Math.min(0.6, Math.max(0.15, variance || 0.35));
        return Math.max(50, Math.round(baseMs * (1 + _triangular() * v * 2)));
    },

    /**
     * 动作前"思考"时间：模拟人从看到局面到做出决策的延迟。
     * 按 baseMs 比例缩放，支持极小基准（如 50ms → 实际 30~75ms，偶发 8% 长停顿）。
     * @param {number} baseMs - 基准思考时间（默认 200ms）
     * @returns {number} 实际等待毫秒
     */
    thinkTime: function (baseMs) {
        if (!this.enabled) return 0;
        var base = Math.max(20, baseMs || 200);
        // 按基准比例扰动（0.6~1.5 倍）
        var t = Math.max(10, Math.round(base * (0.6 + Math.random() * 0.9)));
        // 偶发长停顿：8% 概率额外加 2~5 倍基准（模拟偶尔的犹豫）
        if (Math.random() < 0.08) t += Math.round(base * 2 + Math.random() * base * 3);
        return t;
    },

    /**
     * 主循环 tick 间隔扰动：让观察频率不完全固定。
     * @param {number} baseMs - 基准 tick（如 300）
     * @returns {number} 实际 sleep 毫秒
     */
    tickInterval: function (baseMs) {
        if (!this.enabled) return baseMs;
        return Math.max(150, Math.round(baseMs * (0.85 + Math.random() * 0.30)));
    },

    // ─── 拖拽时长 ────────────────────────────────────────────────────────────

    /**
     * 根据距离生成拟人化拖拽时长。
     * 距离越短越快，越慢越不确定（手抖）。
     * @param {number} distance - 拖拽距离（像素）
     * @param {number} base - 基准时长（默认 450ms）
     * @returns {number} 实际拖拽时长毫秒
     */
    swipeDuration: function (distance, base) {
        if (!this.enabled) return base || 450;
        var dist = Math.max(30, distance || 200);
        var speed = 0.65 + Math.random() * 0.7; // 0.65 ~ 1.35
        var distFactor = Math.max(0.4, Math.min(1.8, dist / 500));
        var result = Math.round((base || 450) * speed * distFactor);
        return Math.max(120, Math.min(900, result));
    },

    /**
     * tap 的 swipe 时长（当前 tap 是用 1px swipe 模拟的，固定 120ms）。
     * 真人按压时间 60~200ms 不等。
     * @returns {number} 实际 tap 按压毫秒
     */
    tapDuration: function () {
        if (!this.enabled) return 120;
        return Math.max(60, Math.min(200, Math.round(80 + Math.random() * 100)));
    }
};

module.exports = humanize;
