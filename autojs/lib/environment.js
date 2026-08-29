/* Runtime environment inspection.
 *
 * This module deliberately keeps the compatibility decision separate from
 * vision. A frame can have the expected pixel size while the Android runtime,
 * input path, or storage path is still different on another device.
 */

var DEFAULT_EXPECTED = { width: 1280, height: 720, aspectTolerance: 0.015 };

function finite(value) {
    return typeof value === "number" && isFinite(value) ? value : null;
}

function text(value) {
    if (value == null) return null;
    try { return String(value); } catch (_) { return null; }
}

function frameSize(frame) {
    if (!frame) return { width: null, height: null };
    try {
        return { width: finite(Number(frame.getWidth())), height: finite(Number(frame.getHeight())) };
    } catch (_) { return { width: null, height: null }; }
}

function safeCall(fn, fallback) {
    try { return fn(); } catch (_) { return fallback; }
}

function readDisplayMetrics() {
    if (typeof context === "undefined" || !context.getResources) return null;
    return safeCall(function () {
        var metrics = context.getResources().getDisplayMetrics();
        return {
            density: finite(Number(metrics.density)),
            densityDpi: finite(Number(metrics.densityDpi)),
            scaledDensity: finite(Number(metrics.scaledDensity)),
            xdpi: finite(Number(metrics.xdpi)),
            ydpi: finite(Number(metrics.ydpi))
        };
    }, null);
}

function readDevice() {
    var build = null;
    if (typeof android !== "undefined" && android.os && android.os.Build) build = android.os.Build;
    var version = build && build.VERSION ? build.VERSION : null;
    var result = {
        manufacturer: text(build && build.MANUFACTURER),
        brand: text(build && build.BRAND),
        model: text(build && build.MODEL),
        device: text(build && build.DEVICE),
        product: text(build && build.PRODUCT),
        release: text(version && version.RELEASE),
        sdkInt: version ? finite(Number(version.SDK_INT)) : null
    };
    if (typeof device !== "undefined") {
        result.reportedWidth = safeCall(function () { return finite(Number(device.width)); }, null);
        result.reportedHeight = safeCall(function () { return finite(Number(device.height)); }, null);
    }
    result.displayMetrics = readDisplayMetrics();
    return result;
}

function probeRoot() {
    if (typeof java === "undefined" || !java.lang || !java.lang.Runtime) {
        return { available: false, reason: "java-runtime-unavailable" };
    }
    var process = null;
    try {
        process = java.lang.Runtime.getRuntime().exec(["su", "-c", "id"]);
        var reader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream()));
        var lines = [], line;
        while ((line = reader.readLine()) !== null) lines.push(String(line));
        var exitCode = process.waitFor();
        var output = lines.join(" ");
        return {
            available: exitCode === 0 && /uid=0\b/.test(output),
            exitCode: Number(exitCode),
            identity: output ? output.slice(0, 160) : null,
            reason: exitCode === 0 && /uid=0\b/.test(output) ? null : "su-not-root"
        };
    } catch (error) {
        try { if (process) process.destroy(); } catch (_) {}
        return { available: false, reason: "su-probe-failed", detail: String(error).slice(0, 240) };
    }
}

function readRuntime() {
    var current = safeCall(function () {
        return typeof currentPackage === "function" ? text(currentPackage()) : null;
    }, null);
    var packageName = safeCall(function () {
        return typeof context !== "undefined" && context.getPackageName ? text(context.getPackageName()) : null;
    }, null);
    return {
        packageName: packageName,
        currentPackage: current,
        cwd: safeCall(function () { return typeof files !== "undefined" && files.cwd ? text(files.cwd()) : null; }, null),
        rootInput: probeRoot(),
        inputMethod: "su -c sh + input touchscreen"
    };
}

function inspect(config, frame, runtime) {
    config = config || {};
    var expected = config.environment || DEFAULT_EXPECTED;
    var size = frameSize(frame);
    var width = size.width, height = size.height;
    var expectedWidth = finite(Number(expected.expectedWidth || expected.width)) || DEFAULT_EXPECTED.width;
    var expectedHeight = finite(Number(expected.expectedHeight || expected.height)) || DEFAULT_EXPECTED.height;
    var tolerance = finite(Number(expected.aspectTolerance));
    if (tolerance == null) tolerance = DEFAULT_EXPECTED.aspectTolerance;
    var aspect = width && height ? width / height : null;
    var expectedAspect = expectedWidth / expectedHeight;
    var issues = [], warnings = [];
    if (width == null || height == null) {
        issues.push({ code: "capture-unreadable", message: "无法读取截图尺寸" });
    } else {
        if (width !== expectedWidth || height !== expectedHeight) {
            issues.push({ code: "capture-size-mismatch", message: "截图为" + width + "×" + height + "，当前模板契约为" + expectedWidth + "×" + expectedHeight });
        }
        if (Math.abs(aspect - expectedAspect) > tolerance) {
            issues.push({ code: "aspect-ratio-mismatch", message: "画面比例为" + aspect.toFixed(4) + "，与横屏契约不符" });
        }
        if (width < expectedWidth || height < expectedHeight) {
            warnings.push({ code: "capture-smaller-than-baseline", message: "截图小于已校准基准，模板细节可能丢失" });
        }
    }
    runtime = runtime || {};
    var root = runtime.rootInput;
    if (root && root.available === false) {
        issues.push({ code: "root-input-unavailable", message: "su/Root 输入能力不可用，不能安全发送 Unreal 触摸事件" });
    }
    var safeForActions = issues.length === 0;
    return {
        schemaVersion: 1,
        checkedAt: new Date().toISOString(),
        expected: { width: expectedWidth, height: expectedHeight, aspect: expectedAspect, aspectTolerance: tolerance },
        capture: { width: width, height: height, aspect: aspect, exactSize: width === expectedWidth && height === expectedHeight, exactAspect: aspect != null && Math.abs(aspect - expectedAspect) <= tolerance },
        safeForActions: safeForActions,
        issues: issues,
        warnings: warnings,
        device: readDevice(),
        runtime: runtime
    };
}

function collect(config, frame, extra) {
    var runtime = readRuntime();
    var report = inspect(config, frame, runtime);
    extra = extra || {};
    Object.keys(extra).forEach(function (key) { report[key] = extra[key]; });
    return report;
}

module.exports = {
    inspect: inspect,
    collect: collect,
    frameSize: frameSize,
    _private: { readDevice: readDevice, readRuntime: readRuntime, probeRoot: probeRoot }
};
