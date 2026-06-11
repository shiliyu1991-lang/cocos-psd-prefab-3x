"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeEffects = exports.readEffects = void 0;
var helpers_1 = require("./helpers");
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
var bevelStyles = [
    undefined, 'outer bevel', 'inner bevel', 'emboss', 'pillow emboss', 'stroke emboss'
];
function readBlendMode(reader) {
    (0, psdReader_1.checkSignature)(reader, '8BIM');
    return helpers_1.toBlendMode[(0, psdReader_1.readSignature)(reader)] || 'normal';
}
function writeBlendMode(writer, mode) {
    (0, psdWriter_1.writeSignature)(writer, '8BIM');
    (0, psdWriter_1.writeSignature)(writer, helpers_1.fromBlendMode[mode] || 'norm');
}
function readFixedPoint8(reader) {
    return (0, psdReader_1.readUint8)(reader) / 0xff;
}
function writeFixedPoint8(writer, value) {
    (0, psdWriter_1.writeUint8)(writer, Math.round(value * 0xff) | 0);
}
function readEffects(reader) {
    var version = (0, psdReader_1.readUint16)(reader);
    if (version !== 0)
        throw new Error("Invalid effects layer version: ".concat(version));
    var effectsCount = (0, psdReader_1.readUint16)(reader);
    var effects = {};
    for (var i = 0; i < effectsCount; i++) {
        (0, psdReader_1.checkSignature)(reader, '8BIM');
        var type = (0, psdReader_1.readSignature)(reader);
        switch (type) {
            case 'cmnS': { // common state (see See Effects layer, common state info)
                var size = (0, psdReader_1.readUint32)(reader);
                var version_1 = (0, psdReader_1.readUint32)(reader);
                var visible = !!(0, psdReader_1.readUint8)(reader);
                (0, psdReader_1.skipBytes)(reader, 2);
                if (size !== 7 || version_1 !== 0 || !visible)
                    throw new Error("Invalid effects common state");
                break;
            }
            case 'dsdw': // drop shadow (see See Effects layer, drop shadow and inner shadow info)
            case 'isdw': { // inner shadow (see See Effects layer, drop shadow and inner shadow info)
                var blockSize = (0, psdReader_1.readUint32)(reader);
                var version_2 = (0, psdReader_1.readUint32)(reader);
                if (blockSize !== 41 && blockSize !== 51)
                    throw new Error("Invalid shadow size: ".concat(blockSize));
                if (version_2 !== 0 && version_2 !== 2)
                    throw new Error("Invalid shadow version: ".concat(version_2));
                var size = (0, psdReader_1.readFixedPoint32)(reader);
                (0, psdReader_1.readFixedPoint32)(reader); // intensity
                var angle = (0, psdReader_1.readFixedPoint32)(reader);
                var distance = (0, psdReader_1.readFixedPoint32)(reader);
                var color = (0, psdReader_1.readColor)(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                var useGlobalLight = !!(0, psdReader_1.readUint8)(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 51)
                    (0, psdReader_1.readColor)(reader); // native color
                var shadowInfo = {
                    size: { units: 'Pixels', value: size },
                    distance: { units: 'Pixels', value: distance },
                    angle: angle,
                    color: color,
                    blendMode: blendMode,
                    enabled: enabled,
                    useGlobalLight: useGlobalLight,
                    opacity: opacity
                };
                if (type === 'dsdw') {
                    effects.dropShadow = [shadowInfo];
                }
                else {
                    effects.innerShadow = [shadowInfo];
                }
                break;
            }
            case 'oglw': { // outer glow (see See Effects layer, outer glow info)
                var blockSize = (0, psdReader_1.readUint32)(reader);
                var version_3 = (0, psdReader_1.readUint32)(reader);
                if (blockSize !== 32 && blockSize !== 42)
                    throw new Error("Invalid outer glow size: ".concat(blockSize));
                if (version_3 !== 0 && version_3 !== 2)
                    throw new Error("Invalid outer glow version: ".concat(version_3));
                var size = (0, psdReader_1.readFixedPoint32)(reader);
                (0, psdReader_1.readFixedPoint32)(reader); // intensity
                var color = (0, psdReader_1.readColor)(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 42)
                    (0, psdReader_1.readColor)(reader); // native color
                effects.outerGlow = {
                    size: { units: 'Pixels', value: size },
                    color: color,
                    blendMode: blendMode,
                    enabled: enabled,
                    opacity: opacity
                };
                break;
            }
            case 'iglw': { // inner glow (see See Effects layer, inner glow info)
                var blockSize = (0, psdReader_1.readUint32)(reader);
                var version_4 = (0, psdReader_1.readUint32)(reader);
                if (blockSize !== 32 && blockSize !== 43)
                    throw new Error("Invalid inner glow size: ".concat(blockSize));
                if (version_4 !== 0 && version_4 !== 2)
                    throw new Error("Invalid inner glow version: ".concat(version_4));
                var size = (0, psdReader_1.readFixedPoint32)(reader);
                (0, psdReader_1.readFixedPoint32)(reader); // intensity
                var color = (0, psdReader_1.readColor)(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 43) {
                    (0, psdReader_1.readUint8)(reader); // inverted
                    (0, psdReader_1.readColor)(reader); // native color
                }
                effects.innerGlow = {
                    size: { units: 'Pixels', value: size },
                    color: color,
                    blendMode: blendMode,
                    enabled: enabled,
                    opacity: opacity
                };
                break;
            }
            case 'bevl': { // bevel (see See Effects layer, bevel info)
                var blockSize = (0, psdReader_1.readUint32)(reader);
                var version_5 = (0, psdReader_1.readUint32)(reader);
                if (blockSize !== 58 && blockSize !== 78)
                    throw new Error("Invalid bevel size: ".concat(blockSize));
                if (version_5 !== 0 && version_5 !== 2)
                    throw new Error("Invalid bevel version: ".concat(version_5));
                var angle = (0, psdReader_1.readFixedPoint32)(reader);
                var strength = (0, psdReader_1.readFixedPoint32)(reader);
                var size = (0, psdReader_1.readFixedPoint32)(reader);
                var highlightBlendMode = readBlendMode(reader);
                var shadowBlendMode = readBlendMode(reader);
                var highlightColor = (0, psdReader_1.readColor)(reader);
                var shadowColor = (0, psdReader_1.readColor)(reader);
                var style = bevelStyles[(0, psdReader_1.readUint8)(reader)] || 'inner bevel';
                var highlightOpacity = readFixedPoint8(reader);
                var shadowOpacity = readFixedPoint8(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                var useGlobalLight = !!(0, psdReader_1.readUint8)(reader);
                var direction = (0, psdReader_1.readUint8)(reader) ? 'down' : 'up';
                if (blockSize >= 78) {
                    (0, psdReader_1.readColor)(reader); // real highlight color
                    (0, psdReader_1.readColor)(reader); // real shadow color
                }
                effects.bevel = {
                    size: { units: 'Pixels', value: size },
                    angle: angle,
                    strength: strength,
                    highlightBlendMode: highlightBlendMode,
                    shadowBlendMode: shadowBlendMode,
                    highlightColor: highlightColor,
                    shadowColor: shadowColor,
                    style: style,
                    highlightOpacity: highlightOpacity,
                    shadowOpacity: shadowOpacity,
                    enabled: enabled,
                    useGlobalLight: useGlobalLight,
                    direction: direction,
                };
                break;
            }
            case 'sofi': { // solid fill (Photoshop 7.0) (see See Effects layer, solid fill (added in Photoshop 7.0))
                var size = (0, psdReader_1.readUint32)(reader);
                var version_6 = (0, psdReader_1.readUint32)(reader);
                if (size !== 34)
                    throw new Error("Invalid effects solid fill info size: ".concat(size));
                if (version_6 !== 2)
                    throw new Error("Invalid effects solid fill info version: ".concat(version_6));
                var blendMode = readBlendMode(reader);
                var color = (0, psdReader_1.readColor)(reader);
                var opacity = readFixedPoint8(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                (0, psdReader_1.readColor)(reader); // native color
                effects.solidFill = [{ blendMode: blendMode, color: color, opacity: opacity, enabled: enabled }];
                break;
            }
            default:
                throw new Error("Invalid effect type: '".concat(type, "'"));
        }
    }
    return effects;
}
exports.readEffects = readEffects;
function writeShadowInfo(writer, shadow) {
    var _a;
    (0, psdWriter_1.writeUint32)(writer, 51);
    (0, psdWriter_1.writeUint32)(writer, 2);
    (0, psdWriter_1.writeFixedPoint32)(writer, shadow.size && shadow.size.value || 0);
    (0, psdWriter_1.writeFixedPoint32)(writer, 0); // intensity
    (0, psdWriter_1.writeFixedPoint32)(writer, shadow.angle || 0);
    (0, psdWriter_1.writeFixedPoint32)(writer, shadow.distance && shadow.distance.value || 0);
    (0, psdWriter_1.writeColor)(writer, shadow.color);
    writeBlendMode(writer, shadow.blendMode);
    (0, psdWriter_1.writeUint8)(writer, shadow.enabled ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, shadow.useGlobalLight ? 1 : 0);
    writeFixedPoint8(writer, (_a = shadow.opacity) !== null && _a !== void 0 ? _a : 1);
    (0, psdWriter_1.writeColor)(writer, shadow.color); // native color
}
function writeEffects(writer, effects) {
    var _a, _b, _c, _d, _e, _f;
    var dropShadow = (_a = effects.dropShadow) === null || _a === void 0 ? void 0 : _a[0];
    var innerShadow = (_b = effects.innerShadow) === null || _b === void 0 ? void 0 : _b[0];
    var outerGlow = effects.outerGlow;
    var innerGlow = effects.innerGlow;
    var bevel = effects.bevel;
    var solidFill = (_c = effects.solidFill) === null || _c === void 0 ? void 0 : _c[0];
    var count = 1;
    if (dropShadow)
        count++;
    if (innerShadow)
        count++;
    if (outerGlow)
        count++;
    if (innerGlow)
        count++;
    if (bevel)
        count++;
    if (solidFill)
        count++;
    (0, psdWriter_1.writeUint16)(writer, 0);
    (0, psdWriter_1.writeUint16)(writer, count);
    (0, psdWriter_1.writeSignature)(writer, '8BIM');
    (0, psdWriter_1.writeSignature)(writer, 'cmnS');
    (0, psdWriter_1.writeUint32)(writer, 7); // size
    (0, psdWriter_1.writeUint32)(writer, 0); // version
    (0, psdWriter_1.writeUint8)(writer, 1); // visible
    (0, psdWriter_1.writeZeros)(writer, 2);
    if (dropShadow) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'dsdw');
        writeShadowInfo(writer, dropShadow);
    }
    if (innerShadow) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'isdw');
        writeShadowInfo(writer, innerShadow);
    }
    if (outerGlow) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'oglw');
        (0, psdWriter_1.writeUint32)(writer, 42);
        (0, psdWriter_1.writeUint32)(writer, 2);
        (0, psdWriter_1.writeFixedPoint32)(writer, ((_d = outerGlow.size) === null || _d === void 0 ? void 0 : _d.value) || 0);
        (0, psdWriter_1.writeFixedPoint32)(writer, 0); // intensity
        (0, psdWriter_1.writeColor)(writer, outerGlow.color);
        writeBlendMode(writer, outerGlow.blendMode);
        (0, psdWriter_1.writeUint8)(writer, outerGlow.enabled ? 1 : 0);
        writeFixedPoint8(writer, outerGlow.opacity || 0);
        (0, psdWriter_1.writeColor)(writer, outerGlow.color);
    }
    if (innerGlow) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'iglw');
        (0, psdWriter_1.writeUint32)(writer, 43);
        (0, psdWriter_1.writeUint32)(writer, 2);
        (0, psdWriter_1.writeFixedPoint32)(writer, ((_e = innerGlow.size) === null || _e === void 0 ? void 0 : _e.value) || 0);
        (0, psdWriter_1.writeFixedPoint32)(writer, 0); // intensity
        (0, psdWriter_1.writeColor)(writer, innerGlow.color);
        writeBlendMode(writer, innerGlow.blendMode);
        (0, psdWriter_1.writeUint8)(writer, innerGlow.enabled ? 1 : 0);
        writeFixedPoint8(writer, innerGlow.opacity || 0);
        (0, psdWriter_1.writeUint8)(writer, 0); // inverted
        (0, psdWriter_1.writeColor)(writer, innerGlow.color);
    }
    if (bevel) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'bevl');
        (0, psdWriter_1.writeUint32)(writer, 78);
        (0, psdWriter_1.writeUint32)(writer, 2);
        (0, psdWriter_1.writeFixedPoint32)(writer, bevel.angle || 0);
        (0, psdWriter_1.writeFixedPoint32)(writer, bevel.strength || 0);
        (0, psdWriter_1.writeFixedPoint32)(writer, ((_f = bevel.size) === null || _f === void 0 ? void 0 : _f.value) || 0);
        writeBlendMode(writer, bevel.highlightBlendMode);
        writeBlendMode(writer, bevel.shadowBlendMode);
        (0, psdWriter_1.writeColor)(writer, bevel.highlightColor);
        (0, psdWriter_1.writeColor)(writer, bevel.shadowColor);
        var style = bevelStyles.indexOf(bevel.style);
        (0, psdWriter_1.writeUint8)(writer, style <= 0 ? 1 : style);
        writeFixedPoint8(writer, bevel.highlightOpacity || 0);
        writeFixedPoint8(writer, bevel.shadowOpacity || 0);
        (0, psdWriter_1.writeUint8)(writer, bevel.enabled ? 1 : 0);
        (0, psdWriter_1.writeUint8)(writer, bevel.useGlobalLight ? 1 : 0);
        (0, psdWriter_1.writeUint8)(writer, bevel.direction === 'down' ? 1 : 0);
        (0, psdWriter_1.writeColor)(writer, bevel.highlightColor);
        (0, psdWriter_1.writeColor)(writer, bevel.shadowColor);
    }
    if (solidFill) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'sofi');
        (0, psdWriter_1.writeUint32)(writer, 34);
        (0, psdWriter_1.writeUint32)(writer, 2);
        writeBlendMode(writer, solidFill.blendMode);
        (0, psdWriter_1.writeColor)(writer, solidFill.color);
        writeFixedPoint8(writer, solidFill.opacity || 0);
        (0, psdWriter_1.writeUint8)(writer, solidFill.enabled ? 1 : 0);
        (0, psdWriter_1.writeColor)(writer, solidFill.color);
    }
}
exports.writeEffects = writeEffects;
//# sourceMappingURL=effectsHelpers.js.map