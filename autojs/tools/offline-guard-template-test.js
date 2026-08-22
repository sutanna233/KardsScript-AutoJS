var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/guard-marker-clean.png");
var template = images.read("/sdcard/AutoJs6/KardsScript/templates/buttons/guard-marker.png");
try {
    var point = images.findImage(frame, template, { threshold: 0.90 });
    console.log("guard-marker-found=" + !!point);
    if (!point) throw new Error("guard marker template was not found in its source image");
} finally { frame.recycle(); template.recycle(); }
console.log("offline guard template test ok");
