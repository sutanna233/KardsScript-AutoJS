"ui";

// The packaged application starts here. It stores only bounded strategy
// preferences, then launches the proven automatic runner as a separate
// engine so the configuration screen stays responsive.
var userStrategy = require("./lib/user-strategy");
var STRATEGY_PATH = "/sdcard/KardsScript/user-strategy.json";
var loaded = userStrategy.read(STRATEGY_PATH);
var current = loaded.preferences;

ui.layout(
    <vertical w="*" h="*" bg="#101214">
        <horizontal h="72" padding="18 14" gravity="center_vertical" bg="#171a1d">
            <card w="40" h="40" cardCornerRadius="8dp" cardElevation="0dp" cardBackgroundColor="#25211e">
                <img id="brandIcon" w="40" h="40" src="assets/comet-assistant-icon.png" scaleType="centerCrop" />
            </card>
            <vertical marginLeft="12" layout_weight="1">
                <text text="彗星助手" textColor="#f3e4bd" textSize="22sp" textStyle="bold" />
                <text text="KARDS 自动对战控制台" textColor="#8f969c" textSize="12sp" marginTop="2" />
            </vertical>
            <text text="SAFE" textColor="#78c896" textSize="11sp" textStyle="bold" />
        </horizontal>
        <View h="1" bg="#3c3528" />
        <ScrollView w="*" h="0" layout_weight="1" fillViewport="true">
            <vertical padding="14 14 6">
                <card w="*" cardCornerRadius="12dp" cardElevation="0dp" cardBackgroundColor="#1b1f23" marginBottom="12">
                    <vertical padding="16">
                        <text text="策略档案" textColor="#c69b46" textSize="13sp" textStyle="bold" />
                        <input id="strategyName" textColor="#f4f5f6" hint="策略名称" hintTextColor="#78818a" singleLine="true" textSize="20sp" marginTop="4" />
                        <text text="仅调整行动偏好；费用颜色、目标确认和失败保护始终生效。" textColor="#9aa2aa" textSize="12sp" marginTop="8" />
                    </vertical>
                </card>
                <card w="*" cardCornerRadius="12dp" cardElevation="0dp" cardBackgroundColor="#1b1f23" marginBottom="12">
                    <vertical padding="16">
                        <text text="回合节奏" textColor="#c69b46" textSize="13sp" textStyle="bold" />
                        <radiogroup id="actionOrder" orientation="horizontal" marginTop="8">
                            <radio id="orderUnits" text="单位优先" textColor="#f4f5f6" textSize="15sp" layout_weight="1" />
                            <radio id="orderCards" text="出牌优先" textColor="#f4f5f6" textSize="15sp" layout_weight="1" />
                        </radiogroup>
                        <text text="单位优先会先攻击或推进已确认可行动的单位。" textColor="#9aa2aa" textSize="12sp" marginTop="6" />
                    </vertical>
                </card>
                <card w="*" cardCornerRadius="12dp" cardElevation="0dp" cardBackgroundColor="#1b1f23" marginBottom="12">
                    <vertical padding="16">
                        <text text="出牌规则" textColor="#c69b46" textSize="13sp" textStyle="bold" />
                        <radiogroup id="cardPreference" orientation="vertical" marginTop="8">
                            <radio id="prefConfidence" text="视觉置信度优先（推荐）" textColor="#f4f5f6" textSize="15sp" />
                            <radio id="prefHigh" text="费用高优先" textColor="#f4f5f6" textSize="15sp" />
                            <radio id="prefLow" text="费用低优先" textColor="#f4f5f6" textSize="15sp" />
                        </radiogroup>
                        <horizontal gravity="center_vertical" marginTop="8">
                            <vertical layout_weight="1">
                                <text text="压制敌方前线" textColor="#f4f5f6" textSize="15sp" />
                                <text text="无守护时优先清理前线单位" textColor="#9aa2aa" textSize="12sp" marginTop="2" />
                            </vertical>
                            <Switch id="preferFrontline" />
                        </horizontal>
                    </vertical>
                </card>
                <card w="*" cardCornerRadius="12dp" cardElevation="0dp" cardBackgroundColor="#1b1f23" marginBottom="8">
                    <vertical padding="16">
                        <text text="行动上限" textColor="#c69b46" textSize="13sp" textStyle="bold" />
                        <horizontal gravity="center_vertical" marginTop="10">
                            <text text="每回合出牌尝试" textColor="#f4f5f6" textSize="15sp" layout_weight="1" />
                            <radiogroup id="maxPlays" orientation="horizontal">
                                <radio id="plays1" text="1" textColor="#f4f5f6" />
                                <radio id="plays2" text="2" textColor="#f4f5f6" />
                                <radio id="plays3" text="3" textColor="#f4f5f6" />
                            </radiogroup>
                        </horizontal>
                        <horizontal gravity="center_vertical" marginTop="8">
                            <text text="每单位移动/攻击尝试" textColor="#f4f5f6" textSize="15sp" layout_weight="1" />
                            <radiogroup id="maxUnitActions" orientation="horizontal">
                                <radio id="unit1" text="1" textColor="#f4f5f6" />
                                <radio id="unit2" text="2" textColor="#f4f5f6" />
                                <radio id="unit3" text="3" textColor="#f4f5f6" />
                            </radiogroup>
                        </horizontal>
                    </vertical>
                </card>
                <text id="validation" textColor="#ffb4ab" textSize="13sp" margin="4 4 4 10" />
            </vertical>
        </ScrollView>
        <horizontal w="*" h="120" padding="14" bg="#171a1d">
            <vertical w="*" h="*">
            <horizontal>
                <button id="saveOnly" text="仅保存" textColor="#d7c8a1" bg="#2a3035" layout_weight="2" />
                <View w="10" />
                <button id="start" text="保存并启动自动对战" textColor="#1a1409" textStyle="bold" bg="#c69b46" layout_weight="5" />
            </horizontal>
            <text id="status" textColor="#9aa2aa" textSize="12sp" gravity="center" marginTop="8" />
            </vertical>
        </horizontal>
    </vertical>
);

function display() {
    ui.strategyName.setText(current.name);
    (current.actionOrder[0] === "PLAY_CARD" ? ui.orderCards : ui.orderUnits).setChecked(true);
    ({ HIGH_COST: ui.prefHigh, LOW_COST: ui.prefLow, VISUAL_CONFIDENCE: ui.prefConfidence }[current.cardPreference] || ui.prefConfidence).setChecked(true);
    ui.preferFrontline.setChecked(current.preferFrontlineUnits === true);
    ([ui.plays1, ui.plays2, ui.plays3][Math.max(0, current.maxCardPlaysPerTurn - 1)] || ui.plays3).setChecked(true);
    ([ui.unit1, ui.unit2, ui.unit3][Math.max(0, current.maxUnitActionAttemptsPerUnit - 1)] || ui.unit2).setChecked(true);
    ui.validation.setText(loaded.errors.length ? loaded.errors.join("\n") : "");
    ui.status.setText("配置来源：" + loaded.source);
}
function formValue() {
    var unitsFirst = ui.orderUnits.isChecked();
    var cardPreference = ui.prefHigh.isChecked() ? "HIGH_COST" : ui.prefLow.isChecked() ? "LOW_COST" : "VISUAL_CONFIDENCE";
    var maxPlays = ui.plays1.isChecked() ? 1 : ui.plays2.isChecked() ? 2 : 3;
    var maxUnitActions = ui.unit1.isChecked() ? 1 : ui.unit2.isChecked() ? 2 : 3;
    return {
        schemaVersion: 1,
        name: String(ui.strategyName.getText()),
        actionOrder: unitsFirst ? ["OPERATE_UNIT", "PLAY_CARD", "END_TURN"] : ["PLAY_CARD", "OPERATE_UNIT", "END_TURN"],
        cardPreference: cardPreference,
        preferFrontlineUnits: ui.preferFrontline.isChecked(),
        maxCardPlaysPerTurn: maxPlays,
        maxUnitActionAttemptsPerUnit: maxUnitActions
    };
}
var runner = null;
var controller = null;

function isRunning() {
    try { return runner && runner.getEngine && !runner.getEngine().isDestroyed(); }
    catch (_) { return !!runner; }
}
function setControllerState(running) {
    if (!controller) return;
    controller.state.setText(running ? "运行中" : "已停止");
    controller.action.setText(running ? "停止" : "启动");
    controller.dot.setBackgroundColor(colors.parseColor(running ? "#78c896" : "#787f87"));
}
function save() {
    var candidate = formValue(), result = userStrategy.write(STRATEGY_PATH, candidate);
    if (!result.ok) { ui.validation.setText(result.errors.join("\n")); return false; }
    current = result.preferences;
    ui.validation.setText("");
    ui.status.setText("已保存到 " + STRATEGY_PATH);
    return true;
}
function startRunner() {
    if (isRunning()) { ui.status.setText("自动对战已经在运行。"); return; }
    try {
        runner = engines.execScriptFile(files.join(files.cwd(), "auto-main.js"));
        ui.status.setText("自动对战已启动；可返回 KARDS 观察运行情况。");
        setControllerState(true);
    } catch (e) { ui.validation.setText("启动失败：" + e); }
}
function stopRunner() {
    if (!runner) { ui.status.setText("当前没有由控制台启动的脚本。"); setControllerState(false); return; }
    try {
        var engine = runner.getEngine && runner.getEngine();
        if (engine) engine.forceStop();
        ui.status.setText("自动对战已停止。");
    } catch (e) { ui.validation.setText("停止失败：" + e); }
    runner = null;
    setControllerState(false);
}
function ensureController() {
    // The standalone inrt runtime does not expose floaty permission APIs.
    // Keep the emergency overlay optional and never call those APIs here.
    return true;
}
ui.saveOnly.on("click", function () { save(); });
ui.start.on("click", function () {
    if (!save()) return;
    if (!ensureController()) return;
    startRunner();
});
display();
