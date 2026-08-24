module.exports = {
    kardsPackage: "com.android1939.kardsapk",
    decisionTreePath: "strategy/default-decision-tree.json",
    templateThreshold: 0.82,
    ourTurnOrangeRatio: 0.08,
    guardTemplateThreshold: 0.90,
    templates: {
        trainingUnselected: "templates/mode-training-unselected-1280x720.png",
        trainingSelected: "templates/mode-training-selected-1280x720.png",
        // 对战模式（PvP）行与排位/休闲切换、开始按钮模板。
        // 用于 modeType: casual/ranked 路径的页面限定 findImage。
        modeVersusSelected: "templates/buttons/mode-battle-selected.png",
        modeVersusUnselected: "templates/buttons/mode-battle-unselected.png",
        deckRankedSelected: "templates/buttons/deck-ranked-selected.png",
        deckRankedUnselected: "templates/buttons/deck-ranked.png",
        deckCasualSelected: "templates/buttons/deck-casual-selected.png",
        deckCasualUnselected: "templates/buttons/deck-casual-unselected.png",
        deckStartPvp: "templates/buttons/deck-start.png",
        battleOurTurn: "templates/buttons/battle-turn-ours-current.png",
        battleOurTurnWhite: "templates/buttons/battle-turn-ours-white.png",
        battleOpponentTurn: "templates/buttons/battle-turn-opponent.png",
        mulliganHeader: "templates/buttons/mulligan-header.png",
        mulliganConfirm: "templates/buttons/mulligan-confirm.png",
        resultNextReward: "templates/buttons/result-next-reward.png",
        resultContinue: "templates/buttons/result-continue-current.png",
        resultViewBattle: "templates/buttons/result-view-battle-current.png",
        resultLeaveBattle: "templates/buttons/result-leave-battle-current.png",
        guardMarker: "templates/buttons/guard-marker.png",
        // Enemy-side shield is rendered larger/brighter than the isolated
        // friendly sample; keep a dedicated current-build template.
        guardMarkerEnemy: "templates/buttons/guard-marker-enemy.png",
        popupClosePromo: "templates/buttons/popup-close-promo-current.png",
        // Frontline and rear/support rows render the same icon at slightly
        // different scales. Keep both real 1280x720 crops per known type.
        typeInfantry: ["templates/types/infantry.png", "templates/types/infantry-rear.png"],
        typeTank: ["templates/types/tank.png", "templates/types/tank-rear.png"],
        typeArtillery: "templates/types/artillery.png",
        typeFighter: "templates/types/fighter.png",
        typeBomber: "templates/types/bomber.png",
        // Binary silhouette templates ignore foil/gold animation and border
        // colour. They are the production path when Auto.js image filters are
        // available; RGB templates remain a compatibility fallback.
        typeMaskInfantry: ["templates/types/masks-inner/infantry-inner-mask.png", "templates/types/masks-inner/infantry-rear-inner-mask.png"],
        typeMaskTank: ["templates/types/masks-inner/tank-inner-mask.png", "templates/types/masks-inner/tank-rear-inner-mask.png"],
        typeMaskArtillery: "templates/types/masks-inner/artillery-inner-mask.png",
        typeMaskFighter: "templates/types/masks-inner/fighter-inner-mask.png",
        typeMaskBomber: "templates/types/masks-inner/bomber-inner-mask.png",
        // Optional card-detail calibration assets. Leave unset until paired
        // real normal/foil and labelled rarity samples are available; vision
        // then returns UNKNOWN instead of inventing appearance metadata.
        rarityCommon: null,
        rarityRare: null,
        rarityElite: null,
        raritySpecial: null,
        foil: null,
        nonFoil: null
    },
    rarityRelativeBounds: [0.02, 0.02, 0.98, 0.18],
    foilRelativeBounds: [0.02, 0.02, 0.98, 0.98],
    rarityTemplateThreshold: 0.88,
    foilTemplateThreshold: 0.88,
    // Type badges sit in the lower centre of a card.  This is only the
    // search window; classification is template-only and returns UNKNOWN
    // until a calibrated icon template exists.
    // Type templates are 35–46px high at the measured 1280x720 board
    // scale. The previous crop was only ~41px high and silently rejected
    // fighter/bomber templates as too large, leaving every unit UNKNOWN.
    typeIconRelativeBounds: [0.20, 0.62, 0.86, 0.99],
    // Board icons are rendered with per-frame scaling/anti-aliasing; the
    // isolated 35–46px templates need a slightly looser match than buttons.
    // Search remains confined to this unit's bottom badge region.
    typeIconThreshold: 0.80,
    // Native matchTemplate returns comparable similarity values for every
    // icon. Collect candidates at this lower floor, then require the winning
    // type to pass typeIconThreshold and lead the runner-up by this margin.
    typeIconCandidateThreshold: 0.70,
    typeIconMinMargin: 0.035,
    // Tight black icon-square crop. Excluding the surrounding gold border is
    // what makes the silhouette invariant to foil animation.
    typeMaskRelativeBounds: [0.36, 0.72, 0.70, 0.97],
    typeMaskLumaThreshold: 135,
    // Native real-device calibration after excluding stats/borders: rear foil
    // infantry=0.708, rear tank=0.650, front tank=0.952. Competing concrete
    // types stay below the candidate floor or winner margin.
    typeMaskThreshold: 0.62,
    typeMaskCandidateThreshold: 0.55,
    typeMaskMinMargin: 0.030,
    readUnitTypes: true,
    // ── 对局模式（不可被用户策略覆盖到非法值） ──────────────────────────
    // training=训练（AI 对战）| casual=休闲（PVP）| ranked=排位（PVP）
    // 默认保持 training，避免误入排位消耗胜场。
    modeType: "training",
    // ── 节奏参数（用户可调，但有安全下限） ──────────────────────────────
    // 用户可在策略文件中覆盖这些值，runtime 会将其钳制到安全范围。
    // cardPlayPaceMs: 两次出牌尝试之间的最短间隔
    // unitActionPaceMs: 两次单位操作之间的最短间隔
    // endTurnPaceMs: 结束回合后到下一次决策的最短等待
    // navPaceMs: 导航点击之间的最短间隔
    cardPlayPaceMs: 600,
    unitActionPaceMs: 500,
    endTurnPaceMs: 800,
    navPaceMs: 1200,
    // 单卡单回合出牌次数上限：同一张手牌被反复尝试出牌超过此次数仍未真实
    // 打出（牌仍在手牌中），则本回合封锁该牌并转向下一张/结束回合。
    // 这是防"幻影牌/误判可出"导致的出牌卡死循环的护栏。
    maxCardPlayAttemptsPerCard: 2,
    // ── 拟人化 / 反脚本检测参数 ──────────────────────────────────────────────
    // enabled=false 时所有偏移和延迟退化为原始固定值（用于回归测试）。
    // tapJitterRadius: tap 坐标最大偏移像素（8px 不会点错 50px+ 的按钮）
    // swipeJitterRadius: swipe 端点最大偏移像素
    // paceVariance: 节奏参数随机变异比例（0.35 = ±35%）
    // thinkTimeBaseMs: 战斗动作前基准思考时间（模拟人看局面）
    humanize: {
        enabled: true,
        tapJitterRadius: 8,
        swipeJitterRadius: 6,
        paceVariance: 0.35,
        thinkTimeBaseMs: 50
    },
    // ── 内部超时参数（由节奏参数推导，不直接暴露给用户） ────────────────
    // 这些值由 pace 参数驱动：快节奏 → 短超时，慢节奏 → 长超时。
    // 不直接在用户策略中暴露，避免破坏确认逻辑。
    playCardSettleMs: 400,
    playCardConfirmTimeoutMs: 1600,
    deploymentSettleWaitMs: 400,
    unitDragDurationMs: 650,
    unitActionConfirmTimeoutMs: 4500,
    endTurnSettleMs: 800,
    // Amortize expensive Auto.js template matching across frames. Unknown
    // occupied slots use unknownUnitTypeFallback immediately, while at most
    // one new concrete slot is calibrated per observation and then cached.
    maxUnitTypeMatchesPerFrame: 1,
    // Temporary strategy fallback requested for live testing: an occupied
    // unit whose icon is not yet recognized is treated as infantry. This is
    // scoped to battlefield units; hand cards remain UNKNOWN and are still
    // played solely from the orange cost badge.
    unknownUnitTypeFallback: "INFANTRY",
    // Hand metadata has independent switches. Enabling type recognition must
    // never silently re-enable rarity or foil scans. None of these fields
    // gates deployment; the live orange cost badge remains authoritative.
    readHandTypes: false,
    readHandRarity: false,
    // Foil/animated treatment is intentionally ignored in production. Keep
    // the compatibility field UNKNOWN without spending timed-turn work.
    readHandFoil: false,
    // Automatic mode writes diagnostics to JSONL and never emits toast()
    // overlays. A generic brightness heuristic over the lower centre also
    // overlaps the real six-card fan and caused normal battles to be paused.
    // Keep this off until a page-specific overlay template is available.
    detectGenericBlockingOverlay: false,
    requireUnitTypeForDeployment: false,
    tickMs: 300,
    // End-turn input is acknowledged before the UI always redraws.  Keep one
    // request in flight rather than tapping the fixed button every frame.
    endTurnSettleMs: 800,
    playCardSettleMs: 400,
    // A hand decrease must persist for two stable observations. This timeout
    // bounds that transaction without accepting a one-frame fan-count wobble.
    // One battle observation currently costs about 1.2-1.4s on the emulator.
    // Two frames are enough to reject a dead drag; waiting five seconds per
    // lane consumed most of a timed turn while repeating the same bad source.
    playCardConfirmTimeoutMs: 1600,
    // Maximum wait after selecting a card for the game to illuminate a legal
    // deployment slot. A zero value is useful for deterministic replay tests.
    deploymentSettleWaitMs: 400,
    // Unit drags need a slower hold than card deployment on the Unreal board;
    // the game otherwise interprets the gesture as a tap near the source.
    unitDragDurationMs: 650,
    // A board-changing drag invalidates the cached HQ/formation and the next
    // full Auto.js observation can take 6–8 seconds. The gesture is sent
    // immediately; this window only prevents a successful move from being
    // declared failed before that complete frame arrives.
    unitActionConfirmTimeoutMs: 4500,
    // User hard limit: no more than two movement/attack gestures in one
    // player turn, including retries.
    // Retry ceiling is per physical unit/action, not a whole-turn action cap.
    // Successful units are quarantined by runtime, allowing every other ready
    // unit to act without creating an infinite drag loop.
    maxUnitActionAttemptsPerUnit: 2,
    maxUnitActionAttemptsPerTurn: 2, // legacy alias for older scripts
    // At most one bounded attempt per possible hand card in a turn. This is
    // intentionally independent of the number of deployment lanes: a failed
    // lane/card pair must not make the bot skip the remaining hand.
    // User limit: at most three card drags per turn. After the third
    // unconfirmed attempt, preserve the remaining timed turn for unit
    // actions and then end safely instead of sweeping every board lane.
    maxPlayAttemptsPerTurn: 2,
    // Keep this mode until the complete observe-only pass is reviewed.
    mode: "observe",
    allowNavigation: false,
    allowBattleActions: false,
    minUiConfidence: 0.80,
    minTargetConfidence: 0.70,
    // Attack uses the confirmed drag-to-target interaction. Direct targets
    // are occupied enemy units/HQ from the current frame.
    directTargetConfidence: 0.72,
    // Unit occupancy confidence is capped below direct-target confidence
    // because it comes from board-edge evidence. Keep target confirmation
    // strict, but do not reject every real unit source before its drag.
    minUnitActionConfidence: 0.55,
    minTargetHighlightDelta: 0.16,
    targetHighlightFullDelta: 0.30,
    minUnitEdgeDensity: 0.20,
    // The player-side board line is visually strong even when no unit is
    // present. Require a little more card-edge evidence on our side so the
    // HQ/line is not promoted to an operable unit.
    minPlayerUnitEdgeDensity: 0.28,
    targetSampleStride: 24,
    unitSampleStride: 24,
    // Require two consecutive observations with the same confirmed hand
    // count before any drag/end-turn decision. Card-fan animations otherwise
    // make a six-card hand briefly look like four cards.
    minStableHandFrames: 2,
    // Keep the requested default: without a confirmed guard, prefer the HQ.
    // This may be enabled later for strategies that deliberately clear the
    // enemy frontline before pressing the headquarters.
    // User rule: when no confirmed guard blocks the attack, prefer an enemy
    // frontline unit before pressing the headquarters.
    preferFrontlineUnits: true,
    // Baseline centres only guide the adaptive HQ scan; the scan may move
    // them when the current board layout places HQ beside a command unit.
    hqExpectedX: { enemy: 0.48, player: 0.50 },
    maxSameSceneFrames: 160,
    // Opponent/queue stalls are usually a disconnected or abandoned match.
    // Bound the wait independently of UI template churn so the runtime does
    // not remain alive forever while no actionable state can change.
    opponentTurnTimeoutMs: 90000,
    maxConsecutiveFailures: 4,
    regions: {
        topUi: [0.00, 0.00, 1.00, 0.11], bottomUi: [0.00, 0.90, 1.00, 1.00],
        menuCenter: [0.25, 0.15, 0.75, 0.80], modeFlyout: [0.18, 0.14, 0.39, 0.86], rightPanel: [0.73, 0.08, 1.00, 0.96],
        deckStartButton: [0.72, 0.80, 0.98, 0.94], enemyHqAnchor: [0.43, 0.12, 0.57, 0.34],
        playerHqAnchor: [0.43, 0.62, 0.57, 0.84], cardsNav: [0.00, 0.40, 0.15, 0.63],
        shopNav: [0.00, 0.63, 0.15, 0.87], menuContent: [0.05, 0.15, 0.95, 0.92],
        // Current KARDS board places End Turn at the right-middle, not the
        // bottom-right card area: measured on 1280x720 as x=1055..1242,
        // y=488..544. Keep a small drift margin around that control.
        endTurnUi: [0.82, 0.67, 0.98, 0.77],
        resultReward: [0.40, 0.62, 0.60, 0.75],
        resultViewBattle: [0.74, 0.04, 0.97, 0.16],
        resultContinue: [0.42, 0.86, 0.60, 0.99],
        // Current promotional modal close X measured with image-grid-locate:
        // pixel bbox [1158,101]-[1192,145] on the 1280x720 build.
        popupClosePromo: [0.895, 0.12, 0.95, 0.22],
        dailyQuestModal: [0.16, 0.05, 0.84, 0.88],
        // Auto.js permission/status toasts occupy the lower centre and can
        // cover both the fan and the credit badge. Treat a bright, low-
        // saturation patch here as a transient overlay, never as game UI.
        blockingOverlay: [0.30, 0.77, 0.70, 0.95],
        // Inactive-session dialog shown over the home background. The modal
        // is dark and low-saturation while its reconnect button is a bright
        // pale rectangle; these two regions prevent HOME from winning first.
        reconnectModal: [0.33, 0.20, 0.67, 0.73],
        reconnectButton: [0.39, 0.56, 0.61, 0.65],
        mulliganHeader: [0.25, 0.04, 0.75, 0.17],
        mulliganConfirm: [0.34, 0.78, 0.68, 0.97],
        deckChoiceMiddle: [0.37, 0.16, 0.63, 0.84], deckChoiceRight: [0.67, 0.16, 0.93, 0.84],
        // Measured from the current 1280x720 battle HUD.  This deliberately
        // covers only the player's credit badge, not either headquarters.
        // Keep enough horizontal/vertical margin for the current numeral to
        // be recognized at different map scales. Auto.js OCR returns the
        // current digit first (then the K and maximum); ocrNumber accepts
        // that first bounded numeric token and ignores the labels.
        playerCredits: [0.018, 0.660, 0.105, 0.800],
        
        // OCR识别区域配置
        ocrRegions: {
            // 卡牌费用区域（左上角）
            cardCost: {
                bounds: [0.02, 0.02, 0.12, 0.12],
                description: "卡牌费用区域（0-12）",
                validation: { min: 0, max: 12 }
            },
            // 我方总部血量区域
            playerHqHealth: {
                bounds: [0.45, 0.88, 0.55, 0.92],
                description: "我方总部血量（0-20）",
                validation: { min: 0, max: 20 }
            },
            // 敌方总部血量区域
            enemyHqHealth: {
                bounds: [0.45, 0.08, 0.55, 0.12],
                description: "敌方总部血量（0-20）",
                validation: { min: 0, max: 20 }
            },
            // 卡牌攻击力区域（左下角）
            cardAttack: {
                bounds: [0.08, 0.85, 0.15, 0.95],
                description: "卡牌攻击力（0-20）",
                validation: { min: 0, max: 20 }
            },
            // 卡牌血量区域（右下角）
            cardHealth: {
                bounds: [0.85, 0.85, 0.92, 0.95],
                description: "卡牌血量（0-20）",
                validation: { min: 0, max: 20 }
            }
        }
    },
    // A slot becomes a legal target only when the current frame confirms an
    // occupied enemy unit or a dynamically detected HQ. No blind target is
    // fabricated.
    targetSlots: [
        // Current board cards occupy the central upper/lower lanes. The old
        // y ranges sampled the top HUD and the bottom hand fan, producing
        // missed enemy-HQ targets and false friendly-HQ detections.
        { id: "enemy-hq", kind: "ENEMY_HQ", bounds: [0.40, 0.10, 0.60, 0.40], threat: 1000 },
        { id: "player-hq", kind: "FRIENDLY_HQ", bounds: [0.40, 0.60, 0.60, 0.90] },
        { id: "end-turn", kind: "END_TURN", bounds: [0.82, 0.67, 0.98, 0.77] },
        { id: "enemy-rear-left", kind: "ENEMY_UNIT", bounds: [0.08, 0.18, 0.25, 0.34], threat: 4, isFrontline: false },
        { id: "enemy-rear-mid", kind: "ENEMY_UNIT", bounds: [0.50, 0.18, 0.68, 0.34], threat: 5, isFrontline: false },
        { id: "enemy-rear-right", kind: "ENEMY_UNIT", bounds: [0.75, 0.18, 0.92, 0.34], threat: 4, isFrontline: false },
        { id: "enemy-front-left", kind: "ENEMY_UNIT", bounds: [0.08, 0.34, 0.25, 0.48], threat: 6, isFrontline: true },
        { id: "enemy-front-mid", kind: "ENEMY_UNIT", bounds: [0.45, 0.34, 0.65, 0.48], threat: 7, isFrontline: true },
        { id: "enemy-front-right", kind: "ENEMY_UNIT", bounds: [0.75, 0.34, 0.92, 0.48], threat: 6, isFrontline: true },
        { id: "player-front-left", kind: "FRIENDLY_UNIT", bounds: [0.30, 0.32, 0.46, 0.58], isFrontline: true },
        { id: "player-front-mid", kind: "FRIENDLY_UNIT", bounds: [0.45, 0.32, 0.65, 0.58], isFrontline: true },
        { id: "player-front-right", kind: "FRIENDLY_UNIT", bounds: [0.70, 0.32, 0.86, 0.58], isFrontline: true },
        { id: "player-rear-left", kind: "FRIENDLY_UNIT", bounds: [0.08, 0.64, 0.25, 0.78], isFrontline: false },
        // Real 2026-08-22 board evidence: the HQ occupies roughly x=.40-.50.
        // Keep both rear action sources entirely outside that box. Their
        // centres (x~=474 and x~=755) land inside the exposed unit cards on
        // the left/right layouts instead of the HQ or a card edge.
        { id: "player-rear-mid", kind: "FRIENDLY_UNIT", bounds: [0.32, 0.60, 0.42, 0.82], isFrontline: false },
        { id: "player-rear-right", kind: "FRIENDLY_UNIT", bounds: [0.54, 0.60, 0.64, 0.82], isFrontline: false }
    ],
    unitSlots: [
        { id: "enemy-rear-left", owner: "ENEMY", bounds: [0.08, 0.18, 0.25, 0.34], alternateBounds: [0.34, 0.14, 0.44, 0.36], alternateMinEdgeDensity: 0.30, isFrontline: false },
        { id: "enemy-rear-mid", owner: "ENEMY", bounds: [0.50, 0.18, 0.68, 0.34], isFrontline: false },
        { id: "enemy-rear-right", owner: "ENEMY", bounds: [0.75, 0.18, 0.92, 0.34], isFrontline: false },
        { id: "enemy-front-left", owner: "ENEMY", bounds: [0.08, 0.34, 0.25, 0.48], isFrontline: true },
        { id: "enemy-front-mid", owner: "ENEMY", bounds: [0.45, 0.34, 0.65, 0.48], isFrontline: true },
        { id: "enemy-front-right", owner: "ENEMY", bounds: [0.75, 0.34, 0.92, 0.48], isFrontline: true },
        { id: "player-front-left", owner: "PLAYER", bounds: [0.30, 0.32, 0.46, 0.58], isFrontline: true },
        { id: "player-front-mid", owner: "PLAYER", bounds: [0.45, 0.32, 0.65, 0.58], isFrontline: true },
        { id: "player-front-right", owner: "PLAYER", bounds: [0.70, 0.32, 0.86, 0.58], isFrontline: true },
        { id: "player-rear-left", owner: "PLAYER", bounds: [0.08, 0.64, 0.25, 0.78], isFrontline: false },
        { id: "player-rear-mid", owner: "PLAYER", bounds: [0.32, 0.60, 0.42, 0.82], isFrontline: false },
        { id: "player-rear-right", owner: "PLAYER", bounds: [0.54, 0.60, 0.64, 0.82], isFrontline: false }
    ],
    // KARDS has no tappable deployment-button UI. Unit cards are
    // dragged from the hand to a free player-side lane.  These are measured
    // lane centres for the 1280x720 landscape board and are tried one at a
    // time; a drag is accepted only after the hand count visibly decreases.
    deploymentSlots: [
        // Measured from the accepted manual drag (source ~763,674 to
        // destination ~576,540).  The active deployment area is below the
        // frontline divider; the old y=0.57..0.69 boxes landed too high and
        // were repeatedly rejected by the game.
        // The starter unit commonly occupies the left/middle support lane.
        // Try the measured right-side free area first; runtime will rotate to
        // the remaining areas when a deployment is not confirmed.
        { id: "deploy-right", bounds: [0.58, 0.64, 0.68, 0.80] },
        { id: "deploy-left", bounds: [0.34, 0.64, 0.44, 0.80] },
        { id: "deploy-mid", bounds: [0.44, 0.64, 0.54, 0.80] }
    ],
    // Frontline movement is released onto the visually measured shared band
    // in runtime.js. KARDS does not expose fixed player-front deployment cells.
    // Same measured rules as LayoutProfile.defaultUiScreenRules().
    uiRules: [
        { id: "reconnect", screen: "RECONNECT", priority: 100, anchors: [{ r: "reconnectModal", maxL: 85, maxS: 55, minE: 0.05 }, { r: "reconnectButton", minL: 110, maxS: 60, minE: 0.05 }] },
        { id: "daily-quest", screen: "DAILY_QUEST", priority: 95, anchors: [{ r: "topUi", maxL: 35 }, { r: "menuCenter", minL: 80 }, { r: "resultReward", minL: 120 }] },
        // Real rotating HOME banners measured centre saturation 83.5–128.0;
        // the product page is materially lower at 52.9.
        { id: "home", screen: "HOME", priority: 20, anchors: [{ r: "topUi", minL: 48 }, { r: "menuCenter", minL: 60, minS: 80 }, { r: "rightPanel", minS: 65 }] },
        { id: "mode-menu", screen: "MODE_MENU", priority: 25, anchors: [{ r: "topUi", minL: 48 }, { r: "modeFlyout", maxL: 60 }] },
        { id: "training-deck-chooser", screen: "DECK_LIST", priority: 55, anchors: [{ r: "topUi", maxL: 35 }, { r: "deckChoiceMiddle", minL: 90, maxS: 65 }, { r: "deckChoiceRight", minL: 80 }] },
        { id: "deck-list", screen: "DECK_LIST", priority: 24, anchors: [{ r: "topUi", minL: 48 }, { r: "menuCenter", maxL: 65 }, { r: "rightPanel", minS: 85 }] },
        { id: "deck-detail", screen: "DECK_DETAIL", priority: 30, anchors: [{ r: "topUi", maxL: 45 }, { r: "deckStartButton", minL: 88, maxS: 50 }] },
        { id: "card-collection", screen: "CARD_COLLECTION", priority: 35, anchors: [{ r: "topUi", minL: 50, maxL: 70 }, { r: "cardsNav", maxL: 50 }, { r: "menuContent", minL: 65, maxS: 45 }, { r: "rightPanel", maxS: 40 }] },
        // Product artwork overlaps HOME's broad colour ranges. Keep SHOP below
        // the structurally stronger HOME rule: the real product page does not
        // satisfy HOME's high centre-saturation anchor, while the home page can
        // satisfy both sets of broad colour constraints.
        { id: "shop", screen: "SHOP", priority: 19, anchors: [{ r: "topUi", minL: 50, maxL: 70, maxS: 50 }, { r: "menuCenter", minL: 60, maxS: 80 }, { r: "menuContent", minL: 60, maxS: 80 }, { r: "rightPanel", minS: 60 }] },
        // Mulligan's bright header keeps the top HUD materially lighter than
        // the dark battle HUD. The previous rule matched battle frames after
        // End Turn was moved to its real right-middle location.
        { id: "mulligan", screen: "MULLIGAN", priority: 50, anchors: [{ r: "topUi", minL: 35, maxL: 50 }, { r: "enemyHqAnchor", minE: 0.14 }, { r: "playerHqAnchor", minL: 80 }, { r: "rightPanel", maxL: 52 }, { r: "endTurnUi", maxL: 58 }] },
        { id: "battle", screen: "BATTLE", priority: 40, anchors: [{ r: "topUi", minL: 25, maxL: 50 }, { r: "rightPanel", minS: 60 }, { r: "playerHqAnchor", minE: 0.15 }, { r: "endTurnUi", minL: 60, minS: 40 }] }
    ]
};
