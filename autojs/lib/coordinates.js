/* Measured on 1280x720 landscape. These are only for positively classified UI buttons. */
module.exports = {
    HOME_START: [70 / 1280, 230 / 720, 130 / 1280, 290 / 720],
    // The KARDS winged logo is the persistent home/back control on the shop
    // and card-collection pages.  Keeping this contextual (rather than using
    // Android back) avoids closing the game or an active match.
    HOME_BACK: [0 / 1280, 0 / 720, 185 / 1280, 88 / 720],
    // The mode flyout's training row is centered near (333,258) on the
    // current 1280x720 build.  Keep the box tight enough to avoid the row
    // separators but wide enough for font/layout drift.
    MODE_TRAINING: [255 / 1280, 220 / 720, 460 / 1280, 298 / 720],
    // 对战模式（PvP）入口：模式菜单第一行（模板 mode-battle-selected/unselected）。
    // 坐标来自 templates/buttons/manifest.json 实测裁剪记录。
    MODE_VERSUS: [255 / 1280, 155 / 720, 460 / 1280, 230 / 720],
    // 对战卡组详情页的排位/休闲切换（模板 deck-ranked(-selected) / deck-casual-(un)selected）。
    // 排位在左、休闲在右；开始按钮在下方。
    RANKED_TOGGLE: [922 / 1280, 510 / 720, 1080 / 1280, 570 / 720],
    CASUAL_TOGGLE: [1078 / 1280, 510 / 720, 1233 / 1280, 570 / 720],
    // 对战卡组详情页的开始按钮（模板 deck-start）。
    DECK_START_PVP: [920 / 1280, 565 / 720, 1235 / 1280, 645 / 720],
    // Training deck chooser: use the first (left-most) deck by default.
    DECK_DEFAULT: [500 / 1280, 120 / 720, 730 / 1280, 480 / 720],
    DECK_CONFIRM: [1040 / 1280, 580 / 720, 1140 / 1280, 640 / 720],
    MULLIGAN_CONFIRM: [540 / 1280, 600 / 720, 740 / 1280, 695 / 720],
    END_TURN: [1050 / 1280, 480 / 720, 1245 / 1280, 550 / 720],
    // The confirmed level-reward result page renders its Continue control at
    // the bottom centre.  Do not use the board's end-turn coordinate here.
    RESULT_CONTINUE: [540 / 1280, 630 / 720, 740 / 1280, 705 / 720],
    RESULT_VIEW_BATTLE: [959 / 1280, 43 / 720, 1235 / 1280, 107 / 720],
    RECONNECT: [490 / 1280, 400 / 720, 790 / 1280, 470 / 720],
    // Daily-quest modal has no reliable close icon in this build; tapping the
    // dimmed area outside the card dismisses it without changing navigation.
    DAILY_QUEST_DISMISS: [1050 / 1280, 600 / 720, 1190 / 1280, 690 / 720],
    POPUP_CLOSE: [920 / 1280, 80 / 720, 980 / 1280, 140 / 720],
    PROMO_POPUP_CLOSE: [1160 / 1280, 102 / 720, 1190 / 1280, 142 / 720]
};
