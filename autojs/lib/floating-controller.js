// A small, self-owned pause/stop control for the active battle engine.
// The overlay deliberately exposes no game action: it only pauses, resumes,
// or stops this script, which makes it safe above a fullscreen KARDS match.
function attach() {
    if (typeof floaty === "undefined" || !floaty) return null;
    // inrt 环境可能不暴露 checkPermission；直接尝试创建窗口，失败则静默返回。
    var window;
    try {
        window = floaty.rawWindow(
            <frame id="panel" w="236" h="84" bg="#1b1f23" foreground="?attr/selectableItemBackground">
                <horizontal w="236" h="84" padding="10 7" gravity="center_vertical">
                    <View id="dot" w="12" h="12" bg="#78c896" />
                    <text id="action" text="暂停" textColor="#f3e4bd" textSize="18sp" textStyle="bold" marginLeft="7" w="145" h="70" gravity="center" />
                    <text id="stop" text="停止" textColor="#ff7777" textSize="16sp" w="55" h="70" gravity="center" />
                </horizontal>
            </frame>
        );
    } catch (e) { return null; }
    if (!window) return null;
    // Keep a strong engine-global reference. In packaged/inrt runs the local
    // return value is otherwise eligible for GC immediately after attach(),
    // which makes the overlay disappear even though the WindowManager entry
    // was created successfully.
    global.__cometFloatingWindow = window;
    var statusPath = "/sdcard/AutoJs6/KardsScript/floating-controller-status.jsonl";
    function status(event, extra) {
        var item = { t: Date.now(), event: event };
        if (extra) Object.keys(extra).forEach(function (k) { item[k] = extra[k]; });
        try { files.append(statusPath, JSON.stringify(item) + "\n"); } catch (_) {}
    }
    status("overlay-attached", { width: 236, height: 84, x: 900, y: 80 });
    try { window.panel.setVisibility(0); } catch (e) {}
    try { window.setSize(236, 84); } catch (e) {}
    try { window.setPosition(900, 80); } catch (e) {}
    try { if (typeof window.setVisibility === "function") window.setVisibility(0); } catch (e) {}
    try { window.setTouchable(true); } catch (e) {}
    var paused = false;
    window.action.on("click", function () {
        if (!paused) {
            global.__cometPaused = true;
            paused = true;
            status("overlay-paused");
            window.action.setText("继续");
            window.dot.setBackgroundColor(colors.parseColor("#c69b46"));
        } else {
            global.__cometPaused = false;
            paused = false;
            status("overlay-resumed");
            window.action.setText("暂停");
            window.dot.setBackgroundColor(colors.parseColor("#78c896"));
        }
    });
    window.stop.on("click", function () {
        global.__cometPaused = false;
        status("overlay-stopped");
        try { engines.myEngine().forceStop(); } catch (_) { exit(); }
    });
    events.on("exit", function () { global.__cometPaused = false; try { window.close(); } catch (_) {} });
    return window;
}
module.exports = { attach: attach };
