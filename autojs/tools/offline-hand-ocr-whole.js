var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/navigation-test-final.png");
console.log(JSON.stringify(ocr(images.clip(frame, 240, 590, 820, 130))));
