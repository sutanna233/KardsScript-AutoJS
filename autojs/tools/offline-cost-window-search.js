var source = images.read("/sdcard/AutoJs6/KardsScript/fixtures/navigation-test-final.png");
var id = 0;
[740,744,748,752,756].forEach(function (x) { [618,622,626,630,634].forEach(function (y) {
    var clip = images.clip(source, x - 16, y - 20, 32, 40);
    console.log("w" + (++id) + "@" + x + "," + y + "=" + JSON.stringify(ocr(clip)));
}); });
