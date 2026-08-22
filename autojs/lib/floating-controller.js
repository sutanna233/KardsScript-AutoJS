// A small, self-owned pause/stop control for the active battle engine.
// The overlay deliberately exposes no game action: it only pauses, resumes,
// or stops this script, which makes it safe above a fullscreen KARDS match.
function attach() {
    if (typeof floaty === "undefined" || !floaty) return null;
    // inrt 环境可能不暴露 checkPermission；直接尝试创建窗口，失败则静默返回。
    var window;
    try {
        window = floaty.rawWindow(
            <frame id="panel" w="118" h="42" bg="#1b1f23" foreground="?attr/selectableItemBackground">
                <horizontal padding="10 7" gravity="center_vertical">
                    <View id="dot" w="7" h="7" bg="#78c896" />
                    <text id="action" text="暂停" textColor="#f3e4bd" textSize="14sp" textStyle="bold" marginLeft="7" layout_weight="1" />
                    <text id="stop" text="停" textColor="#c66" textSize="12sp" textStyle="bold" />
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
    try { window.setSize(236, 84); } catch (e) {}
    // Keep the panel fully inside the 1280x720 landscape viewport. The old
    // x=1128 position placed a 236px window partly off-screen on some inrt
    // builds and made it appear absent.
    try { window.setPosition(900, 80); } catch (e) {}
    try { if (typeof window.setVisibility === "function") window.setVisibility(0); } catch (e) {}
    try { window.setTouchable(true); } catch (e) {}
    var paused = false;
    window.action.on("click", function () {
        if (!paused) {
            global.__cometPaused = true;
            paused = true;
            window.action.setText("继续");
            window.dot.setBackgroundColor(colors.parseColor("#c69b46"));
        } else {
            global.__cometPaused = false;
            paused = false;
            window.action.setText("暂停");
            window.dot.setBackgroundColor(colors.parseColor("#78c896"));
        }
    });
    window.stop.on("click", function () {
        global.__cometPaused = false;
        try { engines.myEngine().forceStop(); } catch (_) { exit(); }
    });
    events.on("exit", function () { global.__cometPaused = false; try { window.close(); } catch (_) {} });
    return window;
}
module.exports = { attach: attach };
