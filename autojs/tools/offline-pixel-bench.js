var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/kards_current_screen.png");
var started = new Date().getTime(), total = 0;
for (var i = 0; i < 1000; i++) total += frame.pixel((i * 17) % 1280, (i * 31) % 720);
console.log("pixel-bench ms=" + (new Date().getTime() - started) + " total=" + total);
frame.recycle();
