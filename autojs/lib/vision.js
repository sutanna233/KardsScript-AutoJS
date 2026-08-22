/*
 * Frame-only KARDS vision. This module intentionally produces no combat
 * target until a visual change is seen in a declared target slot; callers
 * therefore cannot turn an inferred coordinate into a tap.
 */
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
// Avoid Auto.js colors.red()/green()/blue(): each is a Java bridge call and
// makes per-frame sampling take seconds on the emulator. ImageWrapper.pixel
// returns a signed ARGB int, for which unsigned shifts are sufficient.
function red(c) { return (c >>> 16) & 255; }
function green(c) { return (c >>> 8) & 255; }
function blue(c) { return c & 255; }
function luma(c) { return red(c) * 0.2126 + green(c) * 0.7152 + blue(c) * 0.0722; }
function saturation(c) { var high = Math.max(red(c), green(c), blue(c)); var low = Math.min(red(c), green(c), blue(c)); return high === 0 ? 0 : (high - low) / high * 255; }
function pixel(image, x, y) { return image.pixel(clamp(x, 0, image.getWidth() - 1), clamp(y, 0, image.getHeight() - 1)); }

function feature(image, bounds, stride) {
    var x0 = Math.max(0, Math.floor(bounds[0] * image.getWidth())), y0 = Math.max(0, Math.floor(bounds[1] * image.getHeight()));
    var x1 = Math.min(image.getWidth(), Math.floor(bounds[2] * image.getWidth())), y1 = Math.min(image.getHeight(), Math.floor(bounds[3] * image.getHeight()));
    var lum = 0, sat = 0, edges = 0, count = 0, step = stride || 24;
    for (var y = y0; y < y1; y += step) for (var x = x0; x < x1; x += step) {
        var color = pixel(image, x, y), here = luma(color); lum += here; sat += saturation(color);
        if (x + step < x1 && Math.abs(here - luma(pixel(image, x + step, y))) > 36) edges++;
        count++;
    }
    return { L: lum / Math.max(1, count), S: sat / Math.max(1, count), E: edges / Math.max(1, count) };
}
function matches(value, rule) {
    return (rule.minL === undefined || value.L >= rule.minL) && (rule.maxL === undefined || value.L <= rule.maxL) &&
        (rule.minS === undefined || value.S >= rule.minS) && (rule.maxS === undefined || value.S <= rule.maxS) &&
        (rule.minE === undefined || value.E >= rule.minE) && (rule.maxE === undefined || value.E <= rule.maxE);
}
function confidence(value, rule) {
    var a = [], sum = 0;
    if (rule.minL !== undefined) a.push(Math.min(1, value.L / rule.minL)); if (rule.maxL !== undefined) a.push(Math.min(1, rule.maxL / Math.max(1, value.L)));
    if (rule.minS !== undefined) a.push(Math.min(1, value.S / rule.minS)); if (rule.maxS !== undefined) a.push(Math.min(1, rule.maxS / Math.max(1, value.S)));
    if (rule.minE !== undefined) a.push(Math.min(1, value.E / rule.minE)); if (rule.maxE !== undefined) a.push(Math.min(1, rule.maxE / Math.max(0.0001, value.E)));
    for (var i = 0; i < a.length; i++) sum += a[i]; return a.length ? sum / a.length : 0;
}
function classifyScreen(image, config) {
    var cached = {}, best = { screen: "UNKNOWN", confidence: 0, ruleId: "unmatched", priority: -1 };
    function get(name) { if (!cached[name]) cached[name] = feature(image, config.regions[name]); return cached[name]; }
    config.uiRules.forEach(function (rule) {
        var ok = true, total = 0;
        rule.anchors.forEach(function (anchor) { var value = get(anchor.r); if (!matches(value, anchor)) ok = false; total += confidence(value, anchor); });
        var score = total / rule.anchors.length;
        if (ok && (rule.priority > best.priority || (rule.priority === best.priority && score > best.confidence))) best = { screen: rule.screen, confidence: score, ruleId: rule.id, priority: rule.priority };
    });
    // The selected mode is indicated by orange text.  A training selection
    // opens the deck chooser while the same flyout remains visible, so the
    // broad MODE_MENU anchors alone cannot distinguish these screens.
    if (best.screen === "MODE_MENU") {
        var trainingOrange = orangeRatio(image, [0.20, 0.31, 0.40, 0.41]);
        var battleOrange = orangeRatio(image, [0.20, 0.22, 0.40, 0.31]);
        if (trainingOrange > 0.03 && trainingOrange > battleOrange * 1.25) {
            var startFeature = feature(image, config.regions.deckStartButton);
            if (startFeature.L >= 70) return { screen: "DECK_DETAIL", confidence: 0.92, ruleId: "training-deck-detail", priority: 70 };
            return { screen: "DECK_LIST", confidence: 0.92, ruleId: "training-deck-chooser-selected", priority: 70 };
        }
    }
    // During the board fade-in the top HUD can be almost black, so the
    // normal battle rule (topUi minL=25) may miss for a few frames.  A bright,
    // saturated End Turn control together with the board-side panel is a
    // stronger fallback.  The minimums are deliberately above the shop
    // promo-card values, which prevents the old global template false hit.
    var endTurn = get("endTurnUi"), boardPanel = get("rightPanel"), playerBoard = get("playerHqAnchor"), topHud = get("topUi");
    if (best.screen !== "MULLIGAN" && topHud.L <= 35 && endTurn.S >= 60 && endTurn.E >= 0.15 && boardPanel.S >= 55 && playerBoard.E >= 0.20) {
        return { screen: "BATTLE", confidence: 0.90, ruleId: "battle-strong-end-turn", priority: 60 };
    }
    return best;
}
function resolveTemplatePath(path) {
    if (typeof files === "undefined" || !path) return null;
    var cwd = files.cwd(), candidates = [path, files.join(cwd, path), files.join(cwd, "..", path)];
    for (var i = 0; i < candidates.length; i++) if (files.exists(candidates[i])) return candidates[i];
    return null;
}
// Template bitmaps are immutable for the lifetime of one Auto.js engine.
// Loading and decoding the same five unit icons once per occupied slot made
// the first battle frame take more than 13 seconds on the emulator. Keep one
// process-local ImageWrapper per resolved path; the engine releases them when
// the script exits. Captured screen frames are still owned/recycled normally.
var templateImageCache = {};
var maskTemplateImageCache = {};
function loadTemplate(path) {
    var resolved = resolveTemplatePath(path);
    if (typeof images === "undefined" || !resolved) return null;
    if (Object.prototype.hasOwnProperty.call(templateImageCache, resolved)) return templateImageCache[resolved];
    try {
        templateImageCache[resolved] = images.read(resolved);
    } catch (e) {
        templateImageCache[resolved] = null;
    }
    return templateImageCache[resolved];
}
function loadMaskTemplate(path) {
    var resolved = resolveTemplatePath(path);
    if (typeof images === "undefined" || !resolved || typeof images.grayscale !== "function") return null;
    if (Object.prototype.hasOwnProperty.call(maskTemplateImageCache, resolved)) return maskTemplateImageCache[resolved];
    var raw = loadTemplate(path);
    if (!raw) { maskTemplateImageCache[resolved] = null; return null; }
    try { maskTemplateImageCache[resolved] = images.grayscale(raw); }
    catch (e) { maskTemplateImageCache[resolved] = null; }
    return maskTemplateImageCache[resolved];
}
function findTemplate(image, path, config) {
    var template = loadTemplate(path), point = null;
    if (!template) return null;
    // Search only the current End Turn region. A full-screen search can
    // match similar orange/white text in cards or shop promotions.
    var regionBounds = config.regions && config.regions.endTurnUi || [0.82, 0.67, 0.98, 0.77];
    var x = Math.round(image.getWidth() * regionBounds[0]), y = Math.round(image.getHeight() * regionBounds[1]);
    var right = Math.round(image.getWidth() * regionBounds[2]), bottom = Math.round(image.getHeight() * regionBounds[3]);
    if (right - x < template.getWidth() || bottom - y < template.getHeight()) return null;
    point = images.findImage(image, template, {
        threshold: config.templateThreshold,
        region: [x, y, right - x, bottom - y]
    });
    return point;
}
function findTemplateInRegion(image, path, threshold, bounds) {
    if (!bounds) return null;
    var template = loadTemplate(path);
    if (!template) return null;
    var point = null, width = template.getWidth(), height = template.getHeight();
    var x = Math.round(bounds[0] * image.getWidth()), y = Math.round(bounds[1] * image.getHeight());
    var right = Math.round(bounds[2] * image.getWidth()), bottom = Math.round(bounds[3] * image.getHeight());
    // Auto.js6 throws instead of returning null when a template is larger
    // than its constrained region. Guard this explicitly; a guard icon
    // or result template must never terminate an attack probe/runtime.
    if (right - x < width || bottom - y < height) return null;
    point = images.findImage(image, template, { threshold: threshold, region: [x, y, right - x, bottom - y] });
    return point ? { x: point.x, y: point.y, width: width, height: height } : null;
}
function templateSimilarityInRegion(image, path, candidateThreshold, bounds) {
    if (!bounds) return null;
    var template = loadTemplate(path);
    if (!template) return null;
    var width = template.getWidth(), height = template.getHeight();
    var x = Math.round(bounds[0] * image.getWidth()), y = Math.round(bounds[1] * image.getHeight());
    var right = Math.round(bounds[2] * image.getWidth()), bottom = Math.round(bounds[3] * image.getHeight());
    if (right - x < width || bottom - y < height) return null;
    // Auto.js6 exposes the native OpenCV similarity through matchTemplate.
    // findImage only returns a point, so it cannot compare a tank hit against
    // an earlier, weaker infantry hit.
    if (typeof images !== "undefined" && typeof images.matchTemplate === "function") {
        try {
            var result = images.matchTemplate(image, template, {
                threshold: candidateThreshold, max: 1,
                region: [x, y, right - x, bottom - y]
            });
            var best = result && typeof result.best === "function" ? result.best() :
                (result && result.matches && result.matches.length ? result.matches[0] : null);
            if (best && typeof best.similarity === "number") return best.similarity;
            return null;
        } catch (nativeError) {}
    }
    // Node/unit-test compatibility. Without comparable similarity values,
    // retain the page-bounded yes/no matcher and let ordering break the tie.
    return findTemplateInRegion(image, path, candidateThreshold, bounds) ? candidateThreshold : null;
}
function maskTemplateSimilarityInRegion(image, path, candidateThreshold, bounds) {
    if (!bounds) return null;
    var template = loadMaskTemplate(path);
    if (!template) return null;
    var width = template.getWidth(), height = template.getHeight();
    var x = Math.round(bounds[0] * image.getWidth()), y = Math.round(bounds[1] * image.getHeight());
    var right = Math.round(bounds[2] * image.getWidth()), bottom = Math.round(bounds[3] * image.getHeight());
    if (right - x < width || bottom - y < height) return null;
    try {
        var result = images.matchTemplate(image, template, {
            threshold: candidateThreshold, max: 1,
            region: [x, y, right - x, bottom - y]
        });
        var best = result && typeof result.best === "function" ? result.best() :
            (result && result.matches && result.matches.length ? result.matches[0] : null);
        return best && typeof best.similarity === "number" ? best.similarity : null;
    } catch (maskMatchError) { return null; }
}
function orangeRatio(image, bounds) {
    var width = image.getWidth(), height = image.getHeight();
    var x0 = Math.max(0, Math.floor(bounds[0] * width)), y0 = Math.max(0, Math.floor(bounds[1] * height));
    var x1 = Math.min(width, Math.floor(bounds[2] * width)), y1 = Math.min(height, Math.floor(bounds[3] * height));
    var orange = 0, total = 0;
    for (var y = y0; y < y1; y += 6) for (var x = x0; x < x1; x += 6) {
        var c = pixel(image, x, y), r = red(c), g = green(c), b = blue(c);
        if (r > 100 && r - g > 25 && g - b > 20) orange++;
        total++;
    }
    return orange / Math.max(1, total);
}
function hasBlockingOverlay(image, config) {
    // The lower-centre brightness heuristic overlaps the real hand fan. It
    // may only be enabled explicitly by a diagnostic script that renders an
    // overlay; production automatic mode does not use toast().
    if (!config || config.detectGenericBlockingOverlay !== true) return false;
    var bounds = config.regions && config.regions.blockingOverlay;
    if (!bounds) return false;
    // The mulligan confirmation button is a bright, low-saturation panel in
    // this exact lower-centre region. Do not let the generic toast detector
    // hide the mulligan header before the page-specific template can run.
    // This was the reason the bot waited through the entire replacement
    // countdown without ever clicking 确认.
    if (config.templates && config.regions) {
        var mulliganHeader = config.templates.mulliganHeader && config.regions.mulliganHeader &&
            findTemplateInRegion(image, config.templates.mulliganHeader, Math.min(0.76, config.templateThreshold), config.regions.mulliganHeader);
        var mulliganConfirm = config.templates.mulliganConfirm && config.regions.mulliganConfirm &&
            findTemplateInRegion(image, config.templates.mulliganConfirm, Math.min(0.76, config.templateThreshold), config.regions.mulliganConfirm);
        if (mulliganHeader || mulliganConfirm) return false;
    }
    var f = feature(image, bounds, 12);
    return f.L >= 140 && f.S <= 45 && f.E >= 0.05;
}
function guardIconBounds(unitBounds) {
    // User-labelled pair: the HQ shield and the adjacent guard-unit shield
    // both sit at their own card's top-right corner. The old broad region
    // covered most of the card and could absorb the HQ marker or a bottom
    // stat icon. Search only the unit's measured top-right marker pocket.
    return [
        Math.max(0, unitBounds[2] - 0.018),
        Math.max(0, unitBounds[1] - 0.012),
        Math.min(1, unitBounds[2] + 0.030),
        Math.min(1, unitBounds[1] + 0.085)
    ];
}
function detectEnemyGuardMarkers(image, config, detectedUnits) {
    var templates = config.templates || {}, threshold = config.guardTemplateThreshold || config.templateThreshold;
    // Prefer the current frame's enemy-unit bounds.  Static slots are only a
    // fallback for frames where occupancy could not be measured; this keeps
    // a friendly HQ/unit shield out of the enemy guard result when the board
    // layout shifts horizontally.
    var slots = (detectedUnits || []).filter(function (unit) { return unit.owner === "ENEMY"; }).map(function (unit) {
        return { id: unit.id, bounds: unit.bounds };
    });
    if (!slots.length) slots = activeSlots(config).filter(function (slot) { return slot.kind === "ENEMY_UNIT"; }).map(function (slot) {
        return { id: slot.id, bounds: slot.bounds };
    });
    return slots.map(function (slot) {
        var region = guardIconBounds(slot.bounds), match = null;
        [templates.guardMarkerEnemy, templates.guardMarker].some(function (path) {
            if (!path) return false;
            match = findTemplateInRegion(image, path, threshold, region);
            return !!match;
        });
        return match ? { slotId: slot.id, confidence: 0.95 } : null;
    }).filter(function (marker) { return marker !== null; });
}
// HQ cards are not screen-anchored: board layouts, faction art and emulator
// scaling can move them horizontally. Find the strongest card-like block in
// each half of the board, while keeping a mild centre bias so a unit does not
// become an HQ merely because it has a bright border.
function detectHqBounds(image, isEnemy, config) {
    var y0 = isEnemy ? 0.08 : 0.54, y1 = isEnemy ? 0.43 : 0.86;
    var expectedY = isEnemy ? 0.22 : 0.70;
    var expectedX = config.hqExpectedX && (isEnemy ? config.hqExpectedX.enemy : config.hqExpectedX.player);
    if (typeof expectedX !== "number") expectedX = isEnemy ? 0.45 : 0.50;
    var best = null;
    // The HQ card itself is roughly 0.08 screen-width; a wide search window
    // would absorb a neighbouring unit and report the midpoint between them.
    // Keep the probe close to the card silhouette and let it slide across the
    // half-board instead.
    function borderContrast(b) {
        var w = image.getWidth(), h = image.getHeight(), x0 = Math.round(b[0] * w), x1 = Math.round(b[2] * w), y0p = Math.round(b[1] * h), y1p = Math.round(b[3] * h), sum = 0, n = 0;
        for (var t = 0.08; t < 0.93; t += 0.14) {
            var yy = Math.round(y0p + (y1p - y0p) * t), xx = Math.round(x0 + (x1 - x0) * t);
            sum += Math.abs(luma(pixel(image, x0 - 3, yy)) - luma(pixel(image, x0 + 3, yy))) / 255;
            sum += Math.abs(luma(pixel(image, x1 - 3, yy)) - luma(pixel(image, x1 + 3, yy))) / 255;
            sum += Math.abs(luma(pixel(image, xx, y0p - 3)) - luma(pixel(image, xx, y0p + 3))) / 255;
            sum += Math.abs(luma(pixel(image, xx, y1p - 3)) - luma(pixel(image, xx, y1p + 3))) / 255;
            n += 4;
        }
        return sum / Math.max(1, n);
    }
    function unitOverlapPenalty(b) {
        var penalty = 0;
        (config.unitSlots || []).forEach(function (slot) {
            if (slot.owner !== (isEnemy ? "ENEMY" : "PLAYER")) return;
            var ix = Math.max(0, Math.min(b[2], slot.bounds[2]) - Math.max(b[0], slot.bounds[0]));
            var iy = Math.max(0, Math.min(b[3], slot.bounds[3]) - Math.max(b[1], slot.bounds[1]));
            var area = (b[2] - b[0]) * (b[3] - b[1]);
            penalty = Math.max(penalty, ix * iy / Math.max(0.0001, area));
        });
        return penalty;
    }
    for (var y = y0; y <= y1 - 0.20; y += 0.02) for (var x = 0.18; x <= 0.82; x += 0.015) {
        var b = [x, y, x + 0.085, y + 0.20], f = feature(image, b, 10), border = borderContrast(b);
        // Do not assume the HQ is centred: some boards place it beside a
        // command unit. Only a very small penalty suppresses totally remote
        // bright art without pulling the box away from the detected card.
        var centrePenalty = Math.abs((x + 0.0425) - expectedX) * 0.55 + Math.abs((y + 0.10) - expectedY) * 0.05;
        var score = border * 2.0 + f.E * 0.35 + f.S / 255 * 0.08 + f.L / 255 * 0.04 - centrePenalty - unitOverlapPenalty(b) * 1.2;
        if (!best || score > best.score) best = { bounds: b, score: score };
    }
    if (!best || best.score < 0.16) return null;
    // Return a slightly wider interaction box centred between the visual
    // candidate and the layout baseline. This tolerates card-border crops and
    // still places the drag/tap inside the HQ art when the board shifts.
    var foundX = (best.bounds[0] + best.bounds[2]) / 2;
    var foundY = (best.bounds[1] + best.bounds[3]) / 2;
    var cx = (foundX + expectedX) / 2;
    return [Math.max(0, cx - 0.06), Math.max(0, foundY - 0.12), Math.min(1, cx + 0.06), Math.min(1, foundY + 0.12)];
}
// The support-line formation is much more stable than an absolute HQ x.
// HQ may be at either end after the row rearranges, so card order alone is
// not identity. Score the whole card chain, then prefer the member whose
// header is the low-saturation, text-heavy HQ title rather than a coloured
// unit cost/header.
function detectFormationHqBounds(image, isEnemy) {
    if (!image) return null;
    var yStarts = isEnemy ? [0.12, 0.13, 0.14, 0.15, 0.16] : [0.57, 0.58, 0.59, 0.60, 0.61, 0.62];
    var width = 0.085, height = 0.20, candidates = [];
    function borderScore(bounds) {
        var w = image.getWidth(), h = image.getHeight();
        var x0 = Math.round(bounds[0] * w), x1 = Math.round(bounds[2] * w);
        var y0 = Math.round(bounds[1] * h), y1 = Math.round(bounds[3] * h);
        var sum = 0, hits = 0, count = 0;
        for (var i = 1; i <= 10; i++) {
            var yy = Math.round(y0 + (y1 - y0) * i / 11);
            var xx = Math.round(x0 + (x1 - x0) * i / 11);
            var deltas = [
                Math.abs(luma(pixel(image, x0 - 3, yy)) - luma(pixel(image, x0 + 3, yy))),
                Math.abs(luma(pixel(image, x1 - 3, yy)) - luma(pixel(image, x1 + 3, yy))),
                Math.abs(luma(pixel(image, xx, y0 - 3)) - luma(pixel(image, xx, y0 + 3))),
                Math.abs(luma(pixel(image, xx, y1 - 3)) - luma(pixel(image, xx, y1 + 3)))
            ];
            deltas.forEach(function (delta) { sum += delta; if (delta >= 25) hits++; count++; });
        }
        return hits / Math.max(1, count) * 4 + sum / Math.max(1, count) / 255;
    }
    yStarts.forEach(function (y) {
        for (var x = 0.20; x <= 0.78; x += 0.005) {
            var bounds = [x, y, x + width, y + height];
            candidates.push({ x: x, y: y, bounds: bounds, score: borderScore(bounds) });
        }
    });
    candidates.sort(function (a, b) { return b.score - a.score; });
    var peaks = [];
    candidates.some(function (candidate) {
        if (candidate.score < 1.75) return true;
        if (!peaks.some(function (peak) { return Math.abs(peak.x - candidate.x) < 0.065 && Math.abs(peak.y - candidate.y) < 0.045; })) peaks.push(candidate);
        return peaks.length >= 24;
    });
    var chainMembers = peaks.filter(function (candidate) {
        return peaks.some(function (other) {
            var gap = Math.abs(other.x - candidate.x);
            return gap >= 0.095 && gap <= 0.135 && Math.abs(other.y - candidate.y) <= 0.04;
        });
    });
    var best = null;
    if (chainMembers.length) {
        chainMembers.forEach(function (candidate) {
            var header = feature(image, [candidate.x, candidate.y, candidate.x + width, Math.min(1, candidate.y + 0.06)], 3);
            candidate.hqVisualScore = candidate.score + (1 - header.S / 255) * 1.2 + header.E * 2.5;
        });
        chainMembers.sort(function (a, b) { return b.hqVisualScore - a.hqVisualScore || b.score - a.score; });
        best = chainMembers[0];
    } else if (peaks.length) {
        var expected = isEnemy ? 0.35 : 0.32;
        peaks.sort(function (a, b) {
            return (b.score - Math.abs(b.x - expected) * 2) - (a.score - Math.abs(a.x - expected) * 2);
        });
        best = peaks[0];
    }
    return best ? best.bounds : null;
}
function hqHeaderIdentityScore(image, bounds) {
    if (!image || !bounds) return -1;
    var header = feature(image, [bounds[0], bounds[1], bounds[2], Math.min(1, bounds[1] + 0.06)], 2);
    return (1 - header.S / 255) * 1.2 + header.E * 2.5;
}
function detectHqByHealth(image, isEnemy) {
    if (!image) return null;
    var w = image.getWidth(), h = image.getHeight();
    var x0 = Math.round(w * 0.18), x1 = Math.round(w * 0.82);
    // Health digits live in the lower portion of the HQ card. Scanning the
    // entire formation row allowed red/orange unit artwork and action-cost
    // digits above the health band to win by component area, which moved the
    // inferred HQ onto a tank and shifted every unit source coordinate. Keep
    // the scan on the measured health band instead.
    var y0 = Math.round(h * (isEnemy ? 0.20 : 0.70));
    var y1 = Math.round(h * (isEnemy ? 0.35 : 0.83));
    var redPixels = {}, keys = [], sampleStep = 2;
    // Auto.js image.pixel() crosses the Java bridge. Sampling every second
    // pixel preserves the large health glyph while reducing this first-frame
    // sweep to one quarter of its former cost.
    for (var y = y0; y < y1; y += sampleStep) for (var x = x0; x < x1; x += sampleStep) {
        var color = pixel(image, x, y), r = red(color), g = green(color), b = blue(color);
        if (r > 105 && r > g * 1.35 && r > b * 1.25) {
            var key = y * w + x;
            redPixels[key] = true;
            keys.push(key);
        }
    }
    var components = [], offsets = [
        -w * sampleStep - sampleStep, -w * sampleStep, -w * sampleStep + sampleStep,
        -sampleStep, sampleStep,
        w * sampleStep - sampleStep, w * sampleStep, w * sampleStep + sampleStep
    ];
    keys.forEach(function (seed) {
        if (!redPixels[seed]) return;
        var stack = [seed], area = 0, minX = w, maxX = 0, minY = h, maxY = 0, sumX = 0, sumY = 0;
        delete redPixels[seed];
        while (stack.length) {
            var key = stack.pop(), py = Math.floor(key / w), px = key - py * w;
            area++; sumX += px; sumY += py;
            if (px < minX) minX = px; if (px > maxX) maxX = px;
            if (py < minY) minY = py; if (py > maxY) maxY = py;
            offsets.forEach(function (offset) {
                var next = key + offset;
                if (redPixels[next]) { delete redPixels[next]; stack.push(next); }
            });
        }
        if (area >= 18) components.push({ area: area, width: maxX - minX + sampleStep, height: maxY - minY + sampleStep, cx: sumX / area, cy: sumY / area });
    });
    var glyphs = components.filter(function (part) { return part.area >= 31 && part.height >= 22 && part.width <= 30; });
    if (!glyphs.length) return null;
    glyphs.sort(function (a, b) { return b.area - a.area; });
    var best = glyphs[0], neighbours = components.filter(function (part) {
        return part.area >= 20 && part.height >= 18 && part.width <= 30 && Math.abs(part.cx - best.cx) <= 34 && Math.abs(part.cy - best.cy) <= 12;
    });
    var total = 0, sumX = 0, sumY = 0;
    neighbours.forEach(function (part) { total += part.area; sumX += part.cx * part.area; sumY += part.cy * part.area; });
    var centreX = sumX / Math.max(1, total), centreY = sumY / Math.max(1, total);
    var left = Math.max(0, centreX / w - 0.0425), top = Math.max(0, centreY / h - 0.15);
    return [left, top, Math.min(1, left + 0.085), Math.min(1, top + 0.20)];
}
function dynamicFormationUnitSlots(hqSlots) {
    function hq(kind) {
        var slot = (hqSlots || []).filter(function (candidate) { return candidate.kind === kind; })[0];
        return slot && slot.bounds;
    }
    var enemy = hq("ENEMY_HQ"), player = hq("FRIENDLY_HQ"), slots = [];
    function append(owner, hqBounds, rearY, frontY) {
        if (!hqBounds) return;
        var hqCenter = (hqBounds[0] + hqBounds[2]) / 2;
        [-1, 1].forEach(function (direction) { for (var i = 1; i <= 3; i++) {
            var cx = hqCenter + direction * 0.115 * i;
            if (cx < 0.12 || cx > 0.90) continue;
            var suffix = (direction < 0 ? "left-" : "right-") + i;
            slots.push({ id: (owner === "ENEMY" ? "enemy-rear-" : "player-rear-") + suffix, owner: owner,
                bounds: [cx - 0.043, rearY[0], cx + 0.043, rearY[1]], isFrontline: false, minEdgeDensity: owner === "PLAYER" ? 0.23 : 0.20 });
            slots.push({ id: (owner === "ENEMY" ? "enemy-front-" : "player-front-") + suffix, owner: owner,
                bounds: [cx - 0.043, frontY[0], cx + 0.043, frontY[1]], isFrontline: true, minEdgeDensity: owner === "PLAYER" ? 0.23 : 0.20 });
        }});
    }
    // The shared frontline card is taller/lower than the enemy support row.
    // Real 2026-08-22 evidence places it at roughly y=.37..58. The old
    // .34..51 probe stopped above the bottom icon/health edge, producing
    // E=.167 (<.20) and making the runtime attempt an illegal empty-lane
    // move while an enemy frontline unit was visibly present.
    append("ENEMY", enemy, [0.14, 0.34], [0.36, 0.59]);
    append("PLAYER", player, [0.60, 0.82], [0.36, 0.59]);
    return slots;
}
function activeSlots(config) { return config._activeTargetSlots || config.targetSlots || []; }
function detectFrontlineControl(image) {
    if (!image) return { owner: "UNKNOWN", y: null, confidence: 0 };
    var width = image.getWidth(), height = image.getHeight(), best = null;
    // The jagged shared-frontline divider spans most of the board. Card
    // borders are local; score the fraction of the full horizontal strip
    // whose vertical contrast changes together.
    for (var y = Math.round(height * 0.28); y <= Math.round(height * 0.64); y += 2) {
        var hits = 0, sum = 0, count = 0;
        for (var x = Math.round(width * 0.20); x < Math.round(width * 0.82); x += 8) {
            var delta = Math.abs(luma(pixel(image, x, y - 4)) - luma(pixel(image, x, y + 4)));
            sum += delta;
            if (delta >= 18) hits++;
            count++;
        }
        var score = hits / Math.max(1, count) * 100 + sum / Math.max(1, count) * 0.25;
        if (!best || score > best.score) best = { y: y, score: score };
    }
    if (!best || best.score < 45) return { owner: "UNKNOWN", y: best ? best.y : null, confidence: 0 };
    var normalizedY = best.y / height;
    // Divider above the shared row: our territory extends upward and we own
    // the frontline. Divider below it: the enemy owns it. Near the centre is
    // the neutral line and no side is assigned a frontline unit blindly.
    var owner = normalizedY <= 0.43 ? "PLAYER" : normalizedY >= 0.54 ? "ENEMY" : "NEUTRAL";
    return { owner: owner, y: best.y, confidence: clamp(best.score / 100, 0, 0.99) };
}
function detectTurnTransitionBanner(image) {
    if (!image) return false;
    var width = image.getWidth(), height = image.getHeight();
    var x0 = Math.floor(width * 0.28), x1 = Math.floor(width * 0.75);
    var y0 = Math.floor(height * 0.40), y1 = Math.floor(height * 0.55);
    var orange = 0, total = 0;
    // The large FRIENDLY/ENEMY TURN banner paints saturated orange glyphs
    // across the middle of a dark strip. Acting under it hides the real
    // frontline card and can turn an enemy-controlled line into a false
    // neutral reading. Normal unit/card orange occupies far less of this
    // wide centre region.
    for (var y = y0; y < y1; y += 3) for (var x = x0; x < x1; x += 3) {
        var c = pixel(image, x, y), r = red(c), g = green(c), b = blue(c);
        total++;
        if (r >= 150 && r - g >= 35 && g - b >= 15) orange++;
    }
    return total > 0 && orange / total >= 0.07;
}
function detectBattleTurn(image, config) {
    var templates = config.templates || {};
    var turnBounds = config.regions && config.regions.endTurnUi || [0.82, 0.67, 0.98, 0.77];
    var orange = orangeRatio(image, turnBounds);
    // The orange control occupies only a small fraction of this search
    // region (the rest is dark background); on dim maps its ratio is often
    // 0.02–0.06. Keep this threshold low because the region is button-
    // constrained. Orange means the End Turn control is active; it does not
    // prove that cards or units have no remaining action.
    var oursOrangeThreshold = config.ourTurnOrangeRatio || 0.02;
    // A strong colour hit inside the tightly measured button region is the
    // fastest and most direct evidence. Do not initialize OpenCV or run two
    // templates on every ordinary orange frame.
    if (orange >= oursOrangeThreshold) {
        return { scene: "OUR_TURN", confidence: 0.95, ruleId: "orange-end-turn", endTurnOnly: false };
    }
    // White artwork reading 结束回合 is also an active player control. In the
    // latest real Japanese-training board it measured L=40.6/E=0.333; the
    // actual 敌方 control measured L=21.7/E=0.222. The older L>=45 gate
    // therefore froze a genuine 2/2 player turn. Require both the measured
    // brightness and stronger text-edge density instead of saturation alone.
    var control = feature(image, turnBounds);
    // 2026-08-22 live frame: the active white/orange control measured
    // L=44.55/E=.259/S=80.64. Requiring E>=.30 sent it into the saturation
    // fallback below, which incorrectly labels any S>=50 control as the
    // opponent turn. The measured opponent control is much darker (L~21.7),
    // so retain the brightness guard and accept the real text edge density.
    if (control.L >= 35 && control.E >= 0.24) {
        return { scene: "OUR_TURN", confidence: 0.90, ruleId: "white-end-turn-ui", endTurnOnly: false };
    }
    if (control.S >= 50) return { scene: "OPPONENT_TURN", confidence: 0.90, ruleId: "grey-end-turn" };
    // Only ambiguous colour/lighting reaches the page-constrained templates.
    if (findTemplate(image, templates.battleOurTurn, config)) {
        return { scene: "OUR_TURN", confidence: 0.99, ruleId: "template-end-turn", endTurnOnly: false };
    }
    if (findTemplate(image, templates.battleOurTurnWhite, config)) {
        return { scene: "OUR_TURN", confidence: 0.99, ruleId: "template-our-turn-white", endTurnOnly: false };
    }
    if (findTemplate(image, templates.battleOpponentTurn, config)) return { scene: "OPPONENT_TURN", confidence: 0.99, ruleId: "template-opponent-turn" };
    return null;
}
function detectResultScreen(image, config) {
    var templates = config.templates || {};
    var continueButton = findTemplateInRegion(image, templates.resultContinue, config.templateThreshold, config.regions.resultContinue);
    if (continueButton) return { id: "continue", match: continueButton };
    var reward = findTemplateInRegion(image, templates.resultNextReward, config.templateThreshold, config.regions.resultReward);
    if (reward) return { id: "next-reward", match: reward };
    // The top-right 查看战场/离开战场 controls are replay navigation, not
    // the result action. Never promote either template to an actionable
    // RESULT screen; wait for the bottom-center 继续 control instead.
    // Current reward-level overlay: dimmed board, large central rank/reward
    // artwork, and the bottom-centre 继续 label. Its blurred map background
    // changes every match, so an old full-colour template is not stable. This
    // bounded structural rule deliberately maps only to RESULT_CONTINUE; it
    // never selects the top-right 查看战场/离开战场 control.
    var top = feature(image, config.regions.topUi), reward = feature(image, config.regions.resultReward);
    var continueRegion = feature(image, config.regions.resultContinue), turn = feature(image, config.regions.endTurnUi);
    if (top.L < 25 && reward.L >= 30 && reward.L <= 85 && reward.E >= 0.14 &&
        continueRegion.E >= 0.05 && turn.L < 12) {
        return { id: "continue", match: { heuristic: true } };
    }
    return null;
}
function detectMulliganScreen(image, config) {
    var templates = config.templates || {};
    var threshold = Math.min(0.76, config.templateThreshold);
    return findTemplateInRegion(image, templates.mulliganHeader, threshold, config.regions.mulliganHeader) ||
        findTemplateInRegion(image, templates.mulliganConfirm, threshold, config.regions.mulliganConfirm);
}
function detectPromoPopup(image, config) {
    var templates = config.templates || {}, regions = config.regions || {};
    if (!templates.popupClosePromo || !regions.popupClosePromo) return null;
    // The real modal dims and blurs the persistent top HUD. The same small X
    // template can otherwise correlate with shop artwork on a normal bright
    // page, causing a HOME→product→close loop.
    var top = regions.topUi && feature(image, regions.topUi, 8);
    if (!top || top.L > 35 || top.E > 0.05) return null;
    return findTemplateInRegion(image, templates.popupClosePromo,
        Math.max(0.90, config.templateThreshold || 0), regions.popupClosePromo);
}
// 对战卡组详情页的排位/休闲选中状态。返回 "ranked" | "casual" | null。
// 模板限定在各自实测按钮区域；两状态同时命中或都不命中时返回 null（不猜）。
function detectDeckModeToggle(image, config) {
    var templates = config.templates || {};
    if (!templates.deckRankedSelected && !templates.deckCasualSelected) return null;
    var threshold = Math.max(0.82, config.templateThreshold || 0.82);
    var rankedOn = templates.deckRankedSelected &&
        findTemplateInRegion(image, templates.deckRankedSelected, threshold, [0.70, 0.68, 0.86, 0.82]);
    var casualOn = templates.deckCasualSelected &&
        findTemplateInRegion(image, templates.deckCasualSelected, threshold, [0.82, 0.68, 0.98, 0.82]);
    if (rankedOn && !casualOn) return "ranked";
    if (casualOn && !rankedOn) return "casual";
    return null;
}
// 检测模式菜单中"对战模式"是否已选中（金色高亮）。
// 已选中时 MODE_MENU 应直接点卡组，不再重复点模式行。
function detectVersusSelected(image, config) {
    var templates = config.templates || {};
    if (!templates.modeVersusSelected) return false;
    return !!findTemplateInRegion(image, templates.modeVersusSelected,
        Math.max(0.82, config.templateThreshold || 0.82), [0.18, 0.14, 0.39, 0.40]);
}
function classifyScene(image, screen, config, detectedTurn) {
    if (screen.screen === "HOME") return { scene: "MENU", confidence: screen.confidence, ruleId: screen.ruleId };
    if (screen.screen === "MULLIGAN") return { scene: "MULLIGAN", confidence: screen.confidence, ruleId: screen.ruleId };
    if (screen.screen === "RESULT") return { scene: "RESULT", confidence: screen.confidence, ruleId: screen.ruleId };
    if (screen.screen === "RECONNECT") return { scene: "RECONNECTING", confidence: screen.confidence, ruleId: screen.ruleId };
    if (screen.screen !== "BATTLE") return { scene: "UNKNOWN", confidence: screen.confidence, ruleId: screen.ruleId };
    if (detectedTurn) return detectedTurn;
    // The current build renders the turn control at right-middle.  The old
    // bottom-ui luminance heuristic sampled the card fan and labeled both
    // turns as OUR_TURN.  Saturation of the control separates orange player
    // turn from the grey opponent state on the calibrated screenshots.
    var turnControl = feature(image, config.regions.endTurnUi || config.regions.bottomUi);
    if (turnControl.S >= 100) return { scene: "OUR_TURN", confidence: Math.min(1, turnControl.S / 100), ruleId: "battle-end-turn-ui", endTurnOnly: false };
    if (turnControl.S >= 50) return { scene: "OPPONENT_TURN", confidence: Math.min(1, turnControl.S / 100), ruleId: "battle-end-turn-ui" };
    return { scene: "UNKNOWN", confidence: 0, ruleId: "battle-turn-unmatched" };
}

var leftmostX = { 1: 640, 2: 587, 3: 535, 4: 482, 5: 430, 6: 377, 7: 325, 8: 272, 9: 220 };
function cardAt(image, x1280, y720) {
    var cx = x1280 * image.getWidth() / 1280, cy = y720 * image.getHeight() / 720, lum = 0, warmth = 0, count = 0;
    for (var dy = -15; dy <= 15; dy += 5) for (var dx = -15; dx <= 15; dx += 5) {
        var color = pixel(image, Math.round(cx + dx), Math.round(cy + dy));
        lum += luma(color); warmth += red(color) - blue(color); count++;
    }
    return lum / count > 60 && warmth / count > 10;
}
function handBounds(count, layout) {
    if (count < 1 || count > 9) return [];
    var bounds = [], gap, center;
    if (layout.id === "bottom") {
        // Current 1280x720 build, measured from real four/five-card frames.
        // These are the visible left edges (the cost-medal edge), not card
        // centres.  The previous table put a four-card hand at x=482..902,
        // while the real frame is x~=330..780; that shifted every drag onto a
        // neighbouring card.  Keep the source in the exposed bottom strip and
        // only 30px right of the edge so overlapping fan cards cannot steal it.
        var measuredSparse = {
            4: [330, 470, 630, 780],
            5: [300, 430, 560, 690, 825]
        };
        if (measuredSparse[count]) {
            measuredSparse[count].forEach(function (badgeLeft) {
                bounds.push([badgeLeft / 1280, 660 / 720, (badgeLeft + 60) / 1280, 720 / 720]);
            });
            return bounds;
        }
        if (count >= 6) {
            // Measured from real six- and nine-card 1280x720 fans. KARDS
            // expands the visible fan slightly as it becomes denser:
            //   6 cards: badge x ~= 270..870
            //   9 cards: badge x ~= 272..919
            // Interpolate the two measured spans for seven/eight cards. The
            // visible card source begins at the cost badge; +52 is safely in
            // that card's body even when neighbouring cards overlap it.
            var denseStart = 270 + (count - 6) * 2 / 3;
            var denseSpan = 600 + (count - 6) * 16;
            for (var di = 0; di < count; di++) {
                var denseLeft = denseStart + (count > 1 ? denseSpan * di / (count - 1) : 0);
                bounds.push([denseLeft / 1280, 660 / 720, (denseLeft + 60) / 1280, layout.bottom / 720]);
            }
            return bounds;
        }
        // Current KARDS fans keep the rightmost card near x=902 and move the
        // left edge according to the measured leftmost-X table.  The gap is
        // therefore count-dependent (about 105px for six cards, tighter for
        // nine), not the old fixed 145px spacing.
        var start = leftmostX[count], end = layout.rightmost || 902;
        // The calibration probes are on the left edge of each fanned card,
        // not its centre.  Using them as centres shifts the drag source onto
        // the neighbouring card and also makes the fee probe sample artwork.
        var centerStart = start + 52, centerEnd = end + 30;
        gap = count > 1 ? (centerEnd - centerStart) / (count - 1) : 0;
        for (var bi = 0; bi < count; bi++) {
            var bx = (centerStart + bi * gap) / 1280;
            bounds.push([bx - 52 / 1280, layout.top / 720, bx + 52 / 1280, layout.bottom / 720]);
        }
        return bounds;
    }
    gap = (layout.gap || 105) / 1280; center = (layout.center || 640) / 1280 - (count - 1) * gap / 2;
    for (var i = 0; i < count; i++) {
        var x = center + i * gap;
        bounds.push([x - 60 / 1280, layout.top / 720, x + 60 / 1280, layout.bottom / 720]);
    }
    return bounds;
}
function handSampleX(count, layout) {
    return layout.id === "bottom" ? leftmostX[count] : leftmostX[count];
}
function bottomHandCountBySpan(image, layout) {
    // A fanned hand has overlapping cards, so the old single-point probes
    // break for 5+ cards. At y=680 the artwork can contain dark gaps between
    // adjacent cards (especially over photographs). Measure the whole fan
    // envelope instead of keeping only the longest bright run. The observed
    // centre spacing on the current 1280x720 build is about 120px; the old
    // 145px constant systematically under-counted the six-card hand.
    var y = Math.min(image.getHeight() - 1, Math.round(680 * image.getHeight() / 720));
    var runs = [], runStart = -1, runEnd = -1;
    for (var x1280 = 180; x1280 <= 1100; x1280 += 10) {
        var hit = cardAt(image, x1280, 680);
        if (hit) {
            if (runStart < 0) runStart = x1280;
            runEnd = x1280;
        } else if (runStart >= 0 && x1280 - runEnd > 20) {
            runs.push([runStart, runEnd]);
            runStart = -1; runEnd = -1;
        }
    }
    if (runStart >= 0) runs.push([runStart, runEnd]);
    if (!runs.length) return 0;
    // Merge gaps up to one card pitch. This joins dark artwork without
    // allowing unrelated board pixels to bridge the full hand region.
    var merged = [], current = runs[0].slice();
    runs.slice(1).forEach(function (run) {
        if (run[0] - current[1] <= 125) current[1] = run[1];
        else { merged.push(current); current = run.slice(); }
    });
    merged.push(current);
    var envelope = merged.sort(function (a, b) { return (b[1] - b[0]) - (a[1] - a[0]); })[0];
    if (!envelope || envelope[1] - envelope[0] < 100) return 0;
    var envelopeWidth = envelope[1] - envelope[0];
    // Real current-build measurements at y=680:
    //   4 cards -> 640px, 5 cards -> 680px, 6 cards -> 720px.
    // The old 120px-pitch equation returned 5/6/6 respectively.  Calibrate
    // the sparse layouts explicitly; dense 7-9 layouts are disambiguated by
    // the independent cost-badge arc below.
    var count = envelopeWidth >= 620 && envelopeWidth <= 660 ? 4 :
        envelopeWidth > 660 && envelopeWidth <= 700 ? 5 :
        envelopeWidth > 700 ? 6 :
        Math.round((envelopeWidth - 120) / 120) + 1;
    return count >= 1 && count <= 9 ? count : 0;
}
function fanBadgeScore(image, count, layout) {
    if (!image || !count || layout.id !== "bottom") return 0;
    var boxes = handBounds(count, layout), score = 0;
    boxes.forEach(function (box, index) {
        score += detectOrangeCostBadge(image, cardCostBounds(box, index, count), index, count).score;
    });
    return score;
}
function fanBadgePresenceScore(image, count, layout) {
    if (!image || !count || layout.id !== "bottom") return 0;
    var boxes = handBounds(count, layout), total = 0;
    boxes.forEach(function (box, index) {
        var f = feature(image, cardCostBounds(box, index, count), 3);
        total += f.E * 0.75 + Math.min(1, f.L / 120) * 0.25;
    });
    return total / Math.max(1, boxes.length);
}
function ocrNumber(image, bounds, options) {
    // Auto.js6 OCR takes ownership of the bitmap passed to it.  Always OCR a
    // clip, never the captured frame itself; captureScreen() must remain valid
    // for the other detectors in this observation.
    if (typeof ocr === "undefined" || typeof images === "undefined" || !bounds) return null;
    
    // 参数验证
    if (!image || typeof image.getWidth !== "function" || typeof image.getHeight !== "function") {
        console.log("[vision] OCR 参数错误: 无效的图像对象");
        return null;
    }
    
    var width = image.getWidth(), height = image.getHeight();
    var x = Math.max(0, Math.round(bounds[0] * width)), y = Math.max(0, Math.round(bounds[1] * height));
    var right = Math.min(width, Math.round(bounds[2] * width)), bottom = Math.min(height, Math.round(bounds[3] * height));
    if (right <= x || bottom <= y) return null;
    
    // 默认选项
    var opts = options || {};
    var minValue = opts.minValue !== undefined ? opts.minValue : 0;
    var maxValue = opts.maxValue !== undefined ? opts.maxValue : 12;
    var allowFloat = opts.allowFloat || false;
    var logPrefix = opts.logPrefix || "OCR";
    
    var words = null;
    try {
        // Do not recycle clip: OCR owns/releases it in Auto.js6.
        words = ocr(images.clip(image, x, y, right - x, bottom - y));
    } catch (error) {
        console.log("[vision] " + logPrefix + " 失败: " + error);
        return null;
    }
    // Auto.js6 returns a Java-backed array here; Array.isArray() is false
    // even though indexed access and length are available.
    if (!words || typeof words.length !== "number") {
        console.log("[vision] " + logPrefix + " 返回值不可枚举: " + typeof words + "/" + (words && typeof words.length));
        return null;
    }

    // If one OCR token glues two digits together (e.g. "43" or "31"), the
    // rest of the crop is ambiguous; do not skip that token and accept a
    // later stat digit as the fee.
    var gluedPrefix = null;
    for (var wi = 0; wi < words.length; wi++) {
        var numericNoise = String(words[wi]).trim();
        if (/\d[^\d]*\d/.test(numericNoise) || /^\d{2,}$/.test(numericNoise)) {
            if (!opts.allowGluedPrefix) return null;
            var prefixMatch = /^(\d)/.exec(numericNoise);
            if (!prefixMatch) return null;
            var prefixValue = Number(prefixMatch[1]);
            if (gluedPrefix !== null && gluedPrefix !== prefixValue) return null;
            gluedPrefix = prefixValue;
        }
    }
    
    for (var i = 0; i < words.length; i++) {
        var text = String(words[i]).trim();
        
        // 尝试匹配完整数字
        var exactMatch = allowFloat ? /^(\d+\.?\d*)$/.exec(text) : /^(\d{1,2})$/.exec(text);
        if (exactMatch) {
            var value = Number(exactMatch[1]);
            if (value >= minValue && value <= maxValue) {
                return allowFloat ? value : Math.round(value);
            }
        }
        
        // 尝试匹配带噪声的单个数字
        var singleWithNoise = allowFloat ? /^(\d+\.?\d*)\D/.exec(text) : /^(\d)\D/.exec(text);
        if (singleWithNoise) {
            var value = Number(singleWithNoise[1]);
            if (value >= minValue && value <= maxValue) {
                return allowFloat ? value : Math.round(value);
            }
        }

        // The credit badge is sometimes returned as "K一8".  Accept a
        // single trailing digit with non-numeric noise, but keep rejecting
        // ambiguous glued values such as "81" or "31".
        if (!allowFloat) {
            var trailingNoise = /\D(\d)$/.exec(text);
            if (trailingNoise) {
                var trailingValue = Number(trailingNoise[1]);
                if (trailingValue >= minValue && trailingValue <= maxValue) return trailingValue;
            }
        }
    }
    if (gluedPrefix !== null && gluedPrefix >= minValue && gluedPrefix <= maxValue) return gluedPrefix;
    return null;
}
function stableOcrNumber(image, bounds, options, attempts) {
    var votes = {}, order = [], total = attempts || 2;
    for (var i = 0; i < total; i++) {
        var value = ocrNumber(image, bounds, options);
        if (value == null) continue;
        var key = String(value);
        if (!votes[key]) { votes[key] = 0; order.push(value); }
        votes[key]++;
        if (votes[key] >= 2) break;
    }
    var winner = null, winnerVotes = 0;
    order.forEach(function (value) { if (votes[String(value)] > winnerVotes) { winner = value; winnerVotes = votes[String(value)]; } });
    return winnerVotes >= Math.ceil(total / 2) ? winner : null;
}
function cardCostBounds(box, index, count) {
    // The cost medal is just left of the top edge of a bottom-fan card.  The
    // y estimate follows the fan curvature and is intentionally a tight crop
    // so attack/health numbers cannot be mistaken for its cost.
    // The medal sits immediately left of the detected card body.  Keep this
    // narrow region: moving it into the artwork can make OCR invent a cost.
    if (count === 4) {
        var sparse4Top = [620, 602, 592, 604][index];
        var sparse4Left = box[0] * 1280;
        // Only the numeral. Including the adjacent K/title strip causes its
        // muted gold background to vote orange when the actual fee is grey.
        return [sparse4Left / 1280, sparse4Top / 720, (sparse4Left + 22) / 1280, (sparse4Top + 32) / 720];
    }
    if (count === 5) {
        var sparse5Top = [648, 628, 610, 610, 630][index];
        var sparse5Left = box[0] * 1280;
        return [sparse5Left / 1280, sparse5Top / 720, (sparse5Left + 22) / 1280, (sparse5Top + 32) / 720];
    }
    if (count >= 6) {
        // The cost badges follow a measured symmetric arc. Six-card anchors
        // are [670,644,620,620,644,670]; the denser nine-card fan peaks at
        // y=603 and reaches y~=660 at both edges. This normalized curve keeps
        // the crop on the badge for all dense layouts instead of sampling the
        // black gap between cards (the previous six-card geometry did that).
        var badgeLeft = box[0] * 1280;
        var middle = (count - 1) / 2;
        var normalizedDistance = middle ? Math.abs(index - middle) / middle : 0;
        var edgeY = 670 - (count - 6) * (10 / 3);
        var centerY = 608 - (count - 6) * (5 / 3);
        var badgeTop = centerY + (edgeY - centerY) * Math.pow(normalizedDistance, 1.55);
        return [badgeLeft / 1280, badgeTop / 720, (badgeLeft + 40) / 1280, Math.min(720, badgeTop + 35) / 720];
    }
    var left = box[0] - 30 / 1280;
    var centerY = 610 + Math.abs(index - (count - 1) / 2) * 22;
    return [left, (centerY - 25) / 720, left + 52 / 1280, (centerY + 27) / 720];
}
function cardCostCandidateBounds(box, index, count) {
    // OCR is sensitive to the fan's rotation. Search a few tight windows
    // around a calculated badge anchor instead of trusting one crop that can
    // land on the title/stat digits. Each window is >=32px wide, the minimum
    // accepted by Auto.js6 ML Kit OCR.
    var cx = ((box[0] + box[2]) / 2) * 1280, cy;
    if (count >= 6) {
        // Measured against the 1280x720 six-card fan: badge centres sit
        // roughly 8, 11, 14, ... px left of each card centre.  Keep the
        // candidate windows tight so attack/health digits are excluded.
        cx += -10 - index * 3;
        cy = 632 + Math.abs(index - (count - 1) / 2) * 2;
    } else {
        var base = cardCostBounds(box, index, count);
        cx = ((base[0] + base[2]) / 2) * 1280;
        cy = ((base[1] + base[3]) / 2) * 720;
    }
    // Three horizontal windows are enough for the calibrated fan. Five
    // windows multiplied by six cards can exceed Auto.js6 OCR throughput and
    // make the whole batch return empty arrays.
    var offsets = [[0, 0], [-12, 0], [12, 0]];
    return offsets.map(function (offset) {
        var x = cx + offset[0], y = cy + offset[1], halfW = 20, halfH = 20;
        return [Math.max(0, x - halfW) / 1280, Math.max(0, y - halfH) / 720, Math.min(1280, x + halfW) / 1280, Math.min(720, y + halfH) / 720];
    });
}
// The cost number changes colour with the current resource state: orange is
// actionable, grey is not.  OCR alone cannot tell the difference (and can
// still read a grey number), so keep a separate colour vote for the badge.
// The fan rotates the badge around the card's upper-left corner; probe a few
// small neighbouring windows and retain the strongest orange signal.
function detectOrangeCostBadge(image, box, index, count) {
    if (!image || !box) return { orange: false, score: 0 };
    var left = box[0] * image.getWidth(), top = box[1] * image.getHeight();
    var best = 0;
    // `costBounds` is a small, already-calibrated badge box.  Only use the
    // old neighbouring-window sweep when callers provide a whole-card box;
    // scanning card art is a common source of false orange positives.
    var isCostBox = (box[2] - box[0]) <= 0.06 && (box[3] - box[1]) <= 0.08;
    var xOffsets = isCostBox ? [0] : (count >= 6 ? [-48, -36, -24, -12, 0] : [-36, -24, -12, 0]);
    var yOffsets = isCostBox ? [0] : (count >= 6 ? [0, 14, 28, 42] : [0, 18, 36]);
    xOffsets.forEach(function (xo) { yOffsets.forEach(function (yo) {
        var x0 = Math.max(0, Math.floor(left + xo)), y0 = Math.max(0, Math.floor(top + yo));
        var x1 = Math.min(image.getWidth(), isCostBox ? Math.ceil(box[2] * image.getWidth()) : x0 + 34);
        var y1 = Math.min(image.getHeight(), isCostBox ? Math.ceil(box[3] * image.getHeight()) : y0 + 30);
        var total = 0, orange = 0;
        for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) {
            var c = pixel(image, x, y), r = red(c), g = green(c), b = blue(c);
            total++;
            // Cost text is a saturated orange accent.  Muted brown/gold card
            // artwork must not count as affordable, so require a stronger
            // channel separation than the old broad artwork-friendly rule.
            if (r >= 145 && r - g >= 35 && g - b >= 20) orange++;
        }
        if (total) best = Math.max(best, orange / total);
    }); });
    // Keep a conservative vote while the fan geometry is being calibrated:
    // a false orange is worse than waiting one frame for a confirmed card.
    return { orange: best >= 0.03, score: best };
}
function ocrCardCostCandidates(image, box, index, count) {
    var votes = {}, order = [];
    var candidates = cardCostCandidateBounds(box, index, count);
    for (var ci = 0; ci < candidates.length; ci++) {
        var bounds = candidates[ci];
        var value = ocrNumber(image, bounds, { minValue: 0, maxValue: 12, allowGluedPrefix: true, logPrefix: "卡牌费用OCR" });
        if (value == null) continue;
        var key = String(value);
        if (!votes[key]) { votes[key] = 0; order.push(value); }
        votes[key]++;
        // Two agreeing windows are already the safety quorum. Avoid the
        // third Java OCR bridge call on the common path.
        if (votes[key] >= 2) break;
    }
    var winner = null, winnerVotes = 0;
    order.forEach(function (value) { if (votes[String(value)] > winnerVotes) { winner = value; winnerVotes = votes[String(value)]; } });
    // Require agreement from at least two windows. A single OCR hit is too
    // easy to confuse with attack/health text in a fanned card.
    return winnerVotes >= 2 ? winner : null;
}
function enrichHandWithFees(image, hand, config) {
    if (!hand || hand.layout !== "bottom" || !config.regions.playerCredits) return { credits: null, knownCards: 0 };
    // The orange/grey cost badge is the game's authoritative affordability
    // signal. OCR is diagnostic metadata only; it must never be required to
    // permit a card that the game has already marked orange.
    var credits = config.readCardCosts === false ? null : stableOcrNumber(image, config.regions.playerCredits, { minValue: 0, maxValue: 20, logPrefix: "费用OCR" }, 3), knownCards = 0;
    function attachPlayConfidence(card) {
        var badgeScore = card.costBadge && typeof card.costBadge.score === "number" ? card.costBadge.score : 0;
        // Card geometry says whether this is a reliable drag source; the
        // orange-pixel ratio says whether the game's live affordability mark
        // was actually seen. Keep this independent from rarity/foil/type.
        var badgeEvidence = card.costBadgeOrange === true ? clamp(badgeScore / 0.12, 0, 1) : 0;
        card.playConfidence = card.playable === true ? clamp((card.confidence || 0) * 0.65 + badgeEvidence * 0.35, 0, 1) : 0;
    }
    function readCosts(cards) {
        knownCards = 0;
        cards.forEach(function (card) {
            card.costBadge = detectOrangeCostBadge(image, card.costBounds || card.bounds, card.handIndex !== undefined ? card.handIndex : 0, hand.cards.length);
            card.costBadgeOrange = card.costBadge.orange === true;
            card.cost = config.readCardCosts === false ? null : ocrCardCostCandidates(image, card.bounds, card.handIndex !== undefined ? card.handIndex : 0, hand.cards.length);
            // Orange means playable now; grey means not playable now.
            card.playable = card.costBadgeOrange === true;
            card.type = card.playable && config.readHandTypes !== false ? identifyCardType(image, card.bounds, config) : "UNKNOWN";
            // Keep appearance work independently switchable from type work.
            // Production ignores foil and has no calibrated rarity template,
            // so both remain explicit UNKNOWN values at zero template cost.
            // Enabling one later must not enable or infer the other.
            card.rarity = config.readHandRarity === true ? identifyCardRarity(image, card.bounds, config) : "UNKNOWN";
            card.foil = config.readHandFoil === true ? identifyCardFoil(image, card.bounds, config) : "UNKNOWN";
            attachPlayConfidence(card);
            if (card.cost != null) knownCards++;
        });
    }
    readCosts(hand.cards);
    // Dense 7–9 card fans have nearly the same outer envelope as six cards.
    // If the first pass confirms too few fee digits, compare only the next
    // two measured layouts using real OCR evidence; never invent a count.
    // Dense-layout probing is the expensive path (it OCRs two extra fan
    // hypotheses). Only enter it when the base geometry itself is uncertain;
    // a normal, confidently measured six-card hand should remain responsive
    // during the timed turn window.
    if (config.readCardCosts !== false && hand.cards.length >= 5 && knownCards < 4 && (hand.confidence || 0) < 0.76) {
        var baseCount = hand.cards.length, bestCount = baseCount, bestKnown = knownCards, bestCards = hand.cards;
        [baseCount + 1, baseCount + 2].forEach(function (candidateCount) {
            if (candidateCount > 9) return;
            var candidateCards = handBounds(candidateCount, { id: "bottom", top: 590, bottom: 720, rightmost: 902, gap: 145 }).map(function (box, index) {
                return { id: "hand-" + (index + 1), handIndex: index, bounds: box, costBounds: cardCostBounds(box, index, candidateCount), confidence: 0.68, playable: false, priority: null };
            });
            var candidateKnown = 0;
            candidateCards.forEach(function (card) {
                card.cost = ocrCardCostCandidates(image, card.bounds, card.handIndex, candidateCount);
                if (card.cost != null) candidateKnown++;
            });
            if (candidateKnown > bestKnown) { bestKnown = candidateKnown; bestCount = candidateCount; bestCards = candidateCards; }
        });
        if (bestCount !== baseCount && bestKnown >= knownCards + 2) {
            hand.cards = bestCards;
            hand.confidence = Math.max(hand.confidence || 0, 0.78);
            hand.detail = "费用OCR布局复核为 " + bestCount + " 张手牌";
            readCosts(hand.cards);
        }
    }
    // ML Kit can return an empty Java array on the first batch immediately
    // after a capture while still succeeding on the next batch. A single
    // bounded retry prevents a transient empty read from turning a playable
    // hand into an unconditional END_TURN, while keeping the normal cadence
    // throttled by the caller.
    if (config.readCardCosts !== false && !knownCards && hand.cards.length) {
        if (typeof sleep === "function") sleep(500);
        readCosts(hand.cards);
    }
    return { credits: credits, knownCards: knownCards };
}
function detectHand(image) {
    // Older captures expose the hand around y=460; current KARDS builds fan
    // it at the screen bottom.  Probe both measured layouts and only accept
    // a layout with one unambiguous card-count match.
    var layouts = [
        { id: "middle", sampleY: 460, top: 375, bottom: 548 },
        { id: "bottom", sampleY: 650, top: 590, bottom: 720, rightmost: 902, gap: 145 }
    ];
    for (var layoutIndex = 0; layoutIndex < layouts.length; layoutIndex++) {
        var layout = layouts[layoutIndex], matches = [];
        for (var count = 1; count <= 9; count++) if (cardAt(image, handSampleX(count, layout), layout.sampleY)) matches.push(count);
        // In the bottom fan, the nth left-edge probe sits on a card for every
        // count up to the real hand size.  Take the contiguous prefix instead
        // of requiring a single match (which only works for the old layout).
        if (layout.id === "bottom") {
            var contiguous = 0;
            for (var expected = 1; expected <= 9 && matches.indexOf(expected) >= 0; expected++) contiguous++;
            // A contiguous 1..N probe is the most stable result.  If it is
            // absent (the five-card fan can cover its first probe), use the
            // whole-hand span instead.
            var spanCount = bottomHandCountBySpan(image, layout);
            // A dark card illustration can make an interior probe miss even
            // though the fan is clearly present. Prefer the measured envelope
            // when it reports a larger hand; otherwise retain the contiguous
            // probe for the small (1-2 card) layouts where the envelope is
            // easily confused with board artwork.
            // For medium/large fans the fixed probe positions can lie inside
            // dark artwork and falsely match a different calibrated layout
            // (the live six-card frame was reported as eight). The envelope
            // is the stronger measurement once at least three cards are
            // visible; keep the contiguous probes only for 1-2 card hands.
            var chosenCount = spanCount >= 3 ? spanCount : contiguous;
            // A dense eight-card fan can have the same bottom envelope as the
            // calibrated six-card replay. Use the independently measured fee
            // badge pattern only when it is decisively stronger; otherwise
            // retain the replay-calibrated count and do not guess.
            var denseScore = fanBadgeScore(image, 8, layout);
            var sevenScore = fanBadgeScore(image, 7, layout);
            var nineScore = fanBadgeScore(image, 9, layout);
            var sixScore = fanBadgeScore(image, 6, layout);
            // A nine-card fan is visually distinguishable when several
            // affordable-cost digits line up on its measured 81px arc. On
            // the real nine-card fixture seven badges vote orange, while the
            // wrong six/eight hypotheses see at most two. Require both an
            // absolute vote and a clear margin so brown artwork cannot grow a
            // six-card hand into nine.
            var maxOtherDenseScore = Math.max(sixScore, sevenScore, denseScore);
            if (nineScore >= 0.30 && nineScore > maxOtherDenseScore * 1.25) chosenCount = 9;
            if (chosenCount === 6 && sevenScore >= 0.20 && sevenScore > fanBadgeScore(image, 6, layout) * 1.15) chosenCount = 7;
            if ((chosenCount === 6 || chosenCount === 7) && denseScore >= 0.25 &&
                denseScore > fanBadgeScore(image, chosenCount, layout) * 1.15) chosenCount = 8;
            matches = chosenCount ? [chosenCount] : [];
        }
        if (matches.length === 1) {
            var detected = matches[0], bounds = handBounds(detected, layout);
            return { cards: bounds.map(function (box, index) {
                // A card is *not* assumed playable.  It becomes playable only
                // after its own cost and the current credit count are read.
                // The fan position is not a card priority and must never be
                // treated as one: KARDS does not sort a hand by cost.  Keep
                // the index only for geometry/debugging; a user/card
                // recognizer may later attach an explicit `priority`.
                return { id: "hand-" + (index + 1), handIndex: index, bounds: box, costBounds: layout.id === "bottom" ? cardCostBounds(box, index, detected) : null, confidence: 0.72, playable: false, priority: null };
            }), confidence: 0.72, layout: layout.id, detail: "命中 " + detected + " 张手牌布局(" + layout.id + ")" };
        }
    }
    // Do not fabricate a default hand: doing so was the direct cause of
    // dragging cards that the game could not legally deploy.
    console.log("[vision] 手牌检测失败，停止本帧出牌决策");
    return { cards: [], confidence: 0, layout: "unknown", detail: "手牌布局未确认" };
}
// 检测单位"可攻击"状态
function detectReadyState(image, slotBounds) {
    /**
     * 检测单位是否处于"可攻击"状态
     * 依据：可攻击单位边框呈绿色（G 通道明显高于 R/B）
     * @param {Image} image - 截图对象
     * @param {Array} slotBounds - 单位槽位边界 [x1, y1, x2, y2] 归一化坐标
     * @returns {boolean} - 是否可攻击
     */
    if (!image || !slotBounds) return false;
    
    // 检测单位边框是否为绿色（可攻击状态）
    var borderBounds = [
        slotBounds[0],
        slotBounds[1],
        slotBounds[2],
        slotBounds[1] + 0.05  // 顶部边框区域
    ];
    
    var rgb = rgbAverage(image, borderBounds, 8);
    if (!rgb) return false;
    
    // 绿色特征：G 明显高于 R 和 B
    var gDominant = rgb.G - rgb.R > 25 && rgb.G - rgb.B > 25;
    // 且不能是深色（黑色底边框不是绿色）
    var brightEnough = rgb.G > 60;
    
    return gDominant && brightEnough;
}

// 可行动单位的移动费用徽章会变成橙色。该区域位于单位卡左上角，
// 比整张卡采样更可靠，也不会把卡面插图颜色误判成行动状态。
function detectOrangeMoveCost(image, slotBounds) {
    if (!image || !slotBounds) return false;
    var x1 = slotBounds[0], y1 = slotBounds[1], x2 = Math.min(slotBounds[2], x1 + (slotBounds[2] - x1) * 0.28), y2 = Math.min(slotBounds[3], y1 + (slotBounds[3] - y1) * 0.22);
    var px1 = Math.floor(x1 * image.getWidth()), py1 = Math.floor(y1 * image.getHeight());
    var px2 = Math.floor(x2 * image.getWidth()), py2 = Math.floor(y2 * image.getHeight());
    var orange = 0, total = 0;
    for (var y = py1; y < py2; y += 2) for (var x = px1; x < px2; x += 2) {
        var c = pixel(image, x, y), r = red(c), g = green(c), b = blue(c);
        total++;
        // Only the saturated orange numeral counts. The previous broad rule
        // accepted gold card frames/header backgrounds and marked grey action
        // costs as operable. On the real opponent-turn negative frame those
        // gold pixels reach 25%, while this strict orange signal is exactly
        // 0%; the confirmed ready-unit fixture measures about 5.5%.
        if (r >= 170 && r - g >= 50 && g - b >= 25) orange++;
    }
    return total > 0 && orange / total >= 0.02;
}

function unitState(image, config, typeCache, frontlineOwner, typeBudget) {
    var present = {};
    var typeCacheBefore = {};
    if (typeCache) Object.keys(typeCache).forEach(function (key) { typeCacheBefore[key] = typeCache[key]; });
    return (config._activeUnitSlots || config.unitSlots || []).map(function (slot) {
        if (slot.isFrontline === true && frontlineOwner && frontlineOwner !== slot.owner) return null;
        // HQ positions can shift when support-line cards are added or removed.
        // Never allow a unit probe overlapping the currently detected HQ to
        // become an actionable source, even if the card art has strong edges.
        var matchingHqKind = slot.owner === "PLAYER" ? "FRIENDLY_HQ" : "ENEMY_HQ";
        var hqOverlap = activeSlots(config).some(function (target) {
            if (!target || target.kind !== matchingHqKind || !target.bounds) return false;
            var ix = Math.max(0, Math.min(slot.bounds[2], target.bounds[2]) - Math.max(slot.bounds[0], target.bounds[0]));
            var iy = Math.max(0, Math.min(slot.bounds[3], target.bounds[3]) - Math.max(slot.bounds[1], target.bounds[1]));
            var area = (slot.bounds[2] - slot.bounds[0]) * (slot.bounds[3] - slot.bounds[1]);
            return ix * iy / Math.max(0.0001, area) >= 0.35;
        });
        if (hqOverlap) return null;
        var value = feature(image, slot.bounds, config.unitSampleStride);
        // Some maps shift the rear-middle card horizontally.  Keep the
        // narrow production slot (which avoids the HQ), but allow an
        // explicitly calibrated legacy position when the primary probe is
        // empty.  This is not a global fallback: the alternate bounds and
        // threshold are supplied per slot from config and remain bounded.
        var usedBounds = slot.bounds;
        var usedAlternate = false;
        if (slot.alternateBounds && value.E < (slot.owner === "PLAYER" ? (config.minPlayerUnitEdgeDensity || config.minUnitEdgeDensity) : config.minUnitEdgeDensity)) {
            var alternate = feature(image, slot.alternateBounds, config.unitSampleStride);
            var alternateMin = slot.alternateMinEdgeDensity || config.minUnitEdgeDensity;
            if (alternate.E >= alternateMin) {
                value = alternate;
                usedBounds = slot.alternateBounds;
                usedAlternate = true;
            }
        }
        var minEdge = slot.minEdgeDensity || (slot.owner === "PLAYER" ? (config.minPlayerUnitEdgeDensity || config.minUnitEdgeDensity) : config.minUnitEdgeDensity);
        var occupied = value.E >= minEdge;
        if (!occupied) {
            if (typeCache) delete typeCache[slot.id];
            return null;
        }
        present[slot.id] = true;
        
        // Unit action state is determined by the orange movement-cost badge.
        // Do not infer state from uncalibrated static appearance.
        var isExhausted = false;
        // KARDS 没有稳定的绿色行动框；可行动由运行时回合账本决定。
        // 明确检测到耗尽时才否决，不再要求 readySignal 为真。
        var orangeMoveCost = slot.owner === "PLAYER" && detectOrangeMoveCost(image, usedBounds);
        // The orange move-cost badge is the game's live action affordance.
        // The top border can look grey because of the board texture/card
        // shadow, so it must not veto an otherwise orange, ready unit.
        var canOperate = slot.owner === "PLAYER" ? orangeMoveCost : false;
        
        // 如果已行动，则不可操作
        
        var type = "UNKNOWN", typeSource = "UNKNOWN";
        // Type recognition is deliberately one-shot per occupied slot. It
        // uses the confirmed icon templates and is never part of the hot
        // per-frame affordability path. A slot is reclassified after it
        // becomes empty, so a newly deployed unit cannot inherit stale type.
        if (config.readUnitTypes !== false) {
            if (typeCache && typeCache[slot.id] && typeCache[slot.id] !== "UNKNOWN") {
                type = typeCache[slot.id];
                typeSource = "CACHE";
            }
            else {
                // A move preserves the physical card type while changing only
                // rear/front slot identity. Read the pre-frame cache because
                // the now-empty rear slot may have been cleared earlier in
                // this same map pass.
                var linkedId = String(slot.id).indexOf("-front-") >= 0 ? String(slot.id).replace("-front-", "-rear-") :
                    (String(slot.id).indexOf("-rear-") >= 0 ? String(slot.id).replace("-rear-", "-front-") : null);
                if (linkedId && !present[linkedId] && typeCacheBefore[linkedId] && typeCacheBefore[linkedId] !== "UNKNOWN") {
                    type = typeCacheBefore[linkedId];
                    typeSource = "MIGRATED";
                }
            }
            var maySpendBudget = !typeBudget || typeBudget.remaining > 0;
            if (typeBudget && typeBudget.readyOnly === true && !(slot.owner === "PLAYER" && orangeMoveCost)) maySpendBudget = false;
            if (type === "UNKNOWN" && maySpendBudget) {
                if (typeBudget) typeBudget.remaining--;
                type = identifyCardType(image, usedBounds, config);
                if (type !== "UNKNOWN") typeSource = "TEMPLATE";
            }
            if (typeCache && type !== "UNKNOWN") typeCache[slot.id] = type;
        }
        if (type === "UNKNOWN" && config.unknownUnitTypeFallback) {
            type = config.unknownUnitTypeFallback;
            typeSource = "FALLBACK";
        }
        return {
            id: slot.id, 
            owner: slot.owner, 
            bounds: usedBounds,
            type: type,
            typeSource: typeSource,
            isFrontline: slot.isFrontline === true,
            confidence: clamp(0.42 + value.E, 0, 0.65), 
            canOperate: canOperate,
            candidateCanOperate: slot.owner === "PLAYER" && orangeMoveCost && !isExhausted,
            orangeMoveCost: orangeMoveCost,
            isExhausted: isExhausted,
            _usedAlternate: usedAlternate
        };
    }).filter(function (unit) { return !!unit; }).filter(function (unit, index, all) {
        var formation = /^(.*-(?:left|right)-)([1-3])$/.exec(unit.id);
        if (formation && Number(formation[2]) > 1 && !all.some(function (other) {
            return other && other.id === formation[1] + (Number(formation[2]) - 1);
        })) return false;
        if (!unit) return false;
        // A legacy alternate is only accepted when it is the sole friendly
        // candidate; otherwise it is the HQ-overlap probe, not a second unit.
        if (unit.owner === "PLAYER" && unit._usedAlternate && all.some(function (other) {
            return other && other.owner === "PLAYER" && other !== unit && !other._usedAlternate;
        })) return false;
        delete unit._usedAlternate;
        return true;
    });
}
function targetFeatures(image, config) {
    var values = {};
    activeSlots(config).forEach(function (slot) { values[slot.id] = feature(image, slot.bounds, config.targetSampleStride); });
    return values;
}
function legalTargets(values, previous, config, guardMarkers) {
    if (!previous) return [];
    return activeSlots(config).map(function (slot) {
        var before = previous[slot.id], after = values[slot.id];
        if (!before || !after) return null;
        var delta = Math.abs(after.L - before.L) / 255 + Math.abs(after.S - before.S) / 255 + Math.abs(after.E - before.E) * 2;
        if (delta < config.minTargetHighlightDelta) return null;
        var isGuard = slot.kind === "ENEMY_UNIT" && (guardMarkers || []).some(function (marker) { return marker.slotId === slot.id; });
        return { id: slot.id, kind: slot.kind, legal: true, bounds: slot.bounds, confidence: clamp(delta / config.targetHighlightFullDelta, 0, 0.95), threat: slot.threat || 0, isGuard: isGuard, isFrontline: slot.isFrontline === true };
    }).filter(function (target) { return target !== null; });
}
// KARDS does not illuminate legal attack targets after the source is tapped.
// Once a unit has been visually detected, its enemy units and the detected HQ
// are direct drag destinations. The runtime still confirms the result from
// board/hand state changes; this is deliberately not a frame-difference test.
function directCombatTargets(config, units, guardMarkers) {
    var markers = guardMarkers || [], result = (units || []).filter(function (u) { return u.owner === "ENEMY"; }).map(function (u) {
        var guard = markers.some(function (m) { return m.slotId === u.id; });
        return { id: u.id, kind: "ENEMY_UNIT", legal: true, direct: true,
            bounds: u.bounds, confidence: config.directTargetConfidence || 0.72,
            threat: 0, isGuard: guard, isFrontline: u.isFrontline === true,
            type: u.type || "UNKNOWN" };
    });
    var hq = activeSlots(config).filter(function (s) { return s.kind === "ENEMY_HQ" && s.detected === true; })[0];
    if (hq) result.push({ id: hq.id, kind: "ENEMY_HQ", legal: true, direct: true,
        bounds: hq.bounds, confidence: config.directTargetConfidence || 0.72,
        threat: hq.threat || 1000, isGuard: false, isFrontline: false });
    return result;
}

// 卡牌费用识别专用函数
function ocrCardCost(image, cardBounds, index, count) {
    /**
     * 识别单张卡牌的费用
     * @param {Image} image - 截图对象
     * @param {Array} cardBounds - 卡牌边界 [x1, y1, x2, y2] 归一化坐标
     * @param {number} index - 卡牌在手牌中的索引（0-based）
     * @param {number} count - 手牌总数
     * @returns {number|null} - 识别出的费用（0-12），失败返回null
     */
    if (!image || !cardBounds || index < 0 || count <= 0) return null;
    
    // 使用现有的cardCostBounds函数计算费用区域
    var costBounds = cardCostBounds(cardBounds, index, count);
    
    // Use the multi-window consensus reader; keep costBounds above as the
    // primary/debug crop for callers that display the geometry.
    return ocrCardCostCandidates(image, cardBounds, index, count);
}

// 总部血量识别专用函数
function ocrHqHealth(image, isEnemy) {
    /**
     * 识别总部血量
     * @param {Image} image - 截图对象
     * @param {boolean} isEnemy - 是否为敌方总部
     * @returns {number|null} - 识别出的血量（0-20），失败返回null
     */
    if (!image) return null;
    
    // 定义总部血量区域（基于1280x720分辨率）
    var region;
    if (isEnemy) {
        // 敌方总部血量区域
        region = [0.45, 0.08, 0.55, 0.12];
    } else {
        // 我方总部血量区域
        region = [0.45, 0.88, 0.55, 0.92];
    }
    
    // 调用优化后的ocrNumber函数
    return ocrNumber(image, region, {
        minValue: 0,
        maxValue: 20,
        logPrefix: isEnemy ? "敌方总部血量OCR" : "我方总部血量OCR"
    });
}

// 采样区域的平均 RGB 通道值
function rgbAverage(image, bounds, stride) {
    if (!image || !bounds) return null;
    var width = image.getWidth(), height = image.getHeight();
    var x0 = Math.max(0, Math.floor(bounds[0] * width)), y0 = Math.max(0, Math.floor(bounds[1] * height));
    var x1 = Math.min(width, Math.floor(bounds[2] * width)), y1 = Math.min(height, Math.floor(bounds[3] * height));
    if (x1 <= x0 || y1 <= y0) return null;
    var step = stride || 24, r = 0, g = 0, b = 0, count = 0;
    for (var y = y0; y < y1; y += step) for (var x = x0; x < x1; x += step) {
        var color = pixel(image, x, y);
        r += red(color); g += green(color); b += blue(color); count++;
    }
    if (!count) return null;
    return { R: r / count, G: g / count, B: b / count };
}

// 卡牌国家识别函数
function identifyCardNation(image, cardBounds) {
    /**
     * 识别卡牌所属国家（基于边框色相，需要区分红/蓝/灰等通道比例）
     * @param {Image} image - 截图对象
     * @param {Array} cardBounds - 卡牌边界 [x1, y1, x2, y2] 归一化坐标
     * @returns {string} - 国家代码：'GERMANY', 'USSR', 'USA', 'UK', 'JAPAN', 'FRANCE', 'UNKNOWN'
     */
    if (!image || !cardBounds) return 'UNKNOWN';
    
    // Faction colour is not a stable identifier in the current screenshots:
    // the top strip includes art, shadows and UI overlays. Do not turn an
    // RGB guess into a card identity until calibrated faction templates are
    // available.
    return 'UNKNOWN';
}

// 卡牌类型识别函数
function identifyCardType(image, cardBounds, config) {
    /**
     * 识别卡牌类型（步兵、坦克、飞机、设施等）
     * @param {Image} image - 截图对象
     * @param {Array} cardBounds - 卡牌边界 [x1, y1, x2, y2] 归一化坐标
     * @returns {string} - 卡牌类型：'INFANTRY', 'TANK', 'AIRCRAFT', 'FACILITY', 'ORDER', 'UNKNOWN'
     */
    if (!image || !cardBounds) return 'UNKNOWN';
    
    // Illustration texture/brightness is not a card-type classifier. Match
    // only the explicit bottom badge templates supplied from real cards.
    // Missing templates intentionally produce UNKNOWN rather than a guess.
    config = config || {};
    var templates = config.templates || {}, rel = config.typeIconRelativeBounds || [0.28, 0.70, 0.72, 0.96];
    var left = cardBounds[0], top = cardBounds[1], width = cardBounds[2] - cardBounds[0], height = cardBounds[3] - cardBounds[1];
    var iconBounds = [left + width * rel[0], top + height * rel[1], left + width * rel[2], top + height * rel[3]];
    var order = [
        ["INFANTRY", templates.typeInfantry],
        ["TANK", templates.typeTank],
        ["ARTILLERY", templates.typeArtillery],
        ["FIGHTER", templates.typeFighter],
        ["BOMBER", templates.typeBomber]
    ];
    function classify(sourceImage, sourceBounds, templateOrder, required, candidateThreshold, minMargin, maskMode) {
        var scored = [];
        for (var i = 0; i < templateOrder.length; i++) {
            if (!templateOrder[i][1]) continue;
            var paths = Array.isArray(templateOrder[i][1]) ? templateOrder[i][1] : [templateOrder[i][1]];
            var bestForType = null;
            for (var pi = 0; pi < paths.length; pi++) {
                var similarity = maskMode ? maskTemplateSimilarityInRegion(sourceImage, paths[pi], candidateThreshold, sourceBounds) :
                    templateSimilarityInRegion(sourceImage, paths[pi], candidateThreshold, sourceBounds);
                if (typeof similarity === "number" && (bestForType === null || similarity > bestForType)) bestForType = similarity;
            }
            if (bestForType !== null) scored.push({ type: templateOrder[i][0], similarity: bestForType });
        }
        if (!scored.length) return 'UNKNOWN';
        scored.sort(function (a, b) { return b.similarity - a.similarity; });
        if (scored[0].similarity < required) return 'UNKNOWN';
        if (scored.length > 1 && scored[0].similarity - scored[1].similarity < minMargin) return 'UNKNOWN';
        return scored[0].type;
    }
    var maskOrder = [
        ["INFANTRY", templates.typeMaskInfantry], ["TANK", templates.typeMaskTank],
        ["ARTILLERY", templates.typeMaskArtillery], ["FIGHTER", templates.typeMaskFighter],
        ["BOMBER", templates.typeMaskBomber]
    ];
    var hasMaskTemplates = maskOrder.some(function (entry) { return !!entry[1]; });
    var canMask = hasMaskTemplates && typeof images !== "undefined" && typeof images.clip === "function" &&
        typeof images.grayscale === "function" && typeof images.threshold === "function";
    if (canMask) {
        var iw = image.getWidth(), ih = image.getHeight();
        var maskRel = config.typeMaskRelativeBounds || [0.30, 0.68, 0.72, 0.98];
        var maskBounds = [left + width * maskRel[0], top + height * maskRel[1],
            left + width * maskRel[2], top + height * maskRel[3]];
        var x = Math.max(0, Math.round(maskBounds[0] * iw)), y = Math.max(0, Math.round(maskBounds[1] * ih));
        var right = Math.min(iw, Math.round(maskBounds[2] * iw)), bottom = Math.min(ih, Math.round(maskBounds[3] * ih));
        var clip = null, gray = null, binary = null, maskResult = 'UNKNOWN';
        try {
            clip = images.clip(image, x, y, right - x, bottom - y);
            gray = images.grayscale(clip);
            binary = images.threshold(gray, config.typeMaskLumaThreshold || 135, 255, "BINARY");
            maskResult = classify(binary, [0, 0, 1, 1], maskOrder,
                config.typeMaskThreshold || 0.75,
                config.typeMaskCandidateThreshold || 0.65,
                config.typeMaskMinMargin || 0.035, true);
        } catch (maskError) {
            maskResult = 'UNKNOWN';
        }
        try { if (binary) binary.recycle(); } catch (maskRecycle1) {}
        try { if (gray) gray.recycle(); } catch (maskRecycle2) {}
        try { if (clip) clip.recycle(); } catch (maskRecycle3) {}
        // A valid mask pipeline deliberately owns the decision. Falling back
        // to RGB here would reintroduce foil/gold border pollution.
        return maskResult;
    }
    var required = config.typeIconThreshold || 0.90;
    return classify(image, iconBounds, order, required,
        Math.min(required, config.typeIconCandidateThreshold || 0.70),
        config.typeIconMinMargin || 0.035);
}

// 卡牌稀有度识别函数
function identifyCardRarity(image, cardBounds, config) {
    /**
     * 识别卡牌稀有度
     * @param {Image} image - 截图对象
     * @param {Array} cardBounds - 卡牌边界 [x1, y1, x2, y2] 归一化坐标
     * @returns {string} - 稀有度：'COMMON', 'RARE', 'ELITE', 'UNKNOWN'
     */
    if (!image || !cardBounds) return 'UNKNOWN';
    
    // Rarity is resolved only from calibrated evidence. Generic colour
    // thresholds are deliberately unsupported because they silently poison
    // card metadata across factions, lighting and animated treatments.
    config = config || {};
    var templates = config.templates || {};
    var bounds = config.rarityRelativeBounds || [0.02, 0.02, 0.98, 0.18];
    var order = [
        ["COMMON", templates.rarityCommon],
        ["RARE", templates.rarityRare],
        ["ELITE", templates.rarityElite],
        ["SPECIAL", templates.raritySpecial]
    ];
    var threshold = config.rarityTemplateThreshold || config.templateThreshold || 0.88;
    for (var i = 0; i < order.length; i++) {
        if (order[i][1] && findTemplateInRegion(image, order[i][1], threshold, [
            cardBounds[0] + (cardBounds[2] - cardBounds[0]) * bounds[0],
            cardBounds[1] + (cardBounds[3] - cardBounds[1]) * bounds[1],
            cardBounds[0] + (cardBounds[2] - cardBounds[0]) * bounds[2],
            cardBounds[1] + (cardBounds[3] - cardBounds[1]) * bounds[3]
        ])) return order[i][0];
    }
    return 'UNKNOWN';
}

// Foil/golden treatment is an appearance flag, independent from rarity.
// It is detected only with a calibrated foil marker/template.  A missing
// marker is not evidence of a normal card, so NON_FOIL is emitted only when a
// paired negative template is explicitly configured.
function identifyCardFoil(image, cardBounds, config) {
    if (!image || !cardBounds) return 'UNKNOWN';
    config = config || {};
    var templates = config.templates || {};
    var bounds = config.foilRelativeBounds || [0.02, 0.02, 0.98, 0.98];
    var region = [
        cardBounds[0] + (cardBounds[2] - cardBounds[0]) * bounds[0],
        cardBounds[1] + (cardBounds[3] - cardBounds[1]) * bounds[1],
        cardBounds[0] + (cardBounds[2] - cardBounds[0]) * bounds[2],
        cardBounds[1] + (cardBounds[3] - cardBounds[1]) * bounds[3]
    ];
    var threshold = config.foilTemplateThreshold || config.templateThreshold || 0.88;
    if (templates.foil && findTemplateInRegion(image, templates.foil, threshold, region)) return 'FOIL';
    if (templates.nonFoil && findTemplateInRegion(image, templates.nonFoil, threshold, region)) return 'NON_FOIL';
    return 'UNKNOWN';
}

// 综合卡牌识别函数
function identifyCard(image, cardBounds, config) {
    /**
     * 综合识别卡牌的所有属性
     * @param {Image} image - 截图对象
     * @param {Array} cardBounds - 卡牌边界 [x1, y1, x2, y2] 归一化坐标
     * @returns {Object} - 卡牌属性对象
     */
    if (!image || !cardBounds) return null;
    
    return {
        nation: identifyCardNation(image, cardBounds),
        type: identifyCardType(image, cardBounds, config),
        rarity: identifyCardRarity(image, cardBounds, config),
        foil: identifyCardFoil(image, cardBounds, config),
        bounds: cardBounds
    };
}
function create(config) {
    var previousTargets = null, feeFrame = 0, feeHandKey = "", cachedFees = null, typeCache = {}, cachedBattleHqSlots = null, battleLatched = false, lastBattleScene = null;
    config._activeTargetSlots = (config.targetSlots || []).slice();
    function observe(image) {
        if (hasBlockingOverlay(image, config)) {
            previousTargets = null;
            return { uiScreen: { screen: "UNKNOWN", confidence: 0, ruleId: "blocking-overlay", priority: 1000 }, scene: { scene: "UNKNOWN", confidence: 0, ruleId: "blocking-overlay" }, width: image.getWidth(), height: image.getHeight(), state: { scene: "UNKNOWN", uiScreen: "UNKNOWN", credits: null, hand: [], handConfidence: 0, units: [], pending: null }, legalTargets: [], evidence: { hand: "阻塞性浮层，等待消失", credits: null, knownCardCosts: 0, legalTargetCount: 0, enemyGuardMarkerCount: 0 } };
        }
        // Page-specific promotional modal. Its close X is confined to the
        // measured modal corner, away from the persistent top-right gear.
        // Return before classifying the dimmed HOME background so runtime can
        // close exactly one popup and then restart normal page recognition.
        if (detectPromoPopup(image, config)) {
            return { uiScreen: { screen: "POPUP", confidence: 0.99, ruleId: "template-promo-popup-close", priority: 120 },
                scene: { scene: "UNKNOWN", confidence: 0.99, ruleId: "template-promo-popup-close" },
                width: image.getWidth(), height: image.getHeight(),
                state: { scene: "UNKNOWN", uiScreen: "POPUP", credits: null, hand: [], handConfidence: 0, units: [], pending: null },
                legalTargets: [], evidence: { hand: "促销弹窗", credits: null, knownCardCosts: 0, legalTargetCount: 0, enemyGuardMarkerCount: 0 } };
        }
        var uiScreen = classifyScreen(image, config);
        // Template matching is intentionally secondary to page classification.
        // The End Turn artwork can occur in shop/promotional cards at a high
        // pixel similarity; accepting it globally turns a shop frame into a
        // fake BATTLE/OUR_TURN frame and can stop navigation prematurely.
        // A mulligan-header template can survive as a false match on a live
        // board. The current-turn control is confined to the measured
        // right-side region, so it is also checked when the broad classifier
        // says MULLIGAN; a real turn control wins over that false page match.
        // Mulligan has a bright bottom confirmation panel in the same area
        // used by the current End Turn heuristic. Detect its page-specific
        // header/confirm template first, otherwise the generic board rule can
        // promote the replacement screen to BATTLE and consume its timer.
        // Once a real battle turn has been established, the same match cannot
        // return to mulligan. Skip two template scans on every timed frame;
        // the latch is cleared as soon as a positive non-battle page appears.
        // A strong broad BATTLE classification does not need two expensive
        // mulligan template scans. Keep them for MULLIGAN/UNKNOWN transition
        // frames where they provide real disambiguation.
        var detectedMulligan = (battleLatched || uiScreen.screen === "BATTLE") ? null : detectMulliganScreen(image, config);
        var detectedTurn = (uiScreen.screen === "BATTLE" || uiScreen.screen === "MULLIGAN") && !detectedMulligan ? detectBattleTurn(image, config) : null;
        // An active End Turn control proves this is not a result page. Result
        // matching is relatively expensive in Auto.js (four constrained
        // templates), so only run it when no current-turn control exists.
        var detectedResult = detectedTurn ? null : detectResultScreen(image, config);
        // Promote the page-specific mulligan header even while the broad
        // anchor classifier is still in a fade/UNKNOWN state. This is the
        // critical fast path: waiting for a second full page classification
        // can consume the game's replacement countdown. Never promote it over
        // a positively detected BATTLE turn control.
        if (!detectedMulligan && ["MULLIGAN", "UNKNOWN", "DECK_DETAIL"].indexOf(uiScreen.screen) >= 0) detectedMulligan = detectMulliganScreen(image, config);
        // The fixed right-side turn control is a stronger battle signal than
        // broad colour regions, which vary with boards and card artwork, but
        // only after the base classifier has established that this is a board.
        if (detectedMulligan) uiScreen = { screen: "MULLIGAN", confidence: 0.99, ruleId: "template-mulligan", priority: 110 };
        else if (detectedTurn) uiScreen = { screen: "BATTLE", confidence: detectedTurn.confidence, ruleId: detectedTurn.ruleId, priority: 100 };
        if (detectedResult) uiScreen = { screen: "RESULT", confidence: 0.99, ruleId: detectedResult.id === "continue" ? "template-result-continue" : "template-result-next-reward", priority: 100 };
        var scene = classifyScene(image, uiScreen, config, detectedTurn);
        if (uiScreen.screen === "BATTLE" && detectTurnTransitionBanner(image)) {
            scene = { scene: "UNKNOWN", confidence: 0.99, ruleId: "turn-transition-banner" };
        }
        if (uiScreen.screen === "BATTLE") {
            battleLatched = true;
            // The HQ is not fixed. Refresh it at every transition into our
            // turn and immediately after a board-changing action requested by
            // runtime. Between those events retain the cache to keep the hot
            // screenshot loop responsive.
            if (config._invalidateBattleHq === true || (scene.scene === "OUR_TURN" && lastBattleScene !== "OUR_TURN")) {
                cachedBattleHqSlots = null;
                config._invalidateBattleHq = false;
            }
            // HQ positions vary between board layouts, but remain fixed during
            // one match. The exhaustive adaptive scan costs several seconds
            // through Auto.js' Java pixel bridge; perform it once per match.
            if (!cachedBattleHqSlots) cachedBattleHqSlots = (config.targetSlots || []).map(function (slot) {
                    if (slot.kind !== "ENEMY_HQ" && slot.kind !== "FRIENDLY_HQ") return slot;
                    // HQ is not necessarily the left-most formation card.
                    // Prefer the full formation/header identity. A damaged
                    // unit's red defense number can be larger than the HQ
                    // health glyph, so health is only a fallback.
                    var isEnemyHq = slot.kind === "ENEMY_HQ";
                    var formationFound = detectFormationHqBounds(image, isEnemyHq);
                    var healthFound = detectHqByHealth(image, isEnemyHq);
                    var found = formationFound;
                    // Red health can identify a shifted HQ, but a damaged
                    // unit has a similar red defense glyph. Compare their
                    // measured headers and keep the more HQ-like candidate.
                    if (healthFound && (!found || hqHeaderIdentityScore(image, healthFound) > hqHeaderIdentityScore(image, found) + 0.04)) {
                        found = healthFound;
                    }
                    if (!found) found = detectHqBounds(image, isEnemyHq, config);
                    if (!found) return slot;
                    // Quantization prevents one-pixel scan jitter from invalidating
                    // the current-frame target bounds.
                    found = found.map(function (v) { return Math.round(v * 100) / 100; });
                    return { id: slot.id, kind: slot.kind, bounds: found, detected: true, threat: slot.threat || 0, isFrontline: slot.isFrontline === true };
                });
            config._activeTargetSlots = cachedBattleHqSlots;
            config._activeUnitSlots = dynamicFormationUnitSlots(cachedBattleHqSlots);
            lastBattleScene = scene.scene;
        } else {
            config._activeTargetSlots = (config.targetSlots || []).slice();
            config._activeUnitSlots = null;
            if (uiScreen.screen !== "UNKNOWN") {
                battleLatched = false;
                cachedBattleHqSlots = null;
                typeCache = {};
            }
            lastBattleScene = null;
        }
        var frontline = uiScreen.screen === "BATTLE" ? detectFrontlineControl(image) : { owner: "UNKNOWN", y: null, confidence: 0 };
        // Never spend the player's timed action window calibrating new unit
        // icons. Unknown units already have the requested infantry fallback;
        // gradually fill the concrete type cache during opponent turns.
        var maxTypeMatches = Math.max(0, config.maxUnitTypeMatchesPerFrame === undefined ? 1 : config.maxUnitTypeMatchesPerFrame);
        var typeBudget = {
            remaining: scene.scene === "OPPONENT_TURN" ? maxTypeMatches : (scene.scene === "OUR_TURN" ? Math.min(1, maxTypeMatches) : 0),
            // During the timed player turn spend the single budget only on a
            // live orange action source. Enemy/exhausted cards can be filled
            // cheaply during the opponent turn and reused from cache.
            readyOnly: scene.scene === "OUR_TURN"
        };
        var frameUnits = uiScreen.screen === "BATTLE" ? unitState(image, config, typeCache, frontline.owner, typeBudget) : [];
        var guardMarkers = uiScreen.screen === "BATTLE" ? detectEnemyGuardMarkers(image, config, frameUnits) : [];
        var targetValues = null;
        var targets = uiScreen.screen === "BATTLE" ? directCombatTargets(config, frameUnits, guardMarkers) : [];
        previousTargets = null;
        var hand = uiScreen.screen === "BATTLE" ? detectHand(image) : { cards: [], confidence: 0, detail: "非战场页面" };
        var fees = { credits: null, knownCards: 0 };
        if (scene.scene === "OUR_TURN" && config.fastPending !== true) {
            // Auto.js OCR is comparatively expensive. Calling it for all five
            // candidate windows of six cards on every 750ms frame can make
            // the engine return empty results. Retry on a bounded cadence and
            // reuse only a matching hand geometry between OCR passes.
            var handKey = hand.layout + "/" + hand.cards.length + "/" + hand.cards.map(function (c) { return c.bounds.join(","); }).join(";");
            feeFrame++;
            if (cachedFees && handKey === feeHandKey && feeFrame % 8 !== 0) {
                fees = { credits: cachedFees.credits, knownCards: cachedFees.knownCards };
                hand.cards.forEach(function (card, index) {
                    var saved = cachedFees.costs[index];
                    var savedBadge = cachedFees.badges ? cachedFees.badges[index] : null;
                    card.cost = saved == null ? null : saved;
                    card.costBadge = savedBadge || { orange: false, score: 0 };
                    card.costBadgeOrange = card.costBadge.orange === true;
                    card.playable = config.readCardCosts === false ? card.costBadgeOrange === true : (card.costBadgeOrange && card.cost != null && fees.credits != null && card.cost <= fees.credits);
                    card.type = cachedFees.types && cachedFees.types[index] ? cachedFees.types[index] : "UNKNOWN";
                    var cachedBadgeEvidence = card.costBadgeOrange ? clamp((card.costBadge.score || 0) / 0.12, 0, 1) : 0;
                    card.playConfidence = card.playable ? clamp((card.confidence || 0) * 0.65 + cachedBadgeEvidence * 0.35, 0, 1) : 0;
                });
            } else {
                fees = enrichHandWithFees(image, hand, config);
                if (fees.credits != null || fees.knownCards > 0) {
                    // enrichHandWithFees may replace a low-confidence 6-card
                    // geometry with an OCR-confirmed 7–9-card layout. Cache
                    // against the final geometry, not the pre-refinement key.
                    feeHandKey = hand.layout + "/" + hand.cards.length + "/" + hand.cards.map(function (c) { return c.bounds.join(","); }).join(";");
                    cachedFees = { credits: fees.credits, knownCards: fees.knownCards,
                        costs: hand.cards.map(function (c) { return c.cost; }),
                        badges: hand.cards.map(function (c) { return c.costBadge || { orange: false, score: 0 }; }),
                        types: hand.cards.map(function (c) { return c.type || "UNKNOWN"; }) };
                }
            }
        } else if (scene.scene !== "OUR_TURN") {
            feeFrame = 0; feeHandKey = ""; cachedFees = null;
        } else if (cachedFees) {
            fees = { credits: cachedFees.credits, knownCards: cachedFees.knownCards };
            hand.cards.forEach(function (card, index) {
                card.cost = cachedFees.costs[index] == null ? null : cachedFees.costs[index];
                card.costBadge = cachedFees.badges && cachedFees.badges[index] ? cachedFees.badges[index] : { orange: false, score: 0 };
                card.costBadgeOrange = card.costBadge.orange === true;
                card.type = cachedFees.types && cachedFees.types[index] ? cachedFees.types[index] : "UNKNOWN";
                card.playable = config.readCardCosts === false ? card.costBadgeOrange === true : (card.costBadgeOrange && card.cost != null && fees.credits != null && card.cost <= fees.credits);
                var pendingBadgeEvidence = card.costBadgeOrange ? clamp((card.costBadge.score || 0) / 0.12, 0, 1) : 0;
                card.playConfidence = card.playable ? clamp((card.confidence || 0) * 0.65 + pendingBadgeEvidence * 0.35, 0, 1) : 0;
            });
        }
        var deckModeToggle = uiScreen.screen === "DECK_DETAIL" ? detectDeckModeToggle(image, config) : null;
        var versusSelected = uiScreen.screen === "MODE_MENU" ? detectVersusSelected(image, config) : false;
        return { uiScreen: uiScreen, scene: scene, width: image.getWidth(), height: image.getHeight(), state: { scene: scene.scene, uiScreen: uiScreen.screen, credits: fees.credits, hand: hand.cards, handConfidence: hand.confidence, units: frameUnits, frontlineOwner: frontline.owner, frontlineY: frontline.y, frameHeight: image.getHeight(), deckModeToggle: deckModeToggle, versusSelected: versusSelected, pending: null }, legalTargets: targets, evidence: { hand: hand.detail, credits: fees.credits, knownCardCosts: fees.knownCards, legalTargetCount: targets.length, enemyGuardMarkerCount: guardMarkers.length, frontlineOwner: frontline.owner, frontlineY: frontline.y, frontlineConfidence: frontline.confidence, deckModeToggle: deckModeToggle, versusSelected: versusSelected } };
    }
    return { observe: observe };
}

module.exports = { create: create, observe: function (image, config) { return create(config).observe(image); }, _private: { cardAt: cardAt, detectHand: detectHand, handBounds: handBounds, bottomHandCountBySpan: bottomHandCountBySpan, fanBadgePresenceScore: fanBadgePresenceScore, ocrNumber: ocrNumber, stableOcrNumber: stableOcrNumber, ocrCardCost: ocrCardCost, ocrCardCostCandidates: ocrCardCostCandidates, cardCostCandidateBounds: cardCostCandidateBounds, detectOrangeCostBadge: detectOrangeCostBadge, directCombatTargets: directCombatTargets, unitState: unitState, detectFrontlineControl: detectFrontlineControl, detectTurnTransitionBanner: detectTurnTransitionBanner, ocrHqHealth: ocrHqHealth, rgbAverage: rgbAverage, identifyCardNation: identifyCardNation, identifyCardType: identifyCardType, identifyCardRarity: identifyCardRarity, identifyCardFoil: identifyCardFoil, identifyCard: identifyCard, detectReadyState: detectReadyState, detectOrangeMoveCost: detectOrangeMoveCost, enrichHandWithFees: enrichHandWithFees, cardCostBounds: cardCostBounds, legalTargets: legalTargets, feature: feature, detectBattleTurn: detectBattleTurn, detectResultScreen: detectResultScreen, detectMulliganScreen: detectMulliganScreen, detectPromoPopup: detectPromoPopup, detectDeckModeToggle, detectVersusSelected, detectEnemyGuardMarkers: detectEnemyGuardMarkers, guardIconBounds: guardIconBounds, detectHqBounds: detectHqBounds, detectFormationHqBounds: detectFormationHqBounds, hqHeaderIdentityScore: hqHeaderIdentityScore, detectHqByHealth: detectHqByHealth, dynamicFormationUnitSlots: dynamicFormationUnitSlots, hasBlockingOverlay: hasBlockingOverlay } };
