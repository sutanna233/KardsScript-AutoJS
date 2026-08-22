"use strict";

var out = {
    execArgv: engines.myEngine().execArgv || null,
    arguments: typeof arguments === "undefined" ? null : String(arguments),
    source: engines.myEngine().source || null
};
files.write("/sdcard/AutoJs6/KardsScript/autojs/intent-extra-probe.json", JSON.stringify(out));
