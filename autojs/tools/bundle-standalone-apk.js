/*
 * Produces a single Auto.js source file for the official inrt packager.
 * Auto.js' one-file packager does not traverse CommonJS imports, so every
 * relative project module is embedded behind a tiny CommonJS loader.
 */
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const modules = new Map();

function syncInrtVersion() {
    const projectSource = fs.readFileSync(path.join(root, "project.json"), "utf8").replace(/^\uFEFF/, "");
    const project = JSON.parse(projectSource);
    const versionName = String(project.versionName || "").trim();
    const versionCode = Number(project.versionCode);
    if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) {
        throw new Error("project.json contains an invalid versionName/versionCode");
    }
    const gradleFile = path.resolve(root, "..", "vendor", "AutoJs6", "app", "build.gradle.kts");
    if (!fs.existsSync(gradleFile)) return false;
    const source = fs.readFileSync(gradleFile, "utf8");
    const start = source.indexOf("create(flavorNameInrt)");
    const end = source.indexOf("\n        androidResources", start);
    if (start < 0 || end < 0) throw new Error("cannot locate AutoJs6 inrt flavor block");
    const before = source.slice(0, start);
    const block = source.slice(start, end)
        .replace(/versionCode\s*=\s*[^\r\n]+/, "versionCode = " + versionCode)
        .replace(/versionName\s*=\s*[^\r\n]+/, "versionName = " + JSON.stringify(versionName));
    if (!/versionCode\s*=\s*\d+/.test(block) || !/versionName\s*=\s*"[^"]+"/.test(block)) {
        throw new Error("failed to update AutoJs6 inrt version fields");
    }
    const updated = before + block + source.slice(end);
    if (updated !== source) fs.writeFileSync(gradleFile, updated, "utf8");
    console.log("Synced inrt manifest version to " + versionName + " (" + versionCode + ")");
    return true;
}

function moduleId(file) {
    return "/" + path.relative(root, file).replace(/\\/g, "/");
}
function resolve(from, request) {
    let candidate = path.resolve(path.dirname(from), request);
    if (!path.extname(candidate)) candidate += ".js";
    if (!fs.existsSync(candidate)) throw new Error("missing module " + request + " from " + from);
    return candidate;
}
function collect(file) {
    file = path.resolve(file);
    if (modules.has(file)) return;
    const source = fs.readFileSync(file, "utf8");
    modules.set(file, source);
    const re = /require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
    let match;
    while ((match = re.exec(source))) collect(resolve(file, match[1]));
}
function registry(files) {
    const body = files.map(file => JSON.stringify(moduleId(file)) + ":function(module,exports,require){\n" + modules.get(file) + "\n}").join(",\n");
    return "var __cometModules={\n" + body + "\n};\n" +
        "var __cometCache={};\n" +
        "function __cometResolve(parent,request){if(request.charAt(0)!=='.')return request;var parts=parent.split('/');parts.pop();request.split('/').forEach(function(p){if(!p||p==='.')return;if(p==='..')parts.pop();else parts.push(p);});var id=parts.join('/');return /\\.js$/.test(id)?id:id+'.js';}\n" +
        "function __cometRequire(request,parent){var id=__cometResolve(parent||'/',request);if(__cometCache[id])return __cometCache[id].exports;var factory=__cometModules[id];if(!factory)throw new Error('Bundled module not found: '+id);var module={exports:{}};__cometCache[id]=module;factory(module,module.exports,function(child){return __cometRequire(child,id);});return module.exports;}\n";
}

const launcherFile = path.join(root, "launcher.js");
const runnerFile = path.join(root, "auto-main.js");
syncInrtVersion();
collect(launcherFile);
const launcherModules = Array.from(modules.keys());
collect(runnerFile);
const runnerModules = Array.from(modules.keys());
const launcher = modules.get(launcherFile)
    .replace(/^\s*"ui";\s*/m, "\"ui\";\n")
    .replace("var userStrategy = require(\"./lib/user-strategy\");", "var userStrategy = __cometRequire('/lib/user-strategy.js');")
    .replace("runner = engines.execScriptFile(files.join(files.cwd(), \"auto-main.js\"));", "runner = engines.execScript(\"KARDS 自动对战\", __COMET_RUNNER_SOURCE);");
const runnerBundle = registry(runnerModules) + "__cometRequire('/auto-main.js');\n";
const output = "\"ui\";\n" + registry(launcherModules) +
    "var __COMET_RUNNER_SOURCE=" + JSON.stringify(runnerBundle) + ";\n" +
    launcher.replace(/^\s*"ui";\s*/m, "");
fs.writeFileSync(path.join(root, "apk-main.js"), output);
console.log("Bundled " + runnerModules.length + " modules into autojs/apk-main.js");
