var self = engines.myEngine(), stopped = 0;
engines.all().forEach(function (engine) {
    if (engine !== self && String(engine.getSource()).indexOf("/tools/offline-") >= 0) {
        engine.forceStop();
        stopped++;
    }
});
console.log("stopped offline diagnostics=" + stopped);
