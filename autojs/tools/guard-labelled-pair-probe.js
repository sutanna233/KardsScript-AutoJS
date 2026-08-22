// Auto.js-native replay of the user-labelled HQ + guard-unit crop.
// Confirms that the same shield template occurs once at each card corner;
// production must therefore scope the search to the unit corner.
var imagePath = "/sdcard/AutoJs6/KardsScript/fixtures/labelled-guard-pair.png";
var templatePath = "/sdcard/AutoJs6/KardsScript/templates/buttons/guard-marker.png";
var out = "/sdcard/AutoJs6/KardsScript/guard-labelled-pair-probe.json";
var image = images.read(imagePath), template = images.read(templatePath);
try {
    var hq = images.findImage(image, template, { threshold: 0.90, region: [86, 8, 40, 52] });
    var unit = images.findImage(image, template, { threshold: 0.90, region: [190, 8, 34, 52] });
    files.write(out, JSON.stringify({
        image: [image.getWidth(), image.getHeight()],
        template: [template.getWidth(), template.getHeight()],
        hqMarker: hq ? { x: hq.x, y: hq.y } : null,
        unitMarker: unit ? { x: unit.x, y: unit.y } : null
    }));
} catch (error) {
    files.write(out, JSON.stringify({ error: String(error) }));
} finally {
    if (template) template.recycle();
    if (image) image.recycle();
}
exit();
