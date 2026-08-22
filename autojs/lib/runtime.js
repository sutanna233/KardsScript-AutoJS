var domain = require("./domain");
var strategy = require("./strategy");
var driverModule = require("./driver");

module.exports.create = function (config) {
    var stopped = false, last = "", same = 0, signature = "", pending = null, failures = 0, endTurnRequestedAt = 0, deploymentCursor = 0, failedDeploymentSlots = {}, skippedCardPlay = false, handSignature = "", handStable = 0, blockedCardIds = {}, blockedUnitIds = {}, blockedUnitBounds = {}, unitActionRetries = {}, unitAttempts = 0, playAttempts = 0, opponentTurnSince = 0;
    var driver = driverModule.create(config);
    var planner = strategy.create(config);
    // Auto.js6 also surfaces console output as an on-screen overlay.  Any
    // runtime message therefore obscures the bottom hand and invalidates fee
    // OCR.  Retain only the last status in memory while automatic play runs.
    function log(message) { if (message !== last) last = message; }
    function source(state, id) { return (state.hand || []).concat(state.units || []).filter(function (item) { return item.id === id; })[0] || null; }
    function overlaps(a, b) {
        return a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    }
    function blockUnit(id, bounds) {
        if (!id) return;
        var key = String(id);
        blockedUnitIds[key] = true;
        if (bounds) blockedUnitBounds[key] = bounds.slice ? bounds.slice() : bounds;
    }
    function boundsMoved(a, b) {
        if (!a || !b) return false;
        var acx = (a[0] + a[2]) / 2, acy = (a[1] + a[3]) / 2;
        var bcx = (b[0] + b[2]) / 2, bcy = (b[1] + b[3]) / 2;
        return Math.abs(acx - bcx) > 0.035 || Math.abs(acy - bcy) > 0.04;
    }
    function reconcileBlockedUnits(state) {
        (state.units || []).forEach(function (unit) {
            var key = String(unit.id);
            if (unit.owner !== "PLAYER" || !blockedUnitIds[key]) return;
            // Dynamic formation ids can be reassigned after another card
            // moves/dies. A materially different centre is a different
            // physical source and must not inherit the previous block.
            if (boundsMoved(blockedUnitBounds[key], unit.bounds)) {
                delete blockedUnitIds[key];
                delete blockedUnitBounds[key];
            }
        });
    }
    function deploymentSlots(state) {
        var live = (config._activeUnitSlots || []).filter(function (slot) {
            return slot && slot.owner === "PLAYER" && slot.isFrontline !== true && slot.bounds;
        });
        return live.length ? live : (config.deploymentSlots || []);
    }
    function freeDeploymentIndex(state) {
        var slots = deploymentSlots(state), units = (state.units || []).filter(function (u) { return u.owner === "PLAYER"; });
        for (var offset = 0; offset < slots.length; offset++) {
            var i = (deploymentCursor + offset) % slots.length;
            if (failedDeploymentSlots[slots[i].id]) continue;
            var occupied = units.some(function (u) { return overlaps(slots[i].bounds, u.bounds); });
            if (!occupied) return i;
        }
        return -1;
    }
    function sharedFrontlineTarget(state) {
        // KARDS exposes one shared frontline band, not a set of source-aligned
        // deployment cells. The failed live run mirrored a rear source at
        // x=826 into a fictitious player-front-right-3 destination. Release
        // on the measured divider instead and let the game arrange the card.
        var height = Number(state && state.frameHeight) || 720;
        var measuredY = Number(state && state.frontlineY);
        var owner = String(state && state.frontlineOwner || "UNKNOWN");
        // While neutral, the divider itself is the empty shared row. After
        // the player captures it, that divider moves upward (live y≈264) but
        // the unit row remains around y≈342. Releasing on the moved divider
        // sent the card too far into enemy territory and was rejected.
        var cy = owner === "PLAYER" ? 0.475 :
            (isFinite(measuredY) && measuredY > 0 ? measuredY / height : 0.49);
        cy = Math.max(0.40, Math.min(0.56, cy));
        var frontlineUnits = (state.units || []).filter(function (unit) {
            return unit && unit.isFrontline === true && unit.bounds;
        });
        // Prefer the board centre. If a real frontline card already covers
        // that point, move sideways within the same measured band; these are
        // release points, not invented card slots.
        // Ownership itself proves that at least one friendly card occupies
        // the row even when a transition frame misses its unit rectangle.
        // In that case avoid the likely central incumbent first.
        var candidates = owner === "PLAYER" ? [0.385, 0.615, 0.27, 0.73, 0.50] : [0.50, 0.385, 0.615, 0.27, 0.73];
        for (var i = 0; i < candidates.length; i++) {
            var bounds = [candidates[i] - 0.025, cy - 0.04, candidates[i] + 0.025, cy + 0.04];
            if (!frontlineUnits.some(function (unit) { return overlaps(bounds, unit.bounds); })) {
                return { id: "player-frontline-zone", kind: "FRIENDLY_UNIT", legal: true,
                    bounds: bounds, confidence: 0.90, isFrontline: true, threat: 0 };
            }
        }
        return null;
    }
    function frontlineChanged(beforeBounds, currentUnits) {
        var before = beforeBounds || [];
        var current = (currentUnits || []).filter(function (unit) {
            return unit.owner === "PLAYER" && unit.isFrontline === true && unit.bounds;
        });
        if (current.length > before.length) return true;
        return current.some(function (unit) {
            return !before.some(function (bounds) { return !boundsMoved(bounds, unit.bounds); });
        });
    }
    function fallbackAttackTargets(state, observation) {
        var out = [];
        (state.units || []).forEach(function (u) {
            if (u.owner !== "ENEMY") return;
            out.push({ id: u.id, kind: "ENEMY_UNIT", legal: true, direct: true,
                bounds: u.bounds, confidence: Math.min(0.75, u.confidence || 0.6),
                isGuard: u.isGuard === true, isFrontline: u.isFrontline === true,
                threat: u.threat || 0, type: u.type || "UNKNOWN" });
        });
        var hq = (observation.legalTargets || []).filter(function (t) { return t.kind === "ENEMY_HQ"; })[0];
        if (hq) out.push(hq);
        return out;
    }
    function fail(result) { failures++; log(result.detail || "动作失败"); if (failures >= config.maxConsecutiveFailures) { stopped = true; log("连续动作失败，已停止"); } }
    function effectiveUnitType(unit) {
        var type = String(unit && unit.type || "UNKNOWN").toUpperCase();
        // User-confirmed temporary rule: an unrecognised board unit follows
        // infantry movement semantics. This applies only to units already on
        // the board; it is not used to guess a hand card's deployment type.
        return type === "UNKNOWN" ? "INFANTRY" : type;
    }
    function frontlineAttackPlan(observation) {
        var frontlineOwner = observation.state && observation.state.frontlineOwner;
        var enemyFrontlineVisible = (observation.legalTargets || []).some(function (t) {
            return t.legal && t.kind === "ENEMY_UNIT" && t.isFrontline === true;
        });
        var units = (observation.state && observation.state.units || []).filter(function (u) {
            // If the opponent owns the frontline, a ready rear unit is still
            // allowed to attack a confirmed enemy frontline target. This is
            // the game's contest-the-line action; do not redirect it to the
            // neutral shared-frontline release band first.
            var groundType = ["TANK", "INFANTRY"].indexOf(effectiveUnitType(u)) >= 0;
            return u.owner === "PLAYER" && u.canOperate &&
                // Ground units in the rear cannot attack merely because the
                // opponent controls the frontline. They must either already
                // be on our frontline, or have a confirmed enemy frontline
                // target visible in this frame.
                (u.isFrontline === true || (enemyFrontlineVisible && groundType) ||
                    (!groundType && frontlineOwner === "ENEMY")) &&
                blockedUnitIds[String(u.id)] !== true;
        });
        var targets = (observation.legalTargets || []).filter(function (t) {
            return t.legal && (t.kind === "ENEMY_UNIT" || t.kind === "ENEMY_HQ") &&
                (t.kind === "ENEMY_HQ" || t.isFrontline === true || !enemyFrontlineVisible);
        });
        if (!units.length || !targets.length) return null;
        units.sort(function (a, b) { return (b.attack || 0) - (a.attack || 0); });
        return { kind: domain.Action.ATTACK, sourceId: units[0].id, confidence: units[0].confidence || 0 };
    }
    function operableUnitFallback(observation) {
        var state = observation && observation.state || {}, units = (state.units || []).filter(function (u) {
            return u.owner === "PLAYER" && u.canOperate === true && !blockedUnitIds[String(u.id)];
        });
        if (!units.length) return null;
        var enemyFrontline = (state.units || []).some(function (u) { return u.owner === "ENEMY" && u.isFrontline === true; });
        var ground = units.filter(function (u) { return ["TANK", "INFANTRY"].indexOf(effectiveUnitType(u)) >= 0; });
        var attacker = units.filter(function (u) { return u.isFrontline === true; });
        if (enemyFrontline && ground.length) attacker = ground;
        var sourceUnit = attacker[0] || units.filter(function (u) {
            return ["TANK", "INFANTRY"].indexOf(effectiveUnitType(u)) >= 0;
        })[0];
        if (!sourceUnit) return null;
        var action = sourceUnit.isFrontline === true || (enemyFrontline && ground.indexOf(sourceUnit) >= 0) ? domain.Action.ATTACK : domain.Action.MOVE_TO_FRONTLINE;
        // If the divider says the opponent owns the frontline, a ground unit
        // must attack an enemy frontline card; it cannot move into an empty
        // lane. When that card flickers out of unit detection for one frame,
        // defer the unit action and spend playable hand kredits instead of
        // issuing an illegal move.
        if (action === domain.Action.MOVE_TO_FRONTLINE && state.frontlineOwner === "ENEMY") return null;
        // Do not spend several seconds selecting a rear unit when every live
        // frontline slot is occupied. Let the planner use an orange hand card
        // (or another confirmed action) while kredits and turn time remain.
        if (action === domain.Action.MOVE_TO_FRONTLINE && !sharedFrontlineTarget(state)) return null;
        return { kind: action, sourceId: sourceUnit.id, confidence: sourceUnit.confidence || 0.65 };
    }
    function execute(observation) {
        var state = observation.state;
        // A target is valid only in the frame after the source was selected.
        // Do not re-plan here: a changing hand/unit list must never replace a
        // selected source with a different source before its target is tapped.
        if (pending) {
            if (pending.verifyUnitAction) {
                var currentSource = source(state, pending.sourceId);
                var currentTarget = source(state, pending.targetId);
                var moveConfirmed = pending.action === domain.Action.MOVE_TO_FRONTLINE &&
                    frontlineChanged(pending.frontlineBoundsBefore, state.units || []);
                var attackConfirmed = (pending.action === domain.Action.ATTACK || pending.action === domain.Action.OPERATE_UNIT) &&
                    (!currentSource || currentSource.canOperate !== true || (pending.targetWasPresent && pending.targetKind === "ENEMY_UNIT" && !currentTarget));
                if (moveConfirmed || attackConfirmed) {
                    // Block this concrete source position after success so a
                    // transient target disappearance cannot make the same
                    // still-orange card attack repeatedly. If this dynamic id
                    // later moves to another position, reconcileBlockedUnits
                    // releases it as a different physical source.
                    blockUnit(pending.sourceId, pending.sourceBounds || (currentSource && currentSource.bounds));
                    pending = null;
                    failures = 0;
                    return log(moveConfirmed ? "单位前移已由棋盘位置变化确认" : "单位攻击已由棋盘状态变化确认");
                }
                // 显式设置的超时值优先；未设置时才由节奏参数推导。
                var unitConfirmTimeout = typeof config.unitActionConfirmTimeoutMs === "number" ? config.unitActionConfirmTimeoutMs : Math.max(2000, (config.unitActionPaceMs || 650) * 3);
                if (Date.now() - pending.sentAt < unitConfirmTimeout) return log("等待单位动作画面确认");
                // A single Unreal frame transition can swallow an otherwise
                // valid drag. Re-observe and retry one attack once before
                // quarantining the unit for this turn; otherwise one missed
                // gesture makes the unit appear passive for the whole turn.
                if (pending.action === domain.Action.ATTACK || pending.action === domain.Action.OPERATE_UNIT || pending.action === domain.Action.MOVE_TO_FRONTLINE) {
                    var retryAction = pending.action;
                    var retryKey = String(pending.sourceId) + ":" + String(pending.action);
                    var retries = unitActionRetries[retryKey] || 0;
                    var maxAttempts = Math.max(1, config.maxUnitActionAttemptsPerUnit || config.maxUnitActionAttemptsPerTurn || 2);
                    if (retries < maxAttempts - 1) {
                        unitActionRetries[retryKey] = retries + 1;
                        pending = null;
                        failures = 0;
                        return log(retryAction === domain.Action.MOVE_TO_FRONTLINE ?
                            "单位前移未确认，重新识别前线后重试一次" : "单位攻击未确认，重新识别目标后重试一次");
                    }
                }
                blockUnit(pending.sourceId, currentSource && currentSource.bounds);
                pending = null;
                return log("单位动作未被棋盘确认，已暂时封锁该单位");
            }
            if (pending.directTarget) {
                var reached = (state.units || []).some(function (unit) { return unit.id === pending.targetId && unit.owner === "PLAYER"; });
                if (reached) { pending = null; failures = 0; return log("单位已进入前线"); }
                if (Date.now() - pending.sentAt < config.playCardSettleMs) return log("等待前线移动结果确认");
                pending = null;
                return log("前线移动未确认，取消本次动作");
            }
            if (pending.action === domain.Action.PLAY_CARD) {
                var handDecreased = (state.hand || []).length < pending.handCount;
                var handDecreasedByOne = (state.hand || []).length === pending.handCount - 1 &&
                    (state.handConfidence === undefined || state.handConfidence >= 0.7);
                var currentPlayerUnits = (state.units || []).filter(function (unit) { return unit.owner === "PLAYER"; });
                var unitAppeared = currentPlayerUnits.length > pending.playerUnitCount ||
                    currentPlayerUnits.some(function (unit) {
                        return (pending.playerUnitIds || []).indexOf(unit.id) < 0;
                    });
                // A newly visible friendly unit is direct evidence that the
                // deployment succeeded; do not make it wait for the noisy fan
                // counter as well. The real-device run deployed a unit, then
                // falsely timed out because the hand detector changed 8→5
                // and had not accumulated two stable frames yet.
                if (unitAppeared) {
                    // A deployed unit may legally move/attack immediately if
                    // the game paints its operation-cost badge orange. Do not
                    // block its slot id merely because it is newly visible.
                    pending = null; failures = 0; failedDeploymentSlots = {}; deploymentCursor = 0; return log("出牌已由己方单位出现确认");
                }
                // Card type is irrelevant to playing. Orders/effects may not
                // create a unit; a calibrated, high-confidence one-card hand
                // decrease is direct evidence that the drag succeeded.
                if (handDecreasedByOne) {
                    pending = null; failures = 0; failedDeploymentSlots = {}; deploymentCursor = 0;
                    return log("出牌已由手牌减少一张确认");
                }
                // Larger/noisy count changes keep the stricter stable-frame
                // transaction and are never interpreted as a single play.
                pending.confirmFrames = handDecreased && state.handStable === true ? (pending.confirmFrames || 0) + 1 : 0;
                if (pending.confirmFrames >= 2) {
                    pending = null; failures = 0; return log("出牌已由手牌数量变化确认");
                }
                pending.observedFrames = (pending.observedFrames || 0) + 1;
                // 显式设置的超时值优先；未设置时才由节奏参数推导。
                var playConfirmTimeout = typeof config.playCardConfirmTimeoutMs === "number" ? config.playCardConfirmTimeoutMs : Math.max(1500, (config.cardPlayPaceMs || 750) * 2);
                if (pending.observedFrames < 2 || Date.now() - pending.sentAt < Math.max(config.playCardSettleMs || 0, playConfirmTimeout)) return log("等待出牌结果稳定确认");
                playAttempts++;
                if (pending.deploymentSlotId) failedDeploymentSlots[pending.deploymentSlotId] = true;
                deploymentCursor = ((pending.deploymentIndex || 0) + 1) % Math.max(1, pending.deploymentSlotCount || deploymentSlots(state).length);
                var retrySameCard = freeDeploymentIndex(state) >= 0 && playAttempts < Math.max(1, config.maxPlayAttemptsPerTurn || 9);
                if (!retrySameCard) blockedCardIds[String(pending.sourceId)] = true;
                pending = null;
                // Do not immediately skip the whole turn.  The failed card
                // is quarantined and the planner may choose another confirmed
                // playable card.  A turn is only allowed to fall through to
                // END_TURN after every bounded deployment attempt has failed.
                if (retrySameCard) return log("出牌未确认，改用下一个部署区域重试同一张橙色牌");
                if (playAttempts < Math.max(1, config.maxPlayAttemptsPerTurn || 9)) return log("出牌未确认，改尝试其他已确认可出牌");
                skippedCardPlay = true;
                return log("本回合出牌尝试已达上限，安全结束本回合");
            }
            var pendingAction = pending.action, pendingSource = pending.sourceId, pendingBounds = pending.sourceBounds, pendingConfidence = pending.sourceConfidence;
            var targetPool = observation.legalTargets || [];
            // A rear-unit move can become an attack while the target frame is
            // arriving. Re-evaluate the live board before dragging: if an
            // enemy frontline is now visible, contest it directly instead of
            // sending the unit to an empty friendly lane selected earlier.
            if (pendingAction === domain.Action.MOVE_TO_FRONTLINE) {
                var liveEnemyFront = targetPool.some(function (t) {
                    return t.legal && t.kind === "ENEMY_UNIT" && t.isFrontline === true;
                });
                var liveSource = source(state, pendingSource);
                if (liveEnemyFront && liveSource && liveSource.owner === "PLAYER") pendingAction = domain.Action.ATTACK;
            }
            if (pendingAction === domain.Action.ATTACK && !targetPool.some(function (t) { return t.legal; })) {
                targetPool = fallbackAttackTargets(state, observation);
            }
            var target = planner.chooseTarget(targetPool, pendingAction, source(state, pendingSource));
            // Unlike attacks, KARDS' empty frontline lane has no separate
            // button after selecting a rear unit. The lane itself is a
            // measured, empty, player-owned destination; synthesize only that
            // safe target rather than waiting forever or guessing an enemy
            // coordinate.
            if (!target && (pendingAction === domain.Action.MOVE_TO_FRONTLINE || pendingAction === domain.Action.OPERATE_UNIT)) {
                var pendingUnit = source(state, pendingSource);
                if (pendingUnit && pendingUnit.owner === "PLAYER" && pendingUnit.isFrontline !== true) target = sharedFrontlineTarget(state);
            }
            if (!target && pendingAction === domain.Action.MOVE_TO_FRONTLINE && Date.now() - (pending.sentAt || 0) < (config.unitActionPaceMs || 1800)) return log("等待共享前线状态确认");
            pending = null;
            if (!target) {
                if (pendingSource) blockUnit(pendingSource, pendingBounds);
                return log("未检测到合法目标，已取消本次动作");
            }
            // Hard safety boundary: only MOVE_TO_FRONTLINE may use a
            // friendly destination. An attack/operate transaction must never
            // drag onto a player card, even if stale target metadata leaks
            // through from the previous frame.
            if ((pendingAction === domain.Action.ATTACK || pendingAction === domain.Action.OPERATE_UNIT) &&
                target.kind !== "ENEMY_UNIT" && target.kind !== "ENEMY_HQ") {
                if (pendingSource) blockUnit(pendingSource, pendingBounds);
                return log("攻击目标被判定为己方单位，已拦截拖动");
            }
            var completed = (pendingAction === domain.Action.ATTACK || pendingAction === domain.Action.OPERATE_UNIT || pendingAction === domain.Action.MOVE_TO_FRONTLINE) ?
                driver.dragUnit({ id: pendingSource, bounds: pendingBounds, confidence: pendingConfidence }, target, observation.frame) :
                driver.tapLegalTarget(target, observation.frame);
            if (completed.ok) {
                unitAttempts++;
                pending = {
                    verifyUnitAction: true,
                    action: pendingAction,
                    sourceId: pendingSource,
                    sourceBounds: pendingBounds,
                    targetId: target.id,
                    targetKind: target.kind,
                    targetWasPresent: !!source(state, target.id),
                    frontlineBoundsBefore: (state.units || []).filter(function (unit) {
                        return unit.owner === "PLAYER" && unit.isFrontline === true && unit.bounds;
                    }).map(function (unit) { return unit.bounds.slice(); }),
                    sentAt: Date.now()
                };
                config._invalidateBattleHq = true;
                failures = 0;
                return log("已发送单位拖动，等待画面确认");
            }
            return fail(completed);
        }
        reconcileBlockedUnits(state);
        state.blockedCardIds = blockedCardIds;
        state.blockedUnitIds = blockedUnitIds;
        // Once End Turn has been sent, the button can remain orange for one
        // or two observations. Do not plan another card/unit action from that
        // stale OUR_TURN frame; wait until tick() sees a real scene change and
        // clears endTurnRequestedAt.
        if (endTurnRequestedAt) return log("等待结束回合状态切换");
        var plan = planner.decide(state);
        // Existing units have priority over new cards. A stale/overly strict
        // decision-tree branch must never discard a confirmed unit action or
        // spend the turn deploying another card first.
        var unitFallback = operableUnitFallback(observation);
        if (unitFallback) plan = unitFallback;
        // The live orange cost badge is authoritative. If the declarative
        // tree falls through to END_TURN while an unblocked orange card is
        // visible, promote that card to PLAY_CARD instead of wasting the
        // timed turn on a stale OCR/decision-tree value.
        if (plan && plan.kind === domain.Action.END_TURN && !skippedCardPlay) {
            var forcedCandidates = (state.hand || []).filter(function (c) {
                var unitType = ["INFANTRY", "TANK", "ARTILLERY", "FIGHTER", "BOMBER"].indexOf(String(c.type || "UNKNOWN").toUpperCase()) >= 0;
                return c.playable === true && c.costBadgeOrange === true && !blockedCardIds[String(c.id)] &&
                    (config.requireUnitTypeForDeployment !== true || unitType);
            });
            var forcedCard = strategy.pickPlayableCard(forcedCandidates, blockedCardIds, config);
            if (forcedCard) plan = { kind: domain.Action.PLAY_CARD, sourceId: forcedCard.id, confidence: forcedCard.confidence || 0.7 };
        }
        // A ready frontline unit with a confirmed enemy target is a complete
        // action now. Do it before spending the remaining kredits on another
        // card; this prevents a playable card from starving an available
        // attack when the deployment area is full or the turn is short.
        var attackNow = frontlineAttackPlan(observation);
        // Existing attacks always take precedence over deploying another
        // card. This is intentionally unconditional: a ready unit plus a
        // confirmed enemy target should not be starved by the card branch.
        if (attackNow) plan = attackNow;
        if (!plan) return log("没有已确认的安全动作");
        if (plan.kind === domain.Action.PLAY_CARD) {
            // Fan animations can relabel one physical card (for example
            // hand-6 -> hand-8) for a single frame. Require the same count
            // and orange-card signature twice before using any hand source.
            // This gate is intentionally scoped to PLAY_CARD; visible unit
            // attacks/moves remain responsive while the bottom fan settles.
            if (state.handStable !== true) return log("等待手牌数量和橙色费用状态连续两帧稳定");
            if (skippedCardPlay) plan = { kind: domain.Action.END_TURN };
            else {
                var card = source(state, plan.sourceId);
                var badgeOrange = card && (card.costBadgeOrange === true || (card.costBadge && card.costBadge.orange === true));
                if (!card || (config.requireCostBadge && !badgeOrange)) {
                    if (card) blockedCardIds[String(card.id)] = true;
                    return log("费用徽章非橙色，禁止拖牌");
                }
                var currentDeploymentSlots = deploymentSlots(state);
                var deploymentIndex = freeDeploymentIndex(state);
                if (deploymentIndex < 0) {
                    blockedCardIds[String(card.id)] = true;
                    var fallbackAfterFull = operableUnitFallback(observation);
                    if (fallbackAfterFull) plan = fallbackAfterFull;
                    else return log("没有确认的空闲部署位，暂不拖牌");
                } else {
                    var deploymentSlot = currentDeploymentSlots[deploymentIndex];
                    var played = driver.playCard(card, deploymentSlot, observation.frame, observation.state, playAttempts);
                    if (!played.ok) return fail(played);
                    pending = {
                        action: domain.Action.PLAY_CARD,
                        handCount: (state.hand || []).length,
                        playerUnitCount: (state.units || []).filter(function (unit) { return unit.owner === "PLAYER"; }).length,
                        playerUnitIds: (state.units || []).filter(function (unit) { return unit.owner === "PLAYER"; }).map(function (unit) { return unit.id; }),
                        sentAt: Date.now(),
                        sourceId: card.id,
                        deploymentIndex: deploymentIndex,
                        deploymentSlotId: deploymentSlot && deploymentSlot.id,
                        deploymentSlotCount: currentDeploymentSlots.length,
                        confirmFrames: 0
                    };
                    config._invalidateBattleHq = true;
                    return log(played.detail);
                }
            }
        }
        if (plan.kind === domain.Action.MOVE_TO_FRONTLINE) {
            var rear = source(state, plan.sourceId);
            if (!rear) return log("没有确认的后排单位");
            var frontlineTarget = sharedFrontlineTarget(state);
            if (!frontlineTarget) return log("共享前线区域当前不可用");
            // Movement uses the same one-gesture interaction as attacks:
            // press on the unit, drag to the destination, release. A separate
            // preliminary tap can open/select the card and make the following
            // drag originate from stale UI state.
            var moveSent = driver.dragUnit(rear, frontlineTarget, observation.frame);
            if (!moveSent.ok) return fail(moveSent);
            unitAttempts++;
            pending = { verifyUnitAction: true, action: domain.Action.MOVE_TO_FRONTLINE,
                sourceId: rear.id, sourceBounds: rear.bounds, targetId: frontlineTarget.id,
                targetKind: frontlineTarget.kind, targetWasPresent: false,
                frontlineBoundsBefore: (state.units || []).filter(function (unit) {
                    return unit.owner === "PLAYER" && unit.isFrontline === true && unit.bounds;
                }).map(function (unit) { return unit.bounds.slice(); }), sentAt: Date.now() };
            config._invalidateBattleHq = true;
            failures = 0;
            return log("已按住后排单位拖动至共享前线，等待确认");
        }
        // KARDS attack input is one continuous press-drag-release gesture.
        // Do not emit a separate tap on the friendly source first: that can
        // leave the unit selected and the next frame may click the wrong card.
        if (plan.kind === domain.Action.ATTACK || plan.kind === domain.Action.OPERATE_UNIT) {
            var attacker = source(state, plan.sourceId);
            var attackTarget = planner.chooseTarget(observation.legalTargets || [], domain.Action.ATTACK, attacker);
            if (!attackTarget) return log("未检测到当前帧敌方合法攻击目标");
            if (attackTarget.kind !== "ENEMY_UNIT" && attackTarget.kind !== "ENEMY_HQ") return log("攻击目标不是敌方目标，已拦截");
            var attackSent = driver.dragUnit(attacker, attackTarget, observation.frame);
            if (!attackSent.ok) return fail(attackSent);
            unitAttempts++;
            pending = { verifyUnitAction: true, action: domain.Action.ATTACK,
                sourceId: attacker.id, sourceBounds: attacker.bounds, targetId: attackTarget.id,
                targetKind: attackTarget.kind, targetWasPresent: !!source(state, attackTarget.id), sentAt: Date.now() };
            config._invalidateBattleHq = true;
            failures = 0;
            return log("已按住己方单位拖动至敌方目标，等待攻击确认");
        }
        if (plan.kind === domain.Action.END_TURN) {
            if (!observation.scene.endTurnOnly && state.handConfidence !== undefined && state.handConfidence < 0.7) return log("手牌布局未确认，暂停本回合；不会猜测出牌或跳过");
            // Do not let END_TURN use weaker evidence than PLAY_CARD. The
            // first OUR_TURN frame often arrives while the fan/cost badges are
            // still animating and can report every badge grey. Wait for the
            // same hand count + orange/grey signature twice before concluding
            // that no card is playable. Empty hands may end immediately.
            if (!observation.scene.endTurnOnly && (state.hand || []).length && state.handStable !== true) {
                return log("等待手牌与费用颜色稳定后再决定是否结束回合");
            }
            // In badge-colour mode the game itself has already decided which
            // cards are affordable. A null OCR credit count must not freeze a
            // turn when every card is grey; only OCR-driven observe mode uses
            // the numeric resource guard.
            if (config.readCardCosts !== false && !observation.scene.endTurnOnly && (state.hand || []).length && state.credits == null) return log("费用未识别，暂停本回合；不会猜测出牌或跳过");
            if (endTurnRequestedAt && Date.now() - endTurnRequestedAt < (config.endTurnPaceMs || config.endTurnSettleMs)) return log("等待结束回合状态切换");
            var ended = driver.endTurn(observation, observation.frame);
            if (ended.ok) { failures = 0; endTurnRequestedAt = Date.now(); return log(ended.detail); }
            return fail(ended);
        }
        var selected = driver.activate(source(state, plan.sourceId), observation.frame);
        if (!selected.ok) return fail(selected);
        pending = { sourceId: plan.sourceId, sourceBounds: source(state, plan.sourceId).bounds, sourceConfidence: source(state, plan.sourceId).confidence, action: plan.kind };
        return log("已选择动作源，等待当前帧合法目标");
    }
    function tick(observation) {
        if (stopped) return;
        var visualKardsScreen = observation && observation.uiScreen && ["HOME", "MODE_MENU", "DECK_LIST", "DECK_DETAIL", "MULLIGAN", "BATTLE", "RESULT", "RECONNECT", "DAILY_QUEST", "POPUP", "SHOP", "CARD_COLLECTION"].indexOf(observation.uiScreen.screen) >= 0;
        // Auto.js' runner activity can remain the reported package while its
        // capture still shows the game. In automatic mode, trusting the
        // captured frame avoids pausing exactly during mulligan/result fades;
        // navigation remains bounded by the page classifier and templates.
        // Foreground package reporting is unreliable under RunIntentActivity;
        // the entrypoint is scoped to KARDS and already owns the capture.
        // Do not block the state machine on currentPackage().
        var ui = observation.uiScreen, scene = observation.scene, key = ui.screen + "/" + scene.scene;
        if (scene.scene === domain.Scene.OPPONENT_TURN || scene.scene === domain.Scene.QUEUE) {
            if (!opponentTurnSince) opponentTurnSince = Date.now();
            if (Date.now() - opponentTurnSince >= (config.opponentTurnTimeoutMs || 90000)) {
                stopped = true;
                return log("对手回合/匹配超时，已安全停止");
            }
        } else {
            opponentTurnSince = 0;
        }
        // Preserve pending actions and the same-turn deployment cooldown
        // across transient fade/overlay frames. Only a positively identified
        // non-player scene is a real turn transition; treating UNKNOWN as a
        // transition could re-enable a just-deployed unit too early.
        if (scene.scene !== domain.Scene.OUR_TURN && scene.scene !== domain.Scene.UNKNOWN) {
            endTurnRequestedAt = 0;
            skippedCardPlay = false;
            blockedCardIds = {};
            blockedUnitIds = {};
            blockedUnitBounds = {};
            unitActionRetries = {};
            unitAttempts = 0;
            playAttempts = 0;
            failedDeploymentSlots = {};
            deploymentCursor = 0;
            // A turn transition invalidates any source/target handshake from
            // the previous frame. Never carry a stale card or unit action
            // into the next player turn after a fast server-side resolution.
            pending = null;
        }
        same = key === signature ? same + 1 : 0; signature = key;
        var handCount = (observation.state.hand || []).length;
        var playableHandKey = (observation.state.hand || []).map(function (card) {
            return card.id + ":" + (card.playable === true && card.costBadgeOrange === true ? "O" : "G");
        }).join(",");
        var handKey = ui.screen + "/" + scene.scene + "/" + handCount + "/" +
            (observation.state.handConfidence >= 0.7 ? "confirmed" : "uncertain") + "/" + playableHandKey;
        handStable = handKey === handSignature ? handStable + 1 : 1;
        handSignature = handKey;
        log("[" + key + "] " + ui.ruleId + " " + ui.confidence.toFixed(2));
        if (same > config.maxSameSceneFrames) { stopped = true; return log("场景长时间未变化，已安全停止"); }
        if (config.mode !== "automatic") return;
        if (ui.confidence < config.minUiConfidence) return log("界面置信度不足，未操作");
        // Hand fan detection is relevant only to selecting a card source.
        // It must not gate an already visible unit action: the fan can keep
        // changing between adjacent counts while a rear unit is operable and
        // an enemy target is already on screen.  The old early return here
        // silently skipped MOVE/ATTACK and made the bot end the turn instead.
        observation.state.handStable = handStable >= (config.minStableHandFrames || 2);
        if (["HOME", "MODE_MENU", "DECK_LIST", "DECK_DETAIL", "MULLIGAN", "RESULT", "RECONNECT", "DAILY_QUEST", "POPUP", "SHOP", "CARD_COLLECTION"].indexOf(ui.screen) >= 0) {
            var advanced = driver.tapVerifiedUi(ui.screen, ui.confidence, observation.frame, ui.ruleId, observation.state);
            return advanced.ok ? (failures = 0, log(advanced.detail)) : fail(advanced);
        }
        if (scene.scene === domain.Scene.OUR_TURN || scene.scene === domain.Scene.SELECTING_TARGET) return execute(observation);
        if (scene.scene === domain.Scene.OPPONENT_TURN || scene.scene === domain.Scene.QUEUE) return log("等待对方/匹配状态变化");
        return log("未识别到可安全执行的流程节点");
    }
    if (planner.validationErrors.length) log("决策树无效，已使用安全内置策略");
    return { tick: tick, stopped: function () { return stopped; }, stop: function () { stopped = true; },
        pendingAction: function () { return pending ? pending.action : null; },
        status: function () { return { last: last, pending: pending ? pending.action : null, failures: failures, playAttempts: playAttempts, unitAttempts: unitAttempts, skippedCardPlay: skippedCardPlay }; }, decisionTree: function () { return { source: planner.source, errors: planner.validationErrors.slice() }; } };
};
