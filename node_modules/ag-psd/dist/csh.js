"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCsh = void 0;
var additionalInfo_1 = require("./additionalInfo");
var psdReader_1 = require("./psdReader");
function readCsh(buffer) {
    var reader = (0, psdReader_1.createReader)(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var csh = { shapes: [] };
    (0, psdReader_1.checkSignature)(reader, 'cush');
    if ((0, psdReader_1.readUint32)(reader) !== 2)
        throw new Error('Invalid version');
    var count = (0, psdReader_1.readUint32)(reader);
    for (var i = 0; i < count; i++) {
        var name_1 = (0, psdReader_1.readUnicodeString)(reader);
        while (reader.offset % 4)
            reader.offset++; // pad to 4byte bounds
        if ((0, psdReader_1.readUint32)(reader) !== 1)
            throw new Error('Invalid shape version');
        var size = (0, psdReader_1.readUint32)(reader);
        var end = reader.offset + size;
        var id = (0, psdReader_1.readPascalString)(reader, 1);
        // this might not be correct ???
        var y1 = (0, psdReader_1.readUint32)(reader);
        var x1 = (0, psdReader_1.readUint32)(reader);
        var y2 = (0, psdReader_1.readUint32)(reader);
        var x2 = (0, psdReader_1.readUint32)(reader);
        var width = x2 - x1;
        var height = y2 - y1;
        var mask = { paths: [] };
        (0, additionalInfo_1.readVectorMask)(reader, mask, width, height, end - reader.offset);
        csh.shapes.push(__assign({ name: name_1, id: id, width: width, height: height }, mask));
        reader.offset = end;
    }
    return csh;
}
exports.readCsh = readCsh;
//# sourceMappingURL=csh.js.map