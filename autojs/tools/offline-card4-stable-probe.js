var source = images.read("/sdcard/AutoJs6/KardsScript/fixtures/navigation-test-final.png");
var values = [];
for (var i = 0; i < 6; i++) values.push(JSON.stringify(ocr(images.clip(source, 619, 606, 34, 44))));
console.log("card4=" + values.join("|"));
