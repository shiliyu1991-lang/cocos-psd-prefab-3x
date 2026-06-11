"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeString = exports.encodeString = exports.encodeStringTo = exports.stringLengthInBytes = void 0;
function charLengthInBytes(code) {
    if ((code & 0xffffff80) === 0) {
        return 1;
    }
    else if ((code & 0xfffff800) === 0) {
        return 2;
    }
    else if ((code & 0xffff0000) === 0) {
        return 3;
    }
    else {
        return 4;
    }
}
function stringLengthInBytes(value) {
    var result = 0;
    for (var i = 0; i < value.length; i++) {
        var code = value.charCodeAt(i);
        // high surrogate
        if (code >= 0xd800 && code <= 0xdbff) {
            if ((i + 1) < value.length) {
                var extra = value.charCodeAt(i + 1);
                // low surrogate
                if ((extra & 0xfc00) === 0xdc00) {
                    i++;
                    result += charLengthInBytes(((code & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
                }
            }
        }
        else {
            result += charLengthInBytes(code);
        }
    }
    return result;
}
exports.stringLengthInBytes = stringLengthInBytes;
function writeCharacter(buffer, offset, code) {
    var length = charLengthInBytes(code);
    switch (length) {
        case 1:
            buffer[offset] = code;
            break;
        case 2:
            buffer[offset] = ((code >> 6) & 0x1f) | 0xc0;
            buffer[offset + 1] = (code & 0x3f) | 0x80;
            break;
        case 3:
            buffer[offset] = ((code >> 12) & 0x0f) | 0xe0;
            buffer[offset + 1] = ((code >> 6) & 0x3f) | 0x80;
            buffer[offset + 2] = (code & 0x3f) | 0x80;
            break;
        default:
            buffer[offset] = ((code >> 18) & 0x07) | 0xf0;
            buffer[offset + 1] = ((code >> 12) & 0x3f) | 0x80;
            buffer[offset + 2] = ((code >> 6) & 0x3f) | 0x80;
            buffer[offset + 3] = (code & 0x3f) | 0x80;
            break;
    }
    return length;
}
function encodeStringTo(buffer, offset, value) {
    for (var i = 0; i < value.length; i++) {
        var code = value.charCodeAt(i);
        // high surrogate
        if (code >= 0xd800 && code <= 0xdbff) {
            if ((i + 1) < value.length) {
                var extra = value.charCodeAt(i + 1);
                // low surrogate
                if ((extra & 0xfc00) === 0xdc00) {
                    i++;
                    var fullCode = ((code & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
                    offset += writeCharacter(buffer, offset, fullCode);
                }
            }
        }
        else {
            offset += writeCharacter(buffer, offset, code);
        }
    }
    return offset;
}
exports.encodeStringTo = encodeStringTo;
function encodeString(value) {
    if (value.length > 1000 && typeof TextEncoder !== 'undefined') {
        return (new TextEncoder()).encode(value);
    }
    var buffer = new Uint8Array(stringLengthInBytes(value));
    encodeStringTo(buffer, 0, value);
    return buffer;
}
exports.encodeString = encodeString;
function continuationByte(buffer, index) {
    if (index >= buffer.length) {
        throw Error('Invalid byte index');
    }
    var continuationByte = buffer[index];
    if ((continuationByte & 0xC0) === 0x80) {
        return continuationByte & 0x3F;
    }
    else {
        throw Error('Invalid continuation byte');
    }
}
function decodeString(value) {
    if (value.byteLength > 1000 && typeof TextDecoder !== 'undefined') {
        return (new TextDecoder()).decode(value);
    }
    var result = [];
    for (var i = 0; i < value.length;) {
        var byte1 = value[i++];
        var code = void 0;
        if ((byte1 & 0x80) === 0) {
            code = byte1;
        }
        else if ((byte1 & 0xe0) === 0xc0) {
            var byte2 = continuationByte(value, i++);
            code = ((byte1 & 0x1f) << 6) | byte2;
            if (code < 0x80) {
                throw Error('Invalid continuation byte');
            }
        }
        else if ((byte1 & 0xf0) === 0xe0) {
            var byte2 = continuationByte(value, i++);
            var byte3 = continuationByte(value, i++);
            code = ((byte1 & 0x0f) << 12) | (byte2 << 6) | byte3;
            if (code < 0x0800) {
                throw Error('Invalid continuation byte');
            }
            if (code >= 0xd800 && code <= 0xdfff) {
                throw Error("Lone surrogate U+".concat(code.toString(16).toUpperCase(), " is not a scalar value"));
            }
        }
        else if ((byte1 & 0xf8) === 0xf0) {
            var byte2 = continuationByte(value, i++);
            var byte3 = continuationByte(value, i++);
            var byte4 = continuationByte(value, i++);
            code = ((byte1 & 0x0f) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
            if (code < 0x010000 || code > 0x10ffff) {
                throw Error('Invalid continuation byte');
            }
        }
        else {
            throw Error('Invalid UTF-8 detected');
        }
        if (code > 0xffff) {
            code -= 0x10000;
            result.push(String.fromCharCode(code >>> 10 & 0x3ff | 0xd800));
            code = 0xdc00 | code & 0x3ff;
        }
        result.push(String.fromCharCode(code));
    }
    return result.join('');
}
exports.decodeString = decodeString;
//# sourceMappingURL=utf8.js.map