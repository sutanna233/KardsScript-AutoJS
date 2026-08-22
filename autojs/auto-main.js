// Explicit automatic entrypoint. Keep this self-contained: Auto.js module
// caching can otherwise make a wrapper's config mutations unreliable.
var base = require("./lib/config");
var vision = require("./lib/vision");
var runtime = require("./lib/runtime");
var userStrategy = require("./lib/user-strategy");
var floatingController = require("./lib/floating-controller");
var config = {};
Object.keys(base).forEach(function (key) { config[key] = base[key]; });
config.mode = "automatic";
config.allowNavigation = true;
config.allowBattleActions = true;
config.requireCostBadge = true;
// Affordability comes from the orange/grey badge. Skip per-card OCR in the
// timed turn loop; it remains available in observe/replay mode for diagnostics.
config.readCardCosts = false;
// The game's orange cost badge is the complete live permission to play the
// card. Do not spend several seconds opening/scanning card types, and do not
// reject an affordable card merely because its type is UNKNOWN.
config.readHandTypes = false;
config.requireUnitTypeForDeployment = false;
config.trustVisualForeground = true;
// The standalone APK and launcher share this user-editable strategy file.
config.userStrategyPath = "/sdcard/KardsScript/user-strategy.json";
var loadedUserStrategy = userStrategy.read(config.userStrategyPath);
var activeUserStrategy = userStrategy.apply(config, loadedUserStrategy.preferences);
var out = "/sdcard/AutoJs6/KardsScript/auto-main-log.jsonl";
var overlayStatus = "/sdcard/AutoJs6/KardsScript/floating-controller-status.jsonl";
var runId = String(Date.now());
var archiveDir = "/sdcard/AutoJs6/KardsScript/runs";
var archive = archiveDir + "/games-" + runId + ".jsonl";
try { files.ensureDir(archiveDir); } catch (e0) {}
files.write(out, "");
try { files.write(overlayStatus, ""); } catch (eOverlayLog) {}
function record(item) { files.append(out, JSON.stringify(item) + "\n"); }
function localBadgeColor(image, card, index, count) {
    var box = card && (card.costBounds || card.bounds);
    if (!image || !card || !box || !image.pixel) return { orange: false, score: 0 };
    var w = image.getWidth(), h = image.getHeight(), left = box[0] * w, top = box[1] * h, best = 0;
    var isCostBox = (box[2] - box[0]) <= 0.06 && (box[3] - box[1]) <= 0.08;
    var xo = isCostBox ? [0] : (count >= 6 ? [-48, -36, -24, -12, 0] : [-36, -24, -12, 0]);
    var yo = isCostBox ? [0] : (count >= 6 ? [0, 14, 28, 42] : [0, 18, 36]);
    xo.forEach(function (dx) { yo.forEach(function (dy) {
        var n = 0, hit = 0, x0 = Math.max(0, Math.floor(left + dx)), y0 = Math.max(0, Math.floor(top + dy));
        var x1 = isCostBox ? Math.min(w, Math.ceil(box[2] * w)) : Math.min(w, x0 + 34);
        var y1 = isCostBox ? Math.min(h, Math.ceil(box[3] * h)) : Math.min(h, y0 + 30);
        for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) {
            var c = image.pixel(x, y), r = (c >>> 16) & 255, g = (c >>> 8) & 255, b = c & 255; n++;
            if (r >= 105 && r - g >= 22 && g - b >= 12) hit++;
        }
        if (n) best = Math.max(best, hit / n);
    }); });
    return { orange: best >= 0.20, score: best };
}
// The production path uses shell touchscreen input and does not require the
// accessibility service; do not call auto.waitFor(), which can show a
// blocking privilege prompt over the timed mulligan/turn UI.
// Request capture before bringing KARDS to the foreground.  If KARDS is
// launched first, Auto.js' capture/privilege prompt can cover the mulligan
// confirmation button while the game continues its countdown.
if (!requestScreenCapture(true)) { record({ error: "capture-permission" }); exit(); }
try { floatingController.attach(); } catch (controllerError) { record({ warning: "floating-controller", error: String(controllerError) }); }
sleep(1200);
if (typeof app !== "undefined" && app.launchPackage) {
    try { app.launchPackage(config.kardsPackage); sleep(1000); }
    catch (e) { record({ error: "launch", detail: String(e) }); }
}
// Keep the action loop responsive enough for timed casual-mode turns while
// retaining the runtime's two-frame hand stability and navigation guards.
// Shorter polling keeps actions responsive while the runtime still guards
// every action with stable-frame and pending-action checks.
config.tickMs = 300;
// A training opponent may spend several minutes resolving a passive board;
// do not abort a valid BATTLE frame after the short navigation watchdog.
config.maxSameSceneFrames = 2000;
// 挂机模式默认持续运行；显式 targetGames 仅用于有界测试。
var targetGames = config.targetGames == null ? Infinity : Math.max(1, Number(config.targetGames));
var started = Date.now(), bot = null, restartCount = 0, consecutiveRecoveries = 0, completedGames = 0,
    gamePhase = "IDLE", gameSessionId = null,
    observedBattleForCurrentGame = false, observedMulliganForCurrentGame = false,
    sawSetupScreen = false, resumedCurrentGame = false;
config.actionLogger = function (action) {
    record({ t: Date.now() - started, event: "driver-action", action: action });
};
record({ event: "run-start", runId: runId, targetGames: targetGames, requireMulligan: true,
    userStrategy: activeUserStrategy, userStrategySource: loadedUserStrategy.source,
    userStrategyErrors: loadedUserStrategy.errors });
// A real training match can exceed several minutes; keep the entrypoint alive
// indefinitely for hangup use. Runtime-level safety guards still stop a
// genuinely unrecoverable session and the outer loop starts the next game.
while (completedGames < targetGames) {
    var analyzer = vision.create(config);
    bot = runtime.create(config);
    var lastKey = "", lastStatus = "", lastBattleEvidence = "", frameNumber = 0;
    while (!bot.stopped() && completedGames < targetGames) {
        // 悬浮窗暂停：设置 __cometPaused 后跳过识别/决策/动作，仅等待。
        if (global.__cometPaused === true) { sleep(500); continue; }
        // A card play must keep the full hand geometry path enabled so the
        // post-action count is comparable with the pre-action count.  The
        // old fast path reported the raw six-card fan while the normal path
        // had refined it to eight, creating a permanent false-success loop.
        var pendingKind = bot.pendingAction && bot.pendingAction();
        config.fastPending = !!pendingKind && pendingKind !== "PLAY_CARD";
        var frame = captureScreen(), observeStarted = Date.now(), observation = analyzer.observe(frame), observeMs = Date.now() - observeStarted;
        frameNumber++;
        if (frameNumber === 1 || frameNumber % 10 === 0) record({ t: Date.now() - started, performance: true, frame: frameNumber, observeMs: observeMs });
        // In automatic mode the orange/grey badge is the authoritative live
        // affordability signal. Normalize any cached/OCR branch back to it
        // before the decision tree and runtime inspect the hand.
        if (observation && observation.state && observation.state.hand) {
            observation.state.hand.forEach(function (card) {
                if (card.costBadge && typeof card.costBadge.orange === "boolean") {
                    card.costBadgeOrange = card.costBadge.orange === true;
                    card.playable = card.costBadgeOrange;
                }
            });
        }
        observation.frame = { width: observation.width, height: observation.height };
        // Vision owns the single badge-colour decision. Do not overwrite it
        // with a second, less-calibrated scan at this boundary.
        var key = observation.uiScreen.screen + "/" + observation.scene.scene;
        if (observeMs > 1200) record({ t: Date.now() - started, event: "vision-slow-frame", observeMs: observeMs, screen: observation.uiScreen.screen, scene: observation.scene.scene });
        if (key !== lastKey) {
            var nextPhase = observation.uiScreen.screen === "RESULT" ? "RESULT" :
                observation.uiScreen.screen === "BATTLE" ? "IN_GAME" :
                ["HOME", "MODE_MENU", "DECK_LIST", "DECK_DETAIL", "MULLIGAN"].indexOf(observation.uiScreen.screen) >= 0 ? "SETUP" :
                observation.uiScreen.screen === "RECONNECT" ? "RECOVERING" : gamePhase;
            if (nextPhase !== gamePhase) {
                gamePhase = nextPhase;
                record({ t: Date.now() - started, event: "phase-changed", phase: gamePhase, screen: observation.uiScreen.screen });
            }
            if (observation.uiScreen.screen === "MULLIGAN" && !gameSessionId) {
                gameSessionId = runId + "-" + (completedGames + 1);
                record({ t: Date.now() - started, event: "game-started", gameSessionId: gameSessionId });
            }
            record({ t: Date.now() - started, screen: observation.uiScreen.screen,
                rule: observation.uiScreen.ruleId, scene: observation.scene.scene,
                confidence: observation.uiScreen.confidence, endTurnOnly: observation.scene.endTurnOnly === true });
            if (observation.uiScreen.screen === "MULLIGAN") observedMulliganForCurrentGame = true;
            if (["HOME", "MODE_MENU", "DECK_LIST", "DECK_DETAIL", "MULLIGAN"].indexOf(observation.uiScreen.screen) >= 0) {
                sawSetupScreen = true;
            }
            // Auto.js may be restarted while a real match is already open
            // (for example after a bounded diagnostic stop). Resume that
            // match explicitly instead of forcing a surrender/requeue. Keep
            // the audit honest by recording that this process did not see
            // the mulligan itself.
            if (observation.uiScreen.screen === "BATTLE" && !sawSetupScreen && !observedMulliganForCurrentGame && !resumedCurrentGame) {
                resumedCurrentGame = true;
                observedBattleForCurrentGame = true;
                record({ t: Date.now() - started, event: "resumed-current-game" });
            }
            if (observation.uiScreen.screen === "BATTLE" && observedMulliganForCurrentGame) observedBattleForCurrentGame = true;
            if (observation.uiScreen.screen === "RESULT" && observedBattleForCurrentGame && (observedMulliganForCurrentGame || resumedCurrentGame)) {
                completedGames++;
                record({ t: Date.now() - started, event: "game-complete", game: completedGames, gameSessionId: gameSessionId, resultRule: observation.uiScreen.ruleId });
                consecutiveRecoveries = 0;
                gamePhase = "RESULT";
                gameSessionId = null;
                observedBattleForCurrentGame = false;
                observedMulliganForCurrentGame = false;
                resumedCurrentGame = false;
                // Do not click through the third result screen. Keeping that
                // frame visible makes the completion evidence auditable.
                if (completedGames >= targetGames) { bot.stop(); lastKey = key; break; }
            } else if (observation.uiScreen.screen === "RESULT") {
                record({ t: Date.now() - started, event: "preexisting-result-ignored", resultRule: observation.uiScreen.ruleId });
            }
            lastKey = key;
        }
        // Keep compact battle-state evidence separate from status messages so
        // a live run can prove whether an attack source/target was actually
        // visible, without drawing a console/toast overlay over the hand.
        if (observation.uiScreen.screen === "BATTLE") {
            var units = observation.state.units || [];
            var unitIds = units.map(function (u) {
                return u.id + ":" + u.owner + ":" + (u.isFrontline ? "F" : "R") + ":" + (u.canOperate ? "O" : "-");
            }).join(",");
            var targetIds = (observation.legalTargets || []).map(function (t) {
                return t.id + ":" + (t.isGuard ? "G" : "-") + ":" + (t.isFrontline ? "F" : "R");
            }).join(",");
            var handCostKey = (observation.state.hand || []).map(function (c) {
                return c.cost == null ? "?" : String(c.cost) + (c.playable ? "!" : "-") + (c.costBadge && c.costBadge.orange ? "O" : "G");
            }).join(",");
            var appearanceKey = (observation.state.hand || []).map(function (c) {
                return (c.rarity || "UNKNOWN") + ":" + (c.foil || "UNKNOWN");
            }).join(",");
            var evidence = observation.scene.scene + "/" + observation.state.credits + "/" +
                handCostKey + "/" + appearanceKey + "/" + unitIds + "/" + targetIds;
            if (evidence !== lastBattleEvidence) {
                record({ t: Date.now() - started, battleEvidence: true,
                    scene: observation.scene.scene, credits: observation.state.credits,
                    hand: (observation.state.hand || []).map(function (c) {
                        return { id: c.id, cost: c.cost, playable: c.playable === true,
                            type: c.type || "UNKNOWN",
                            rarity: c.rarity || "UNKNOWN",
                            foil: c.foil || "UNKNOWN",
                            badgePresent: !!c.costBadge || c.costBadgeOrange === true, badgeOrangeType: c.costBadge ? typeof c.costBadge.orange : typeof c.costBadgeOrange,
                            costBadgeOrange: !!(c.costBadge && c.costBadge.orange),
                            costBadgeScore: c.costBadge ? c.costBadge.score : 0,
                            playConfidence: typeof c.playConfidence === "number" ? c.playConfidence : 0 };
                    }), units: units,
                    legalTargets: observation.legalTargets || [],
                    enemyGuardMarkerCount: observation.evidence ? observation.evidence.enemyGuardMarkerCount : 0 });
                lastBattleEvidence = evidence;
            }
        }
        try { bot.tick(observation); }
        catch (e) {
            record({ error: "tick", detail: String(e), t: Date.now() - started });
            bot.stop();
            break;
        }
        var status = bot.status();
        if (status.last && status.last !== lastStatus) {
            record({ t: Date.now() - started, status: status });
            lastStatus = status.last;
        }
        // Release the native screenshot bitmap before the next timed frame;
        // otherwise repeated captureScreen() calls eventually stall the
        // Auto.js image pipeline during long matches.
        try { if (frame && frame.recycle) frame.recycle(); } catch (eRecycle) {}
        var nextTick = observation.uiScreen.screen === "BATTLE" && observation.scene.scene === "OUR_TURN" ? 300 :
            observation.scene.scene === "OPPONENT_TURN" ? 900 :
            ["RESULT", "HOME", "MODE_MENU", "DECK_LIST", "DECK_DETAIL", "MULLIGAN"].indexOf(observation.uiScreen.screen) >= 0 ? 650 : 500;
        if (observeMs > 1200) nextTick = Math.max(nextTick, 700);
        sleep(nextTick);
    }
    var finalStatus = bot.status();
    var recoverable = /超时|场景长时间未变化|连续动作失败/.test(finalStatus.last || "");
    // Hangup mode must not stop permanently after three recoverable errors.
    // Use bounded exponential backoff and only stop after a long streak.
    if (!bot.stopped() || !recoverable || consecutiveRecoveries >= 12) break;
    consecutiveRecoveries++;
    restartCount++;
    var recoveryDelay = Math.min(60000, 3000 * Math.pow(2, Math.min(4, consecutiveRecoveries - 1)));
    record({ t: Date.now() - started, recovery: "restart-after-runtime-stop", count: restartCount,
        consecutive: consecutiveRecoveries, delayMs: recoveryDelay, status: finalStatus });
    sleep(recoveryDelay);
    if (typeof app !== "undefined" && app.launchPackage) {
        try { app.launchPackage(config.kardsPackage); sleep(1500); } catch (e2) { record({ error: "recovery-launch", detail: String(e2) }); }
    }
}
record({ done: true, stopped: bot ? bot.stopped() : true, elapsed: Date.now() - started,
    restarts: restartCount, completedGames: completedGames, targetGames: targetGames,
    resumedCurrentGame: resumedCurrentGame, status: bot ? bot.status() : null, archive: archive });
try { files.copy(out, archive); } catch (e3) { record({ error: "archive", detail: String(e3) }); }
