// A small, self-owned emergency stop control for the active battle engine.
// It deliberately exposes no game action: its only operation stops this
// script, which makes it safe above a fullscreen KARDS match.
function attach() {
    // The standalone inrt runtime may expose floaty without permission
    // helpers. The overlay is optional; never let it stop the battle runner.
    if (typeof floaty === "undefined" || !floaty) return null;
    var permitted;
    try { permitted = !!floaty.checkPermission(); } catch (permissionError) { return null; }
    if (!permitted || typeof floaty.rawWindow !== "function") return null;
    var window = floaty.rawWindow(
        <frame id="stop" w="82" h="42" bg="#1b1f23">
            <horizontal padding="10 7" gravity="center_vertical">
                <View w="7" h="7" bg="#78c896" />
                <text text="停止" textColor="#f3e4bd" textSize="14sp" textStyle="bold" marginLeft="7" />
            </horizontal>
        </frame>
    );
    window.setPosition(1128, 280);
    window.setTouchable(true);
    window.stop.on("click", function () {
        try { engines.myEngine().forceStop(); } catch (_) { exit(); }
    });
    events.on("exit", function () { try { window.close(); } catch (_) {} });
    return window;
}
module.exports = { attach: attach };
