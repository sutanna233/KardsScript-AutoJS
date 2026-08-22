// Auto.js6's APK builder packages exactly one JavaScript source file and
// does not follow CommonJS relative imports. Generate a self-contained GUI
// entry by inlining the small, safe preference module.
var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");
var launcher = fs.readFileSync(path.join(root, "launcher.js"), "utf8");
var strategy = fs.readFileSync(path.join(root, "lib", "user-strategy.js"), "utf8")
    .replace(/module\.exports\s*=\s*\{([\s\S]*?)\};\s*$/m, "return {$1};");
launcher = launcher.replace(
    'var userStrategy = require("./lib/user-strategy");',
    'var userStrategy = (function () {\n' + strategy + '\n}());'
).replace(
    'files.join(files.cwd(), "auto-main.js")',
    '"/sdcard/AutoJs6/KardsScript/autojs/auto-main.js"'
);
fs.writeFileSync(path.join(root, "apk-main.js"), launcher, "utf8");
