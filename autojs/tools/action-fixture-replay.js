// Replay one real OUR_TURN frame while intercepting input. This validates
// card choice and destination geometry without touching the live emulator.
var config = require("../lib/config"), vision = require("../lib/vision"), runtime = require("../lib/runtime");
var commands = [];
global.currentPackage = function () { return config.kardsPackage; };
global.shell = function (command) { commands.push(command); return { code: 0 }; };
global.press = function (x, y) { commands.push("press " + x + " " + y); return true; };
global.swipe = function (x1, y1, x2, y2, duration) { commands.push("swipe " + [x1,y1,x2,y2,duration].join(" ")); return true; };
var image = images.read("/sdcard/AutoJs6/KardsScript/fixtures/attack-relaunch-now.png");
var obs = vision.create(config).observe(image); obs.frame = { width: obs.width, height: obs.height };
var bot = runtime.create(Object.assign({}, config, { mode: "automatic", allowNavigation: false, allowBattleActions: true }));
bot.tick(obs);
bot.tick(obs);
files.write("/sdcard/AutoJs6/KardsScript/action-fixture-replay.json", JSON.stringify({ observation: { width: obs.width, height: obs.height, scene: obs.scene, credits: obs.state.credits, hand: obs.state.hand.map(function(c){return {id:c.id,cost:c.cost,playable:c.playable,bounds:c.bounds};}) }, slots: config.deploymentSlots, commands: commands, status: bot.status() }));
image.recycle();
