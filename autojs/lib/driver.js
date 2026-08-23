var domain = require("./domain");
var slots = require("./coordinates");

function create(config) {
    var waitingTrainingSelected = false, trainingActivated = false, navigationPending = null;
    var rootInputProcess = null, rootInputWriter = null;
    function allowed() { return config.mode === "automatic" && config.allowNavigation; }
    // Auto.js may report its own package while the launched Unreal surface is
    // visibly in front. Runtime only calls drivers after a positively
    // classified KARDS page, so allow that visual foreground path explicitly.
    function foreground() { return config.trustVisualForeground === true || currentPackage() === config.kardsPackage; }
    function emitAction(action) {
        if (!config || typeof config.actionLogger !== "function") return;
        try { config.actionLogger(action); } catch (ignored) {}
    }
    function openRootInputShell() {
        if (rootInputProcess && rootInputWriter) return true;
        try {
            // Keep one interactive su session for the whole Auto.js engine.
            // Spawning `su -c` for every tap/swipe makes the emulator show a
            // superuser toast over the hand on every action and adds process
            // startup latency.  A persistent shell asks once, then accepts
            // the exact same verified `input touchscreen ...` commands.
            // `su` alone is not guaranteed to attach an interactive command
            // shell on this emulator. Run an explicit sh under the one root
            // grant so stdin lines are actually executed.
            rootInputProcess = java.lang.Runtime.getRuntime().exec(["su", "-c", "sh"]);
            rootInputWriter = new java.io.BufferedWriter(
                new java.io.OutputStreamWriter(rootInputProcess.getOutputStream())
            );
            return true;
        } catch (e) {
            rootInputProcess = null;
            rootInputWriter = null;
            return false;
        }
    }
    function dispatchRootInput(command) {
        if (openRootInputShell()) {
            try {
                rootInputWriter.write(command);
                rootInputWriter.newLine();
                rootInputWriter.flush();
                return true;
            } catch (e) {
                try { rootInputProcess.destroy(); } catch (ignored) {}
                rootInputProcess = null;
                rootInputWriter = null;
                if (openRootInputShell()) {
                    try {
                        rootInputWriter.write(command);
                        rootInputWriter.newLine();
                        rootInputWriter.flush();
                        return true;
                    } catch (ignored2) {}
                }
            }
        }
        try {
            java.lang.Runtime.getRuntime().exec(["su", "-c", command]);
            return true;
        } catch (e2) {
            try { shell(command, true); return true; } catch (e3) { return false; }
        }
    }
    function touchscreenTap(x, y) {
        // KARDS is an Unreal game. Accessibility press() may report success
        // without delivering the event, while this input source is verified
        // on the target emulator.
        if (typeof shell === "function") {
            // Unreal ignored a synthetic zero-duration tap on the result
            // overlay in real-device testing. A one-pixel touchscreen swipe
            // produces the same click gesture and is accepted consistently.
            return dispatchRootInput("input touchscreen swipe " + x + " " + y + " " + (x + 1) + " " + (y + 1) + " 120");
        }
        return press(x, y, 1);
    }
    function touchscreenSwipe(from, to, duration) {
        var swipeMs = Math.max(180, Math.min(650, Math.round(duration || 420)));
        if (typeof shell === "function") {
            return dispatchRootInput("input touchscreen swipe " + from.x + " " + from.y + " " + to.x + " " + to.y + " " + swipeMs);
        }
        return swipe(from.x, from.y, to.x, to.y, swipeMs);
    }
    function tap(bounds, frame, detail) {
        if (!foreground()) return { ok: false, detail: "KARDS 不在前台" };
        if (!domain.validBounds(bounds)) return { ok: false, detail: "坐标无效" };
        var p = domain.center(bounds, frame.width, frame.height);
        return touchscreenTap(p.x, p.y) ? { ok: true, detail: detail } : { ok: false, detail: "Auto.js 手势失败" };
    }
    function tapVerifiedUi(screen, confidence, frame, ruleId, state) {
        if (!allowed()) return { ok: false, detail: "导航开关未启用" };
        if (confidence < config.minUiConfidence) return { ok: false, detail: "界面置信度不足" };
        // A navigation tap must be followed by a real screen transition.  Do
        // not fire the same tap every 750ms while Unreal is still animating;
        // abandon it after a bounded wait so a dead click cannot cascade.
        var navigationKey = screen + "/" + (ruleId || "");
        var navPace = config.navPaceMs || 1800;
        if (navigationPending && navigationPending.key === navigationKey) {
            var age = Date.now() - navigationPending.sentAt;
            if (age < navPace) return { ok: true, detail: "等待导航页面切换" };
            if (age < navPace * 2.8) return { ok: true, detail: "等待导航页面确认" };
            navigationPending = null;
            return { ok: false, detail: "导航点击后页面未切换: " + screen };
        }
        if (navigationPending && navigationPending.key !== navigationKey) navigationPending = null;
        if (screen === "MODE_MENU") {
            // 对战模式已选中（金色高亮）时，页面已展开卡组列表，应直接点第一个卡组。
            // 避免反复点击已选中的模式行导致页面不切换。
            if ((config.modeType === "casual" || config.modeType === "ranked") && state && state.versusSelected === true) {
                var deckTap = tap(slots.DECK_DEFAULT, frame, "对战模式已选中，点击第一个卡组");
                if (deckTap.ok) navigationPending = { screen: screen, key: navigationKey + "/deck", sentAt: Date.now() };
                return deckTap;
            }
            var modeSlot = config.modeType === "casual" || config.modeType === "ranked" ? slots.MODE_VERSUS : slots.MODE_TRAINING;
            var modeTap = tap(modeSlot, frame, config.modeType === "casual" || config.modeType === "ranked" ? "已在模式菜单点击对战模式" : "已在模式菜单点击训练模式");
            if (modeTap.ok) navigationPending = { screen: screen, key: navigationKey, sentAt: Date.now() };
            return modeTap;
        }
        if (screen === "SHOP" || screen === "CARD_COLLECTION") {
            var homeTap = tap(slots.HOME_BACK, frame, "从非对局页面返回主页");
            if (homeTap.ok) navigationPending = { screen: screen, key: navigationKey, sentAt: Date.now() };
            return homeTap;
        }
        if (screen === "DAILY_QUEST") {
            var dailyTap = tap(slots.DAILY_QUEST_DISMISS, frame, "已关闭每日任务弹窗");
            if (dailyTap.ok) navigationPending = { screen: screen, key: navigationKey, sentAt: Date.now() };
            return dailyTap;
        }
        if (screen === "POPUP") {
            var popupTap = tap(slots.PROMO_POPUP_CLOSE, frame, "已关闭当前促销弹窗");
            if (popupTap.ok) navigationPending = { screen: screen, key: navigationKey, sentAt: Date.now() };
            return popupTap;
        }
        // 对战卡组详情页：modeType 为 casual/ranked 时先确认切换状态再点开始。
        if (screen === "DECK_DETAIL" && (config.modeType === "casual" || config.modeType === "ranked")) {
            var toggle = state && state.deckModeToggle;
            if (toggle && toggle !== config.modeType) {
                var toggleSlot = config.modeType === "ranked" ? slots.RANKED_TOGGLE : slots.CASUAL_TOGGLE;
                var toggleTap = tap(toggleSlot, frame, "已切换至" + (config.modeType === "ranked" ? "排位" : "休闲") + "模式");
                if (toggleTap.ok) navigationPending = { screen: screen, key: navigationKey + "/toggle", sentAt: Date.now() };
                return toggleTap;
            }
            if (toggle && toggle === config.modeType) {
                var startTap = tap(slots.DECK_START_PVP, frame, "已点击对战开始按钮");
                if (startTap.ok) navigationPending = { screen: screen, key: navigationKey, sentAt: Date.now() };
                return startTap;
            }
            return { ok: false, detail: "排位/休闲选中状态未确认，暂不点开始" };
        }
        if (screen === "HOME") { waitingTrainingSelected = false; trainingActivated = false; }
        var slot = screen === "HOME" ? slots.HOME_START : screen === "DECK_LIST" ? slots.DECK_DEFAULT : screen === "DECK_DETAIL" ? slots.DECK_CONFIRM : screen === "MULLIGAN" ? slots.MULLIGAN_CONFIRM : screen === "RESULT" ? slots.RESULT_CONTINUE : screen === "RECONNECT" ? slots.RECONNECT : null;
        if (!slot) return { ok: false, detail: "当前页面无安全固定操作" };
        var completed = tap(slot, frame, "已完成已识别页面的单步操作");
        if (completed.ok) navigationPending = { screen: screen, key: navigationKey, sentAt: Date.now() };
        return completed;
    }
    function activate(source, frame) {
        if (!config.allowBattleActions) return { ok: false, detail: "战斗动作开关未启用" };
        if (!source || !source.bounds || (source.confidence || 0) < (config.minUnitActionConfidence || config.minTargetConfidence)) return { ok: false, detail: "动作源未视觉确认" };
        return tap(source.bounds, frame, "已选择视觉动作源");
    }
    function tapLegalTarget(target, frame) {
        if (!config.allowBattleActions) return { ok: false, detail: "战斗动作开关未启用" };
        if (!target || !target.legal || !target.bounds) return { ok: false, detail: "缺少当前帧视觉合法目标" };
        if ((target.confidence || 0) < config.minTargetConfidence) return { ok: false, detail: "合法目标置信度不足" };
        return tap(target.bounds, frame, "已点击当前帧视觉合法目标");
    }
    function dragUnit(source, target, frame) {
        if (!config.allowBattleActions) return { ok: false, detail: "战斗动作开关未启用" };
        if (!source || !source.bounds || (source.confidence || 0) < (config.minUnitActionConfidence || config.minTargetConfidence)) return { ok: false, detail: "单位未视觉确认" };
        var minTarget = target && target.direct ? (config.minUnitActionConfidence || config.minTargetConfidence) : config.minTargetConfidence;
        if (!target || !target.legal || !target.bounds || (target.confidence || 0) < minTarget) return { ok: false, detail: "攻击目标未视觉确认" };
        if (!foreground()) return { ok: false, detail: "KARDS 不在前台" };
        var from = domain.center(source.bounds, frame.width, frame.height), to = domain.center(target.bounds, frame.width, frame.height);
        var distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        var duration = config.unitDragDurationMs || Math.max(350, Math.min(800, Math.round(distance / 2.5)));
        var sent = touchscreenSwipe(from, to, duration);
        if (sent) emitAction({ kind: target.kind === "FRIENDLY_UNIT" ? "MOVE_UNIT" : "ATTACK_UNIT",
            sourceId: source.id || null, targetId: target.id || null,
            from: [from.x, from.y], to: [to.x, to.y], durationMs: duration,
            sourceConfidence: source.confidence || 0, targetConfidence: target.confidence || 0 });
        return sent ? { ok: true, detail: "已拖动单位攻击/移动至合法目标" } : { ok: false, detail: "单位拖动失败" };
    }
    function playCard(source, slotOrIndex, frame, state, sourceAttempt) {
        // KARDS uses a free deployment area rather than a tappable fixed slot.
        if (config.allowBattleActions && source && source.bounds && frame && foreground()) {
            var width = frame.width, height = frame.height;
            var configured = (config.deploymentSlots || []).filter(function (slot) { return slot && domain.validBounds(slot.bounds); });
            var selectedSlot = slotOrIndex && typeof slotOrIndex === "object" ? slotOrIndex : configured[Number(slotOrIndex || 0) % Math.max(1, configured.length)];
            if (!selectedSlot || !domain.validBounds(selectedSlot.bounds)) return { ok: false, detail: "没有配置部署位置" };
            // Runtime has already selected an unoccupied concrete slot. Keep
            // that exact index here; filtering the array a second time changed
            // index 2 into index 0 and sent cards to a different lane.
            var toDynamic = domain.center(selectedSlot.bounds, width, height), fromDynamic = domain.center(source.bounds, width, height);
            // Bottom fan cards overlap heavily. Their rectangle centre is at
            // y~=690, where the neighbour/card-frame can steal the gesture.
            // The accepted real-device drag starts near y=674. Retry through
            // a few points in the same exposed strip before concluding that
            // the orange card itself cannot be deployed.
            if (source.bounds[1] >= 0.85) {
                var sourceOffsets = [14, 28, 42];
                var sourceTop = Math.round(source.bounds[1] * height);
                fromDynamic.y = Math.min(height - 2, sourceTop + sourceOffsets[Number(sourceAttempt || 0) % sourceOffsets.length]);
            }
            var distDynamic = Math.sqrt(Math.pow(toDynamic.x - fromDynamic.x, 2) + Math.pow(toDynamic.y - fromDynamic.y, 2));
            var durationDynamic = Math.max(300, Math.min(600, Math.round(distDynamic / 3)));
            var dynamicSent = touchscreenSwipe(fromDynamic, toDynamic, durationDynamic);
            if (dynamicSent) emitAction({ kind: "PLAY_CARD", sourceId: source.id || null,
                targetId: selectedSlot.id || null, from: [fromDynamic.x, fromDynamic.y],
                to: [toDynamic.x, toDynamic.y], durationMs: durationDynamic,
                sourceAttempt: Number(sourceAttempt || 0), sourceConfidence: source.confidence || 0,
                playConfidence: source.playConfidence || 0 });
            return dynamicSent ? { ok: true, detail: "已拖牌至己方自由部署区域 " + selectedSlot.id } : { ok: false, detail: "出牌拖拽失败" };
        }
        if (!config.allowBattleActions) return { ok: false, detail: "战斗动作开关未启用" };
        if (!source || !source.bounds || (source.confidence || 0) < config.minTargetConfidence) return { ok: false, detail: "手牌未视觉确认" };
        var slotsForPlay = config.deploymentSlots || [];
        if (!slotsForPlay.length) return { ok: false, detail: "没有配置部署位置" };
        // 优化：轮询选择部署位置，而不是固定使用 slotIndex
        var slot = slotOrIndex && typeof slotOrIndex === "object" ? slotOrIndex : slotsForPlay[Number(slotOrIndex || 0) % slotsForPlay.length];
        if (!slot || !domain.validBounds(slot.bounds)) return { ok: false, detail: "部署位置无效" };
        var from = domain.center(source.bounds, frame.width, frame.height), to = domain.center(slot.bounds, frame.width, frame.height);
        // 优化：根据距离调整拖拽时间
        var distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        var duration = Math.max(300, Math.min(600, Math.round(distance / 3)));  // 300-600ms
        var sent = touchscreenSwipe(from, to, duration);
        if (sent) emitAction({ kind: "PLAY_CARD", sourceId: source.id || null, targetId: slot.id || null,
            from: [from.x, from.y], to: [to.x, to.y], durationMs: duration,
            sourceAttempt: Number(sourceAttempt || 0), sourceConfidence: source.confidence || 0,
            playConfidence: source.playConfidence || 0 });
        return sent ? { ok: true, detail: "已拖拽手牌至友方部署位 " + slot.id + " (距离:" + Math.round(distance) + "px, 时间:" + duration + "ms)" } : { ok: false, detail: "出牌拖拽失败" };
    }
    function dragCard(source, target, frame) {
        if (!config.allowBattleActions) return { ok: false, detail: "战斗动作开关未启用" };
        if (!source || !source.bounds || (source.confidence || 0) < config.minTargetConfidence) return { ok: false, detail: "手牌未视觉确认" };
        if (!target || !target.legal || target.kind !== "FRIENDLY_UNIT" || !target.bounds || (target.confidence || 0) < config.minTargetConfidence) return { ok: false, detail: "未检测到合法部署位" };
        if (!foreground()) return { ok: false, detail: "KARDS 不在前台" };
        var from = domain.center(source.bounds, frame.width, frame.height), to = domain.center(target.bounds, frame.width, frame.height);
        var distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        var duration = Math.max(300, Math.min(650, Math.round(distance / 3)));
        return touchscreenSwipe(from, to, duration) ? { ok: true, detail: "已拖拽手牌至部署区域 " + target.id } : { ok: false, detail: "出牌拖拽失败" };
    }
    function endTurn(observation, frame) {
        if (!config.allowBattleActions) return { ok: false, detail: "战斗动作开关未启用" };
        var target = (observation.legalTargets || []).filter(function (t) { return t.kind === "END_TURN" && t.legal; })[0];
        var bounds = target ? target.bounds : slots.END_TURN;
        var result = target ? tapLegalTarget(target, frame) : tap(bounds, frame, "已结束回合");
        if (result.ok && domain.validBounds(bounds)) {
            var p = domain.center(bounds, frame.width, frame.height);
            emitAction({ kind: "END_TURN", sourceId: null, targetId: target ? target.id : "end-turn",
                from: [p.x, p.y], to: [p.x + 1, p.y + 1], durationMs: 120,
                targetConfidence: target ? (target.confidence || 0) : 1 });
        }
        return result;
    }
    // 启动恢复路径：无需模板识别，直接向已知弹窗关闭区域发送安全点击。
    // bounds 为归一化坐标；仅在 runtime 的启动恢复分支中调用。
    function dismissPopup(bounds, frame) {
        if (!allowed()) return { ok: false, detail: "导航开关未启用" };
        if (!domain.validBounds(bounds)) return { ok: false, detail: "坐标无效" };
        var p = domain.center(bounds, frame.width, frame.height);
        return touchscreenTap(p.x, p.y) ? { ok: true, detail: "已点击弹窗关闭区域" } : { ok: false, detail: "弹窗关闭点击失败" };
    }
    return { tapVerifiedUi: tapVerifiedUi, activate: activate, tapLegalTarget: tapLegalTarget, dragUnit: dragUnit, playCard: playCard, dragCard: dragCard, endTurn: endTurn, dismissPopup: dismissPopup };
}
module.exports.create = create;
