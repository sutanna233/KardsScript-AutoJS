var self = engines.myEngine(), stopped = 0;
engines.all().forEach(function (engine) {
    // RunIntentActivity reports the external URI differently across Auto.js
    // releases, so match both the conventional filename and the source URI.
    var source = String(engine.getSource());
    if (engine !== self && (source.indexOf("main.js") >= 0 || source.indexOf("KardsScript") >= 0)) {
        engine.forceStop();
        stopped++;
    }
});
console.log("stopped main observers=" + stopped);
