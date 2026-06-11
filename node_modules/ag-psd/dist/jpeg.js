"use strict";
// based on https://github.com/jpeg-js/jpeg-js
/*
   Copyright 2011 notmasteryet

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeJpeg = void 0;
var dctZigZag = new Int32Array([
    0,
    1, 8,
    16, 9, 2,
    3, 10, 17, 24,
    32, 25, 18, 11, 4,
    5, 12, 19, 26, 33, 40,
    48, 41, 34, 27, 20, 13, 6,
    7, 14, 21, 28, 35, 42, 49, 56,
    57, 50, 43, 36, 29, 22, 15,
    23, 30, 37, 44, 51, 58,
    59, 52, 45, 38, 31,
    39, 46, 53, 60,
    61, 54, 47,
    55, 62,
    63
]);
var dctCos1 = 4017; // cos(pi/16)
var dctSin1 = 799; // sin(pi/16)
var dctCos3 = 3406; // cos(3*pi/16)
var dctSin3 = 2276; // sin(3*pi/16)
var dctCos6 = 1567; // cos(6*pi/16)
var dctSin6 = 3784; // sin(6*pi/16)
var dctSqrt2 = 5793; // sqrt(2)
var dctSqrt1d2 = 2896; // sqrt(2) / 2
var maxResolutionInMP = 100; // Don't decode more than 100 megapixels
var maxMemoryUsageBytes = 64 * 1024 * 1024; // Don't decode if memory footprint is more than 64MB
var totalBytesAllocated = 0; // avoid unexpected OOMs from untrusted content.
function requestMemoryAllocation(increaseAmount) {
    var totalMemoryImpactBytes = totalBytesAllocated + increaseAmount;
    if (totalMemoryImpactBytes > maxMemoryUsageBytes) {
        var exceededAmount = Math.ceil((totalMemoryImpactBytes - maxMemoryUsageBytes) / 1024 / 1024);
        throw new Error("Max memory limit exceeded by at least ".concat(exceededAmount, "MB"));
    }
    totalBytesAllocated = totalMemoryImpactBytes;
}
function buildHuffmanTable(codeLengths, values) {
    var length = 16;
    while (length > 0 && !codeLengths[length - 1])
        length--;
    var code = [{ children: [], index: 0 }];
    var k = 0;
    var p = code[0];
    for (var i = 0; i < length; i++) {
        for (var j = 0; j < codeLengths[i]; j++) {
            p = code.pop();
            p.children[p.index] = values[k];
            while (p.index > 0) {
                if (code.length === 0)
                    throw new Error('Could not recreate Huffman Table');
                p = code.pop();
            }
            p.index++;
            code.push(p);
            while (code.length <= i) {
                var q = { children: [], index: 0 };
                code.push(q);
                p.children[p.index] = q.children;
                p = q;
            }
            k++;
        }
        if (i + 1 < length) {
            // p here points to last code
            var q = { children: [], index: 0 };
            code.push(q);
            p.children[p.index] = q.children;
            p = q;
        }
    }
    return code[0].children;
}
function decodeScan(data, offset, frame, components, resetInterval, spectralStart, spectralEnd, successivePrev, successive) {
    var mcusPerLine = frame.mcusPerLine;
    var progressive = frame.progressive;
    var startOffset = offset;
    var bitsData = 0;
    var bitsCount = 0;
    function readBit() {
        if (bitsCount > 0) {
            bitsCount--;
            return (bitsData >> bitsCount) & 1;
        }
        bitsData = data[offset++];
        if (bitsData == 0xFF) {
            var nextByte = data[offset++];
            if (nextByte)
                throw new Error("unexpected marker: ".concat(((bitsData << 8) | nextByte).toString(16)));
            // unstuff 0
        }
        bitsCount = 7;
        return bitsData >>> 7;
    }
    function decodeHuffman(tree) {
        var node = tree;
        while (true) {
            node = node[readBit()];
            if (typeof node === 'number')
                return node;
            if (node === undefined)
                throw new Error('invalid huffman sequence');
        }
    }
    function receive(length) {
        var n = 0;
        while (length > 0) {
            n = (n << 1) | readBit();
            length--;
        }
        return n;
    }
    function receiveAndExtend(length) {
        var n = receive(length);
        if (n >= 1 << (length - 1))
            return n;
        return n + (-1 << length) + 1;
    }
    function decodeBaseline(component, zz) {
        var t = decodeHuffman(component.huffmanTableDC);
        var diff = t === 0 ? 0 : receiveAndExtend(t);
        zz[0] = (component.pred += diff);
        var k = 1;
        while (k < 64) {
            var rs = decodeHuffman(component.huffmanTableAC);
            var s = rs & 15;
            var r = rs >> 4;
            if (s === 0) {
                if (r < 15)
                    break;
                k += 16;
                continue;
            }
            k += r;
            var z = dctZigZag[k];
            zz[z] = receiveAndExtend(s);
            k++;
        }
    }
    function decodeDCFirst(component, zz) {
        var t = decodeHuffman(component.huffmanTableDC);
        var diff = t === 0 ? 0 : (receiveAndExtend(t) << successive);
        zz[0] = (component.pred += diff);
    }
    function decodeDCSuccessive(_component, zz) {
        zz[0] |= readBit() << successive;
    }
    var eobrun = 0;
    function decodeACFirst(component, zz) {
        if (eobrun > 0) {
            eobrun--;
            return;
        }
        var k = spectralStart, e = spectralEnd;
        while (k <= e) {
            var rs = decodeHuffman(component.huffmanTableAC);
            var s = rs & 15;
            var r = rs >> 4;
            if (s === 0) {
                if (r < 15) {
                    eobrun = receive(r) + (1 << r) - 1;
                    break;
                }
                k += 16;
                continue;
            }
            k += r;
            var z = dctZigZag[k];
            zz[z] = receiveAndExtend(s) * (1 << successive);
            k++;
        }
    }
    var successiveACState = 0;
    var successiveACNextValue = 0;
    function decodeACSuccessive(component, zz) {
        var k = spectralStart;
        var e = spectralEnd;
        var r = 0;
        while (k <= e) {
            var z = dctZigZag[k];
            var direction = zz[z] < 0 ? -1 : 1;
            switch (successiveACState) {
                case 0: // initial state
                    var rs = decodeHuffman(component.huffmanTableAC);
                    var s = rs & 15;
                    r = rs >> 4; // this was new variable in old code
                    if (s === 0) {
                        if (r < 15) {
                            eobrun = receive(r) + (1 << r);
                            successiveACState = 4;
                        }
                        else {
                            r = 16;
                            successiveACState = 1;
                        }
                    }
                    else {
                        if (s !== 1)
                            throw new Error('invalid ACn encoding');
                        successiveACNextValue = receiveAndExtend(s);
                        successiveACState = r ? 2 : 3;
                    }
                    continue;
                case 1: // skipping r zero items
                case 2:
                    if (zz[z]) {
                        zz[z] += (readBit() << successive) * direction;
                    }
                    else {
                        r--;
                        if (r === 0)
                            successiveACState = successiveACState == 2 ? 3 : 0;
                    }
                    break;
                case 3: // set value for a zero item
                    if (zz[z]) {
                        zz[z] += (readBit() << successive) * direction;
                    }
                    else {
                        zz[z] = successiveACNextValue << successive;
                        successiveACState = 0;
                    }
                    break;
                case 4: // eob
                    if (zz[z]) {
                        zz[z] += (readBit() << successive) * direction;
                    }
                    break;
            }
            k++;
        }
        if (successiveACState === 4) {
            eobrun--;
            if (eobrun === 0)
                successiveACState = 0;
        }
    }
    function decodeMcu(component, decode, mcu, row, col) {
        var mcuRow = (mcu / mcusPerLine) | 0;
        var mcuCol = mcu % mcusPerLine;
        var blockRow = mcuRow * component.v + row;
        var blockCol = mcuCol * component.h + col;
        // If the block is missing, just skip it.
        if (component.blocks[blockRow] === undefined)
            return;
        decode(component, component.blocks[blockRow][blockCol]);
    }
    function decodeBlock(component, decode, mcu) {
        var blockRow = (mcu / component.blocksPerLine) | 0;
        var blockCol = mcu % component.blocksPerLine;
        // If the block is missing, just skip it.
        if (component.blocks[blockRow] === undefined)
            return;
        decode(component, component.blocks[blockRow][blockCol]);
    }
    var componentsLength = components.length;
    var component;
    var decodeFn;
    if (progressive) {
        if (spectralStart === 0) {
            decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
        }
        else {
            decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
        }
    }
    else {
        decodeFn = decodeBaseline;
    }
    var mcu = 0;
    var mcuExpected;
    if (componentsLength == 1) {
        mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn;
    }
    else {
        mcuExpected = mcusPerLine * frame.mcusPerColumn;
    }
    if (!resetInterval)
        resetInterval = mcuExpected;
    var h;
    var v;
    var marker;
    while (mcu < mcuExpected) {
        // reset interval stuff
        for (var i = 0; i < componentsLength; i++)
            components[i].pred = 0;
        eobrun = 0;
        if (componentsLength == 1) {
            component = components[0];
            for (var n = 0; n < resetInterval; n++) {
                decodeBlock(component, decodeFn, mcu);
                mcu++;
            }
        }
        else {
            for (var n = 0; n < resetInterval; n++) {
                for (var i = 0; i < componentsLength; i++) {
                    component = components[i];
                    h = component.h;
                    v = component.v;
                    for (var j = 0; j < v; j++) {
                        for (var k = 0; k < h; k++) {
                            decodeMcu(component, decodeFn, mcu, j, k);
                        }
                    }
                }
                mcu++;
                // If we've reached our expected MCU's, stop decoding
                if (mcu === mcuExpected)
                    break;
            }
        }
        if (mcu === mcuExpected) {
            // Skip trailing bytes at the end of the scan - until we reach the next marker
            do {
                if (data[offset] === 0xFF) {
                    if (data[offset + 1] !== 0x00) {
                        break;
                    }
                }
                offset += 1;
            } while (offset < data.length - 2);
        }
        // find marker
        bitsCount = 0;
        marker = (data[offset] << 8) | data[offset + 1];
        if (marker < 0xFF00)
            throw new Error('marker was not found');
        if (marker >= 0xFFD0 && marker <= 0xFFD7) { // RSTx
            offset += 2;
        }
        else {
            break;
        }
    }
    return offset - startOffset;
}
function buildComponentData(component) {
    var lines = [];
    var blocksPerLine = component.blocksPerLine;
    var blocksPerColumn = component.blocksPerColumn;
    var samplesPerLine = blocksPerLine << 3;
    // Only 1 used per invocation of this function and garbage collected after invocation, so no need to account for its memory footprint.
    var R = new Int32Array(64);
    var r = new Uint8Array(64);
    // A port of poppler's IDCT method which in turn is taken from:
    //   Christoph Loeffler, Adriaan Ligtenberg, George S. Moschytz,
    //   "Practical Fast 1-D DCT Algorithms with 11 Multiplications",
    //   IEEE Intl. Conf. on Acoustics, Speech & Signal Processing, 1989,
    //   988-991.
    function quantizeAndInverse(zz, dataOut, dataIn) {
        var qt = component.quantizationTable;
        var p = dataIn;
        // dequant
        for (var i = 0; i < 64; i++) {
            p[i] = zz[i] * qt[i];
        }
        // inverse DCT on rows
        for (var i = 0; i < 8; ++i) {
            var row = 8 * i;
            // check for all-zero AC coefficients
            if (p[1 + row] == 0 && p[2 + row] == 0 && p[3 + row] == 0 &&
                p[4 + row] == 0 && p[5 + row] == 0 && p[6 + row] == 0 &&
                p[7 + row] == 0) {
                var t_1 = (dctSqrt2 * p[0 + row] + 512) >> 10;
                p[0 + row] = t_1;
                p[1 + row] = t_1;
                p[2 + row] = t_1;
                p[3 + row] = t_1;
                p[4 + row] = t_1;
                p[5 + row] = t_1;
                p[6 + row] = t_1;
                p[7 + row] = t_1;
                continue;
            }
            // stage 4
            var v0 = (dctSqrt2 * p[0 + row] + 128) >> 8;
            var v1 = (dctSqrt2 * p[4 + row] + 128) >> 8;
            var v2 = p[2 + row];
            var v3 = p[6 + row];
            var v4 = (dctSqrt1d2 * (p[1 + row] - p[7 + row]) + 128) >> 8;
            var v7 = (dctSqrt1d2 * (p[1 + row] + p[7 + row]) + 128) >> 8;
            var v5 = p[3 + row] << 4;
            var v6 = p[5 + row] << 4;
            // stage 3
            var t = (v0 - v1 + 1) >> 1;
            v0 = (v0 + v1 + 1) >> 1;
            v1 = t;
            t = (v2 * dctSin6 + v3 * dctCos6 + 128) >> 8;
            v2 = (v2 * dctCos6 - v3 * dctSin6 + 128) >> 8;
            v3 = t;
            t = (v4 - v6 + 1) >> 1;
            v4 = (v4 + v6 + 1) >> 1;
            v6 = t;
            t = (v7 + v5 + 1) >> 1;
            v5 = (v7 - v5 + 1) >> 1;
            v7 = t;
            // stage 2
            t = (v0 - v3 + 1) >> 1;
            v0 = (v0 + v3 + 1) >> 1;
            v3 = t;
            t = (v1 - v2 + 1) >> 1;
            v1 = (v1 + v2 + 1) >> 1;
            v2 = t;
            t = (v4 * dctSin3 + v7 * dctCos3 + 2048) >> 12;
            v4 = (v4 * dctCos3 - v7 * dctSin3 + 2048) >> 12;
            v7 = t;
            t = (v5 * dctSin1 + v6 * dctCos1 + 2048) >> 12;
            v5 = (v5 * dctCos1 - v6 * dctSin1 + 2048) >> 12;
            v6 = t;
            // stage 1
            p[0 + row] = v0 + v7;
            p[7 + row] = v0 - v7;
            p[1 + row] = v1 + v6;
            p[6 + row] = v1 - v6;
            p[2 + row] = v2 + v5;
            p[5 + row] = v2 - v5;
            p[3 + row] = v3 + v4;
            p[4 + row] = v3 - v4;
        }
        // inverse DCT on columns
        for (var i = 0; i < 8; ++i) {
            var col = i;
            // check for all-zero AC coefficients
            if (p[1 * 8 + col] == 0 && p[2 * 8 + col] == 0 && p[3 * 8 + col] == 0 &&
                p[4 * 8 + col] == 0 && p[5 * 8 + col] == 0 && p[6 * 8 + col] == 0 &&
                p[7 * 8 + col] == 0) {
                var t_2 = (dctSqrt2 * dataIn[i + 0] + 8192) >> 14;
                p[0 * 8 + col] = t_2;
                p[1 * 8 + col] = t_2;
                p[2 * 8 + col] = t_2;
                p[3 * 8 + col] = t_2;
                p[4 * 8 + col] = t_2;
                p[5 * 8 + col] = t_2;
                p[6 * 8 + col] = t_2;
                p[7 * 8 + col] = t_2;
                continue;
            }
            // stage 4
            var v0 = (dctSqrt2 * p[0 * 8 + col] + 2048) >> 12;
            var v1 = (dctSqrt2 * p[4 * 8 + col] + 2048) >> 12;
            var v2 = p[2 * 8 + col];
            var v3 = p[6 * 8 + col];
            var v4 = (dctSqrt1d2 * (p[1 * 8 + col] - p[7 * 8 + col]) + 2048) >> 12;
            var v7 = (dctSqrt1d2 * (p[1 * 8 + col] + p[7 * 8 + col]) + 2048) >> 12;
            var v5 = p[3 * 8 + col];
            var v6 = p[5 * 8 + col];
            // stage 3
            var t = (v0 - v1 + 1) >> 1;
            v0 = (v0 + v1 + 1) >> 1;
            v1 = t;
            t = (v2 * dctSin6 + v3 * dctCos6 + 2048) >> 12;
            v2 = (v2 * dctCos6 - v3 * dctSin6 + 2048) >> 12;
            v3 = t;
            t = (v4 - v6 + 1) >> 1;
            v4 = (v4 + v6 + 1) >> 1;
            v6 = t;
            t = (v7 + v5 + 1) >> 1;
            v5 = (v7 - v5 + 1) >> 1;
            v7 = t;
            // stage 2
            t = (v0 - v3 + 1) >> 1;
            v0 = (v0 + v3 + 1) >> 1;
            v3 = t;
            t = (v1 - v2 + 1) >> 1;
            v1 = (v1 + v2 + 1) >> 1;
            v2 = t;
            t = (v4 * dctSin3 + v7 * dctCos3 + 2048) >> 12;
            v4 = (v4 * dctCos3 - v7 * dctSin3 + 2048) >> 12;
            v7 = t;
            t = (v5 * dctSin1 + v6 * dctCos1 + 2048) >> 12;
            v5 = (v5 * dctCos1 - v6 * dctSin1 + 2048) >> 12;
            v6 = t;
            // stage 1
            p[0 * 8 + col] = v0 + v7;
            p[7 * 8 + col] = v0 - v7;
            p[1 * 8 + col] = v1 + v6;
            p[6 * 8 + col] = v1 - v6;
            p[2 * 8 + col] = v2 + v5;
            p[5 * 8 + col] = v2 - v5;
            p[3 * 8 + col] = v3 + v4;
            p[4 * 8 + col] = v3 - v4;
        }
        // convert to 8-bit integers
        for (var i = 0; i < 64; ++i) {
            var sample = 128 + ((p[i] + 8) >> 4);
            dataOut[i] = sample < 0 ? 0 : sample > 0xFF ? 0xFF : sample;
        }
    }
    requestMemoryAllocation(samplesPerLine * blocksPerColumn * 8);
    for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
        var scanLine = blockRow << 3;
        for (var i = 0; i < 8; i++)
            lines.push(new Uint8Array(samplesPerLine));
        for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) {
            quantizeAndInverse(component.blocks[blockRow][blockCol], r, R);
            var offset = 0;
            var sample = blockCol << 3;
            for (var j = 0; j < 8; j++) {
                var line = lines[scanLine + j];
                for (var i = 0; i < 8; i++)
                    line[sample + i] = r[offset++];
            }
        }
    }
    return lines;
}
function clampTo8bit(a) {
    return a < 0 ? 0 : a > 255 ? 255 : a;
}
function parse(data) {
    var self = {
        width: 0,
        height: 0,
        comments: [],
        adobe: undefined,
        components: [],
        exifBuffer: undefined,
        jfif: undefined,
    };
    var maxResolutionInPixels = maxResolutionInMP * 1000 * 1000;
    var offset = 0;
    function readUint16() {
        var value = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        return value;
    }
    function readDataBlock() {
        var length = readUint16();
        var array = data.subarray(offset, offset + length - 2);
        offset += array.length;
        return array;
    }
    function prepareComponents(frame) {
        var maxH = 0, maxV = 0;
        for (var componentId in frame.components) {
            if (frame.components.hasOwnProperty(componentId)) {
                var component = frame.components[componentId];
                if (maxH < component.h)
                    maxH = component.h;
                if (maxV < component.v)
                    maxV = component.v;
            }
        }
        var mcusPerLine = Math.ceil(frame.samplesPerLine / 8 / maxH);
        var mcusPerColumn = Math.ceil(frame.scanLines / 8 / maxV);
        for (var componentId in frame.components) {
            if (frame.components.hasOwnProperty(componentId)) {
                var component = frame.components[componentId];
                var blocksPerLine = Math.ceil(Math.ceil(frame.samplesPerLine / 8) * component.h / maxH);
                var blocksPerColumn = Math.ceil(Math.ceil(frame.scanLines / 8) * component.v / maxV);
                var blocksPerLineForMcu = mcusPerLine * component.h;
                var blocksPerColumnForMcu = mcusPerColumn * component.v;
                var blocksToAllocate = blocksPerColumnForMcu * blocksPerLineForMcu;
                var blocks = [];
                // Each block is a Int32Array of length 64 (4 x 64 = 256 bytes)
                requestMemoryAllocation(blocksToAllocate * 256);
                for (var i = 0; i < blocksPerColumnForMcu; i++) {
                    var row = [];
                    for (var j = 0; j < blocksPerLineForMcu; j++) {
                        row.push(new Int32Array(64));
                    }
                    blocks.push(row);
                }
                component.blocksPerLine = blocksPerLine;
                component.blocksPerColumn = blocksPerColumn;
                component.blocks = blocks;
            }
        }
        frame.maxH = maxH;
        frame.maxV = maxV;
        frame.mcusPerLine = mcusPerLine;
        frame.mcusPerColumn = mcusPerColumn;
    }
    var jfif = null;
    var adobe = null;
    var frame = undefined;
    var resetInterval = 0;
    var quantizationTables = [];
    var frames = [];
    var huffmanTablesAC = [];
    var huffmanTablesDC = [];
    var fileMarker = readUint16();
    var malformedDataOffset = -1;
    if (fileMarker != 0xFFD8) { // SOI (Start of Image)
        throw new Error('SOI not found');
    }
    fileMarker = readUint16();
    while (fileMarker != 0xFFD9) { // EOI (End of image)
        switch (fileMarker) {
            case 0xFF00: break;
            case 0xFFE0: // APP0 (Application Specific)
            case 0xFFE1: // APP1
            case 0xFFE2: // APP2
            case 0xFFE3: // APP3
            case 0xFFE4: // APP4
            case 0xFFE5: // APP5
            case 0xFFE6: // APP6
            case 0xFFE7: // APP7
            case 0xFFE8: // APP8
            case 0xFFE9: // APP9
            case 0xFFEA: // APP10
            case 0xFFEB: // APP11
            case 0xFFEC: // APP12
            case 0xFFED: // APP13
            case 0xFFEE: // APP14
            case 0xFFEF: // APP15
            case 0xFFFE: { // COM (Comment)
                var appData = readDataBlock();
                if (fileMarker === 0xFFFE) {
                    var comment = '';
                    for (var ii = 0; ii < appData.byteLength; ii++) {
                        comment += String.fromCharCode(appData[ii]);
                    }
                    self.comments.push(comment);
                }
                if (fileMarker === 0xFFE0) {
                    if (appData[0] === 0x4A && appData[1] === 0x46 && appData[2] === 0x49 &&
                        appData[3] === 0x46 && appData[4] === 0) { // 'JFIF\x00'
                        jfif = {
                            version: { major: appData[5], minor: appData[6] },
                            densityUnits: appData[7],
                            xDensity: (appData[8] << 8) | appData[9],
                            yDensity: (appData[10] << 8) | appData[11],
                            thumbWidth: appData[12],
                            thumbHeight: appData[13],
                            thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
                        };
                    }
                }
                // TODO APP1 - Exif
                if (fileMarker === 0xFFE1) {
                    if (appData[0] === 0x45 &&
                        appData[1] === 0x78 &&
                        appData[2] === 0x69 &&
                        appData[3] === 0x66 &&
                        appData[4] === 0) { // 'EXIF\x00'
                        self.exifBuffer = appData.subarray(5, appData.length);
                    }
                }
                if (fileMarker === 0xFFEE) {
                    if (appData[0] === 0x41 && appData[1] === 0x64 && appData[2] === 0x6F &&
                        appData[3] === 0x62 && appData[4] === 0x65 && appData[5] === 0) { // 'Adobe\x00'
                        adobe = {
                            version: appData[6],
                            flags0: (appData[7] << 8) | appData[8],
                            flags1: (appData[9] << 8) | appData[10],
                            transformCode: appData[11]
                        };
                    }
                }
                break;
            }
            case 0xFFDB: { // DQT (Define Quantization Tables)
                var quantizationTablesLength = readUint16();
                var quantizationTablesEnd = quantizationTablesLength + offset - 2;
                while (offset < quantizationTablesEnd) {
                    var quantizationTableSpec = data[offset++];
                    requestMemoryAllocation(64 * 4);
                    var tableData = new Int32Array(64);
                    if ((quantizationTableSpec >> 4) === 0) { // 8 bit values
                        for (var j = 0; j < 64; j++) {
                            var z = dctZigZag[j];
                            tableData[z] = data[offset++];
                        }
                    }
                    else if ((quantizationTableSpec >> 4) === 1) { //16 bit
                        for (var j = 0; j < 64; j++) {
                            var z = dctZigZag[j];
                            tableData[z] = readUint16();
                        }
                    }
                    else
                        throw new Error('DQT: invalid table spec');
                    quantizationTables[quantizationTableSpec & 15] = tableData;
                }
                break;
            }
            case 0xFFC0: // SOF0 (Start of Frame, Baseline DCT)
            case 0xFFC1: // SOF1 (Start of Frame, Extended DCT)
            case 0xFFC2: { // SOF2 (Start of Frame, Progressive DCT)
                readUint16(); // skip data length
                frame = {
                    extended: (fileMarker === 0xFFC1),
                    progressive: (fileMarker === 0xFFC2),
                    precision: data[offset++],
                    scanLines: readUint16(),
                    samplesPerLine: readUint16(),
                    components: {},
                    componentsOrder: [],
                    maxH: 0,
                    maxV: 0,
                    mcusPerLine: 0,
                    mcusPerColumn: 0,
                };
                var pixelsInFrame = frame.scanLines * frame.samplesPerLine;
                if (pixelsInFrame > maxResolutionInPixels) {
                    var exceededAmount = Math.ceil((pixelsInFrame - maxResolutionInPixels) / 1e6);
                    throw new Error("maxResolutionInMP limit exceeded by ".concat(exceededAmount, "MP"));
                }
                var componentsCount = data[offset++];
                for (var i = 0; i < componentsCount; i++) {
                    var componentId = data[offset];
                    var h = data[offset + 1] >> 4;
                    var v = data[offset + 1] & 15;
                    var qId = data[offset + 2];
                    frame.componentsOrder.push(componentId);
                    frame.components[componentId] = {
                        h: h,
                        v: v,
                        quantizationIdx: qId,
                        blocksPerColumn: 0,
                        blocksPerLine: 0,
                        blocks: [],
                        pred: 0,
                    };
                    offset += 3;
                }
                prepareComponents(frame);
                frames.push(frame);
                break;
            }
            case 0xFFC4: { // DHT (Define Huffman Tables)
                var huffmanLength = readUint16();
                for (var i = 2; i < huffmanLength;) {
                    var huffmanTableSpec = data[offset++];
                    var codeLengths = new Uint8Array(16);
                    var codeLengthSum = 0;
                    for (var j = 0; j < 16; j++, offset++) {
                        codeLengthSum += (codeLengths[j] = data[offset]);
                    }
                    requestMemoryAllocation(16 + codeLengthSum);
                    var huffmanValues = new Uint8Array(codeLengthSum);
                    for (var j = 0; j < codeLengthSum; j++, offset++) {
                        huffmanValues[j] = data[offset];
                    }
                    i += 17 + codeLengthSum;
                    var index = huffmanTableSpec & 15;
                    var table = (huffmanTableSpec >> 4) === 0 ? huffmanTablesDC : huffmanTablesAC;
                    table[index] = buildHuffmanTable(codeLengths, huffmanValues);
                }
                break;
            }
            case 0xFFDD: // DRI (Define Restart Interval)
                readUint16(); // skip data length
                resetInterval = readUint16();
                break;
            case 0xFFDC: // Number of Lines marker
                readUint16(); // skip data length
                readUint16(); // Ignore this data since it represents the image height
                break;
            case 0xFFDA: { // SOS (Start of Scan)
                readUint16(); // skip data length
                var selectorsCount = data[offset++];
                var components = [];
                for (var i = 0; i < selectorsCount; i++) {
                    var component = frame.components[data[offset++]];
                    var tableSpec = data[offset++];
                    component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
                    component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
                    components.push(component);
                }
                var spectralStart = data[offset++];
                var spectralEnd = data[offset++];
                var successiveApproximation = data[offset++];
                var processed = decodeScan(data, offset, frame, components, resetInterval, spectralStart, spectralEnd, successiveApproximation >> 4, successiveApproximation & 15);
                offset += processed;
                break;
            }
            case 0xFFFF: // Fill bytes
                if (data[offset] !== 0xFF) { // Avoid skipping a valid marker.
                    offset--;
                }
                break;
            default: {
                if (data[offset - 3] == 0xFF && data[offset - 2] >= 0xC0 && data[offset - 2] <= 0xFE) {
                    // could be incorrect encoding -- last 0xFF byte of the previous
                    // block was eaten by the encoder
                    offset -= 3;
                    break;
                }
                else if (fileMarker === 0xE0 || fileMarker == 0xE1) {
                    // Recover from malformed APP1 markers popular in some phone models.
                    // See https://github.com/eugeneware/jpeg-js/issues/82
                    if (malformedDataOffset !== -1) {
                        throw new Error("first unknown JPEG marker at offset ".concat(malformedDataOffset.toString(16), ", second unknown JPEG marker ").concat(fileMarker.toString(16), " at offset ").concat((offset - 1).toString(16)));
                    }
                    malformedDataOffset = offset - 1;
                    var nextOffset = readUint16();
                    if (data[offset + nextOffset - 2] === 0xFF) {
                        offset += nextOffset - 2;
                        break;
                    }
                }
                throw new Error('unknown JPEG marker ' + fileMarker.toString(16));
            }
        }
        fileMarker = readUint16();
    }
    if (frames.length != 1)
        throw new Error('only single frame JPEGs supported');
    // set each frame's components quantization table
    for (var i = 0; i < frames.length; i++) {
        var cp = frames[i].components;
        for (var j in cp) { // TODO: don't use `in`
            cp[j].quantizationTable = quantizationTables[cp[j].quantizationIdx];
            delete cp[j].quantizationIdx; // TODO: why ???
        }
    }
    self.width = frame.samplesPerLine;
    self.height = frame.scanLines;
    self.jfif = jfif;
    self.adobe = adobe;
    self.components = [];
    for (var i = 0; i < frame.componentsOrder.length; i++) {
        var component = frame.components[frame.componentsOrder[i]];
        self.components.push({
            lines: buildComponentData(component),
            scaleX: component.h / frame.maxH,
            scaleY: component.v / frame.maxV
        });
    }
    return self;
}
function getData(decoded) {
    var offset = 0;
    var colorTransform = false;
    var width = decoded.width;
    var height = decoded.height;
    var dataLength = width * height * decoded.components.length;
    requestMemoryAllocation(dataLength);
    var data = new Uint8Array(dataLength);
    switch (decoded.components.length) {
        case 1: {
            var component1 = decoded.components[0];
            for (var y = 0; y < height; y++) {
                var component1Line = component1.lines[0 | (y * component1.scaleY)];
                for (var x = 0; x < width; x++) {
                    var Y = component1Line[0 | (x * component1.scaleX)];
                    data[offset++] = Y;
                }
            }
            break;
        }
        case 2: {
            // PDF might compress two component data in custom colorspace
            var component1 = decoded.components[0];
            var component2 = decoded.components[1];
            for (var y = 0; y < height; y++) {
                var component1Line = component1.lines[0 | (y * component1.scaleY)];
                var component2Line = component2.lines[0 | (y * component2.scaleY)];
                for (var x = 0; x < width; x++) {
                    var Y1 = component1Line[0 | (x * component1.scaleX)];
                    data[offset++] = Y1;
                    var Y2 = component2Line[0 | (x * component2.scaleX)];
                    data[offset++] = Y2;
                }
            }
            break;
        }
        case 3: {
            // The default transform for three components is true
            colorTransform = true;
            // The adobe transform marker overrides any previous setting
            if (decoded.adobe && decoded.adobe.transformCode)
                colorTransform = true;
            var component1 = decoded.components[0];
            var component2 = decoded.components[1];
            var component3 = decoded.components[2];
            for (var y = 0; y < height; y++) {
                var component1Line = component1.lines[0 | (y * component1.scaleY)];
                var component2Line = component2.lines[0 | (y * component2.scaleY)];
                var component3Line = component3.lines[0 | (y * component3.scaleY)];
                for (var x = 0; x < width; x++) {
                    var Y = void 0, Cb = void 0, Cr = void 0, R = void 0, G = void 0, B = void 0;
                    if (!colorTransform) {
                        R = component1Line[0 | (x * component1.scaleX)];
                        G = component2Line[0 | (x * component2.scaleX)];
                        B = component3Line[0 | (x * component3.scaleX)];
                    }
                    else {
                        Y = component1Line[0 | (x * component1.scaleX)];
                        Cb = component2Line[0 | (x * component2.scaleX)];
                        Cr = component3Line[0 | (x * component3.scaleX)];
                        R = clampTo8bit(Y + 1.402 * (Cr - 128));
                        G = clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
                        B = clampTo8bit(Y + 1.772 * (Cb - 128));
                    }
                    data[offset++] = R;
                    data[offset++] = G;
                    data[offset++] = B;
                }
            }
            break;
        }
        case 4: {
            if (!decoded.adobe)
                throw new Error('Unsupported color mode (4 components)');
            // The default transform for four components is false
            colorTransform = false;
            // The adobe transform marker overrides any previous setting
            if (decoded.adobe && decoded.adobe.transformCode)
                colorTransform = true;
            var component1 = decoded.components[0];
            var component2 = decoded.components[1];
            var component3 = decoded.components[2];
            var component4 = decoded.components[3];
            for (var y = 0; y < height; y++) {
                var component1Line = component1.lines[0 | (y * component1.scaleY)];
                var component2Line = component2.lines[0 | (y * component2.scaleY)];
                var component3Line = component3.lines[0 | (y * component3.scaleY)];
                var component4Line = component4.lines[0 | (y * component4.scaleY)];
                for (var x = 0; x < width; x++) {
                    var Y = void 0, Cb = void 0, Cr = void 0, K = void 0, C = void 0, M = void 0, Ye = void 0;
                    if (!colorTransform) {
                        C = component1Line[0 | (x * component1.scaleX)];
                        M = component2Line[0 | (x * component2.scaleX)];
                        Ye = component3Line[0 | (x * component3.scaleX)];
                        K = component4Line[0 | (x * component4.scaleX)];
                    }
                    else {
                        Y = component1Line[0 | (x * component1.scaleX)];
                        Cb = component2Line[0 | (x * component2.scaleX)];
                        Cr = component3Line[0 | (x * component3.scaleX)];
                        K = component4Line[0 | (x * component4.scaleX)];
                        C = 255 - clampTo8bit(Y + 1.402 * (Cr - 128));
                        M = 255 - clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
                        Ye = 255 - clampTo8bit(Y + 1.772 * (Cb - 128));
                    }
                    data[offset++] = 255 - C;
                    data[offset++] = 255 - M;
                    data[offset++] = 255 - Ye;
                    data[offset++] = 255 - K;
                }
            }
            break;
        }
        default:
            throw new Error('Unsupported color mode');
    }
    return data;
}
function decodeJpeg(encoded, createImageData) {
    totalBytesAllocated = 0;
    if (encoded.length === 0)
        throw new Error('Empty jpeg buffer');
    var decoded = parse(encoded);
    requestMemoryAllocation(decoded.width * decoded.height * 4);
    var data = getData(decoded);
    var imageData = createImageData(decoded.width, decoded.height);
    var width = imageData.width;
    var height = imageData.height;
    var imageDataArray = imageData.data;
    var i = 0;
    var j = 0;
    switch (decoded.components.length) {
        case 1:
            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    var Y = data[i++];
                    imageDataArray[j++] = Y;
                    imageDataArray[j++] = Y;
                    imageDataArray[j++] = Y;
                    imageDataArray[j++] = 255;
                }
            }
            break;
        case 3:
            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    var R = data[i++];
                    var G = data[i++];
                    var B = data[i++];
                    imageDataArray[j++] = R;
                    imageDataArray[j++] = G;
                    imageDataArray[j++] = B;
                    imageDataArray[j++] = 255;
                }
            }
            break;
        case 4:
            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    var C = data[i++];
                    var M = data[i++];
                    var Y = data[i++];
                    var K = data[i++];
                    var R = 255 - clampTo8bit(C * (1 - K / 255) + K);
                    var G = 255 - clampTo8bit(M * (1 - K / 255) + K);
                    var B = 255 - clampTo8bit(Y * (1 - K / 255) + K);
                    imageDataArray[j++] = R;
                    imageDataArray[j++] = G;
                    imageDataArray[j++] = B;
                    imageDataArray[j++] = 255;
                }
            }
            break;
        default:
            throw new Error('Unsupported color mode');
    }
    return imageData;
}
exports.decodeJpeg = decodeJpeg;
//# sourceMappingURL=jpeg.js.map