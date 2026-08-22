var vision = require("../lib/vision");

function checkerImage(block, colorA, colorB) {
    return {
        getWidth: function () { return 1280; },
        getHeight: function () { return 720; },
        pixel: function (x, y) {
            var cell = Math.floor(x / block) + Math.floor(y / block);
            return cell % 2 === 0 ? colorA : colorB;
        }
    };
}

var WIDE = [0.05, 0.35, 0.75, 0.85];
var icon = [0.35, 0.55, 0.45, 0.95];

var cases = [
    ["checker 8   d0/90", checkerImage(8, 0xffd0d0d0, 0xff909090)],
    ["checker 16  d0/90", checkerImage(16, 0xffd0d0d0, 0xff909090)],
    ["checker 32  d0/90", checkerImage(32, 0xffd0d0d0, 0xff909090)],
    ["checker 64  d0/90", checkerImage(64, 0xffd0d0d0, 0xff909090)],
    ["checker 128 d0/90", checkerImage(128, 0xffd0d0d0, 0xff909090)],
    ["checker 8   e8/58", checkerImage(8, 0xffe8e8e8, 0xff585858)],
    ["checker 64  e8/58", checkerImage(64, 0xffe8e8e8, 0xff585858)]
];

cases.forEach(function (c) {
    var f = vision._private.feature(c[1], icon, 12);
    var result = vision._private.identifyCardType(c[1], WIDE);
    console.log(c[0] + " → E=" + f.E.toFixed(3) + " L=" + f.L.toFixed(1) + " S=" + f.S.toFixed(1) + " → " + result);
});