var config = require("../lib/config"), vision = require("../lib/vision");
var image = images.read("/sdcard/AutoJs6/KardsScript/fixtures/attack-relaunch-now.png");
var obs = vision.create(config).observe(image);
files.write("/sdcard/AutoJs6/KardsScript/ocr-single-attack-relaunch.json", JSON.stringify({screen:obs.uiScreen,scene:obs.scene,credits:obs.state.credits,hand:obs.state.hand.map(function(c){return {id:c.id,cost:c.cost,playable:c.playable,bounds:c.bounds};}),evidence:obs.evidence})); image.recycle();
