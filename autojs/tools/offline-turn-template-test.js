var config = require("../lib/config");
var vision = require("../lib/vision");

function verify(name, framePath, expected) {
    var frame = images.read(framePath);
    try {
        var result = vision._private.detectBattleTurn(frame, config);
        var actual = result ? result.scene : "NONE";
        console.log(name + "=" + actual);
        if (actual !== expected) throw new Error(name + " expected " + expected + " but got " + actual);
        var observation = vision.create(config).observe(frame);
        console.log(name + "-full=" + observation.uiScreen.screen + "/" + observation.scene.scene);
        if (observation.scene.scene !== expected) throw new Error(name + " full classifier expected " + expected + " but got " + observation.scene.scene);
    } finally { frame.recycle(); }
}

verify("our-turn", "/sdcard/AutoJs6/KardsScript/fixtures/audit-our-turn.png", "OUR_TURN");
verify("our-turn-white", "/sdcard/AutoJs6/KardsScript/fixtures/full-flow-before-white-click.png", "OUR_TURN");
verify("opponent-turn", "/sdcard/AutoJs6/KardsScript/fixtures/audit-opponent-turn.png", "OPPONENT_TURN");
console.log("offline turn template test ok");
