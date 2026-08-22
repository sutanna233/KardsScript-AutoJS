var vision = require("../lib/vision");
var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/play-card-white-enabled.png");
if (!frame) throw new Error("无法读取手牌探针截图");
try {
    [650, 660].forEach(function (y) {
        var fan = [];
        for (var count = 1; count <= 9; count++) {
            var x = 640 - (count - 1) * 145 / 2;
            if (vision._private.cardAt(frame, x, y)) fan.push(count + "@" + Math.round(x));
        }
        console.log("hand-fan-y" + y + "=" + fan.join(","));
    });
    [620, 640, 660, 680].forEach(function (y) {
        var hits = [];
        for (var x = 300; x <= 950; x += 20) if (vision._private.cardAt(frame, x, y)) hits.push(x);
        console.log("hand-probe-y" + y + "=" + hits.join(","));
    });
} finally { frame.recycle(); }
