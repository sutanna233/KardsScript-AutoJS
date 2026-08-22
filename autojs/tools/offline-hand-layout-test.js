var config = require("../lib/config");
var vision = require("../lib/vision");

var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/play-card-white-enabled.png");
if (!frame) throw new Error("无法读取当前手牌截图");
try {
    var hand = vision._private.detectHand(frame);
    console.log("live-hand=" + hand.cards.length + " " + hand.detail);
    if (!hand.cards.length) throw new Error("当前底部手牌未被识别");
} finally { frame.recycle(); }
console.log("offline hand layout test ok");
