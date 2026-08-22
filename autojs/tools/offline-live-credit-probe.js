var source = images.read("/sdcard/AutoJs6/KardsScript/fixtures/live-no-overlay.png");
[[25,485,105,95], [25,480,110,100], [30,490,90,80], [35,495,70,70]].forEach(function (box, index) {
    console.log("credit-" + index + "=" + JSON.stringify(ocr(images.clip(source, box[0], box[1], box[2], box[3]))));
});
