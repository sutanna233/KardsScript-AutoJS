var source = images.read("/sdcard/AutoJs6/KardsScript/fixtures/live-clean-opponent.png");
function read(index, centerX) {
    var clip = images.clip(source, centerX - 28, 600, 56, 80);
    console.log("cost-" + index + "=" + JSON.stringify(ocr(clip)));
}
[357, 502, 650, 797, 942].forEach(function (x, index) { read(index + 1, x); });
