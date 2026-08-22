"use strict";

// Runs inside Auto.js6 and invokes its official inrt APK builder directly.
// The source directory has a self-contained `apk-main.js`, so the resulting
// app never needs a separately installed Auto.js6 package.
importClass(java.io.File);
importClass(org.autojs.autojs.apkbuilder.ApkBuilder);
importClass(org.autojs.autojs.project.ProjectConfig);

var root = "/sdcard/AutoJs6/KardsScript/autojs";
var output = "/sdcard/KardsScript/CometAssistant-standalone.apk";
var workspace = "/sdcard/AutoJs6/KardsScript/build-workspace";
var result = "/sdcard/AutoJs6/KardsScript/build-standalone-result.json";

try {
    var config = ProjectConfig.fromFilePath(root + "/project.json");
    if (!config) throw new Error("无法读取 project.json");
    config.setSourcePath(root);
    config.setMainScriptFileName("apk-main.js");
    new ApkBuilder(context.getAssets().open("template.apk"), new File(output), workspace)
        .prepare(context)
        .withConfig(context, config)
        .build(context)
        .sign(context)
        .commitProjectConfigIfNeeded(context)
        .cleanWorkspace(context)
        .finish();
    files.write(result, JSON.stringify({ ok: true, output: output, bytes: new File(output).length() }));
} catch (e) {
    files.write(result, JSON.stringify({ ok: false, error: String(e), stack: String(e.stack || "") }));
    throw e;
}
