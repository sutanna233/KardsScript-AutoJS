var Scene = {
    MENU: "MENU", QUEUE: "QUEUE", MULLIGAN: "MULLIGAN", OUR_TURN: "OUR_TURN",
    OPPONENT_TURN: "OPPONENT_TURN", SELECTING_TARGET: "SELECTING_TARGET", RESULT: "RESULT",
    RECONNECTING: "RECONNECTING", UNKNOWN: "UNKNOWN"
};

var Screen = {
    HOME: "HOME", MODE_MENU: "MODE_MENU", DECK_LIST: "DECK_LIST", DECK_DETAIL: "DECK_DETAIL",
    CARD_COLLECTION: "CARD_COLLECTION", SHOP: "SHOP", MULLIGAN: "MULLIGAN", BATTLE: "BATTLE",
    RESULT: "RESULT", RECONNECT: "RECONNECT", POPUP: "POPUP", UNKNOWN: "UNKNOWN"
};

var Action = {
    START_MATCH: "START_MATCH", MULLIGAN: "MULLIGAN", CONTINUE: "CONTINUE", RECONNECT: "RECONNECT",
    CLOSE_POPUP: "CLOSE_POPUP", END_TURN: "END_TURN", PLAY_CARD: "PLAY_CARD", ATTACK: "ATTACK",
    OPERATE_UNIT: "OPERATE_UNIT", MOVE_TO_FRONTLINE: "MOVE_TO_FRONTLINE"
};

function center(bounds, width, height) {
    return { x: Math.round((bounds[0] + bounds[2]) * width / 2), y: Math.round((bounds[1] + bounds[3]) * height / 2) };
}
function validBounds(bounds) {
    return bounds && bounds.length === 4 && bounds[0] >= 0 && bounds[1] >= 0 && bounds[2] <= 1 && bounds[3] <= 1 && bounds[2] > bounds[0] && bounds[3] > bounds[1];
}
function battleAction(action) {
    return action === Action.PLAY_CARD || action === Action.ATTACK || action === Action.OPERATE_UNIT || action === Action.MOVE_TO_FRONTLINE;
}

module.exports = { Scene: Scene, Screen: Screen, Action: Action, center: center, validBounds: validBounds, battleAction: battleAction };
