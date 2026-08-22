var vision = require("../lib/vision");
var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/navigation-test-final.png");
if (!frame) throw new Error("fixture missing");
try {
    [610,620,630,640,650,660,670,680].forEach(function (y) {
        var hits = [];
        for (var x = 220; x <= 1040; x += 10) if (vision._private.cardAt(frame, x, y)) hits.push(x);
        console.log("line-" + y + "=" + hits.join(","));
    });
    [640,587,535,482,430,377,325,272,220].forEach(function (x, i) { console.log("probe-" + (i + 1) + "@" + x + "=" + vision._private.cardAt(frame, x, 650)); });
    console.log("detected=" + JSON.stringify(vision._private.detectHand(frame)));
} finally { frame.recycle(); }
