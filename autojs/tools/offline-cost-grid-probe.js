var source = images.read("/sdcard/AutoJs6/KardsScript/fixtures/navigation-test-final.png");
var centers = [280,390,508,625,748,868], ys = [610,618,626,634], id = 0;
centers.forEach(function (x) { ys.forEach(function (y) {
    var clip = images.clip(source, x - 16, y - 20, 32, 40);
    console.log("g" + (++id) + "@" + x + "," + y + "=" + JSON.stringify(ocr(clip)));
}); });
