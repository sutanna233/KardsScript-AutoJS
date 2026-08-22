var source = images.read("/sdcard/AutoJs6/KardsScript/fixtures/navigation-test-final.png");
var centers = [[280,648],[390,638],[508,630],[625,626],[748,624],[868,628]];
centers.forEach(function (p, i) {
    var clip = images.clip(source, p[0] - 16, p[1] - 18, 32, 36);
    console.log("tight-" + (i + 1) + "=" + JSON.stringify(ocr(clip)));
});
