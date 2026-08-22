// Two independent single-view windows avoid Auto.js6 inrt rawWindow child-layout clipping.
function attach() {
    if (typeof floaty === "undefined" || !floaty) return null;
    var pauseWindow, stopWindow;
    try {
        pauseWindow = floaty.rawWindow(
            <text id="button" text="暂停" w="100" h="48" bg="#1b1f23" textColor="#f3e4bd" textSize="14sp" textStyle="bold" gravity="center" />
        );
        stopWindow = floaty.rawWindow(
            <text id="button" text="停止" w="60" h="48" bg="#1b1f23" textColor="#ff7777" textSize="13sp" textStyle="bold" gravity="center" />
        );
    } catch (e) { return null; }
    if (!pauseWindow || !stopWindow) return null;
    global.__cometFloatingWindow = { pause: pauseWindow, stop: stopWindow };
    var statusPath = "/sdcard/AutoJs6/KardsScript/floating-controller-status.jsonl";
    function status(event, extra) {
        var item = { t: Date.now(), event: event };
        if (extra) Object.keys(extra).forEach(function (k) { item[k] = extra[k]; });
        try { files.append(statusPath, JSON.stringify(item) + "\n"); } catch (_) {}
    }
    status("overlay-attached", { width: 160, height: 48, x: 1080, y: 80, scheme: "split-single-view" });
    try { pauseWindow.setSize(100, 48); pauseWindow.setPosition(1080, 80); } catch (_) {}
    try { stopWindow.setSize(60, 48); stopWindow.setPosition(1180, 80); } catch (_) {}
    try { pauseWindow.button.setVisibility(0); stopWindow.button.setVisibility(0); } catch (_) {}
    try { if (typeof pauseWindow.setVisibility === "function") pauseWindow.setVisibility(0); } catch (_) {}
    try { if (typeof stopWindow.setVisibility === "function") stopWindow.setVisibility(0); } catch (_) {}
    try { pauseWindow.setTouchable(true); stopWindow.setTouchable(true); } catch (_) {}
    var paused = false;
    pauseWindow.button.on("click", function () {
        paused = !paused;
        global.__cometPaused = paused;
        status(paused ? "overlay-paused" : "overlay-resumed");
        pauseWindow.button.setText(paused ? "继续" : "暂停");
    });
    stopWindow.button.on("click", function () {
        global.__cometPaused = false;
        status("overlay-stopped");
        try { engines.myEngine().forceStop(); } catch (_) { exit(); }
    });
    events.on("exit", function () {
        global.__cometPaused = false;
        try { pauseWindow.close(); } catch (_) {}
        try { stopWindow.close(); } catch (_) {}
    });
    return pauseWindow;
}
module.exports = { attach: attach };
