function read(name, x, y, width, height) {
    // AutoJS6's OCR consumes the image it receives.  Re-read the fixture for
    // each crop and intentionally let OCR own the crop bitmap.
    var source = images.read("/sdcard/AutoJs6/KardsScript/fixtures/play-card-clean-no-toast.png");
    var clip = images.clip(source, x, y, width, height);
    // Do not recycle source here: clip may share its underlying bitmap.
    console.log("ocr-" + name + "=" + JSON.stringify(ocr(clip)) + " source-pixel=" + source.pixel(0, 0));
}
read("player-credit", 25, 485, 105, 95);
[
    [357, 651], [506, 626], [654, 626], [804, 631]
].forEach(function (point, index) { read("cost-" + (index + 1), point[0] - 24, point[1] - 24, 48, 48); });
