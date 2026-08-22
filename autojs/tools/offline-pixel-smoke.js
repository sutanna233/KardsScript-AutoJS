console.log("pixel-smoke before-read");
var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/kards_current_screen.png");
console.log("pixel-smoke loaded=" + frame.getWidth() + "x" + frame.getHeight());
console.log("pixel-smoke value=" + frame.pixel(100, 100));
frame.recycle();
console.log("pixel-smoke done");
