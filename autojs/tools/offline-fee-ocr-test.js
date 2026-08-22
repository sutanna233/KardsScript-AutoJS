// Runs inside Auto.js6.  The fixture has credits 1/1 and visible card costs
// 3, 4, 3, 2; unknown OCR cells must remain unknown rather than become
// playable guesses.
var config = require("../lib/config");
var vision = require("../lib/vision");
console.log("ocr root=" + typeof ocr + " global=" + (typeof global) + " global.ocr=" + (typeof global.ocr));
var source = images.read("/sdcard/AutoJs6/KardsScript/fixtures/play-card-clean-no-toast.png");
var hand = vision._private.detectHand(source);
var fees = vision._private.enrichHandWithFees(source, hand, config);
console.log(JSON.stringify({
    hand: hand.detail,
    credits: fees.credits,
    costs: hand.cards.map(function (card) { return card.cost; }),
    playable: hand.cards.map(function (card) { return card.playable; })
}));
