var vision = require("../lib/vision");
var config = require("../lib/config");
var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/live-no-overlay.png");
if (!frame) throw new Error("无法读取实机截图");
try {
    [620, 630, 640, 650, 660, 670, 680].forEach(function (y) {
        var hits = [];
        for (var x = 200; x <= 1050; x += 10) if (vision._private.cardAt(frame, x, y)) hits.push(x);
        console.log("hand-line-y" + y + "=" + hits.join(","));
    });
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (count) {
        var x = 640 - (count - 1) * 145 / 2;
        console.log("fan-probe-" + count + "@" + Math.round(x) + "=" + vision._private.cardAt(frame, x, 650));
    });
    var detected = vision._private.detectHand(frame);
    console.log("detected=" + JSON.stringify(detected));
    console.log("fees=" + JSON.stringify(vision._private.enrichHandWithFees(frame, detected, config)) + " cards=" + JSON.stringify(detected.cards.map(function (card) { return { cost: card.cost, playable: card.playable }; })));
} finally { frame.recycle(); }
