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
import { readVectorMask } from './additionalInfo';
import { readUint32, checkSignature, createReader, readPascalString, readUnicodeString } from './psdReader';
export function readCsh(buffer) {
    var reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var csh = { shapes: [] };
    checkSignature(reader, 'cush');
    if (readUint32(reader) !== 2)
        throw new Error('Invalid version');
    var count = readUint32(reader);
    for (var i = 0; i < count; i++) {
        var name_1 = readUnicodeString(reader);
        while (reader.offset % 4)
            reader.offset++; // pad to 4byte bounds
        if (readUint32(reader) !== 1)
            throw new Error('Invalid shape version');
        var size = readUint32(reader);
        var end = reader.offset + size;
        var id = readPascalString(reader, 1);
        // this might not be correct ???
        var y1 = readUint32(reader);
        var x1 = readUint32(reader);
        var y2 = readUint32(reader);
        var x2 = readUint32(reader);
        var width = x2 - x1;
        var height = y2 - y1;
        var mask = { paths: [] };
        readVectorMask(reader, mask, width, height, end - reader.offset);
        csh.shapes.push(__assign({ name: name_1, id: id, width: width, height: height }, mask));
        reader.offset = end;
    }
    return csh;
}
//# sourceMappingURL=csh.js.map