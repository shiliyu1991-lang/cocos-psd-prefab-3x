'use strict';
// Generates a test .psd exercising the naming convention. Dev/test helper only.
const fs = require('fs');
const path = require('path');
const { writePsd } = require('ag-psd');

function rect(w, h, [r, g, b, a]) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
    }
    return { width: w, height: h, data };
}
// a leaf layer placed at (left,top) with given size+color
function leaf(name, left, top, w, h, color, extra) {
    return Object.assign({ name, left, top, right: left + w, bottom: top + h,
        imageData: rect(w, h, color) }, extra || {});
}

const W = 960, H = 640;

// identical pixels -> identical MD5 (dedup test)
const STAR = [255, 200, 0, 255];

const psd = {
    width: W, height: H,
    children: [
        // ignored helpers
        leaf('// 设计参考线', 0, 0, 10, 640, [0, 255, 0, 128]),
        leaf('ref_对齐底图', 0, 0, 960, 640, [50, 50, 50, 80]),
        leaf('tmp_废弃层', 100, 100, 50, 50, [0, 0, 0, 255]),
        // hidden -> skipped
        leaf('icon_隐藏', 10, 10, 40, 40, [255, 0, 0, 255], { hidden: true }),
        // empty bounds -> skipped
        { name: 'node_空层', left: 0, top: 0, right: 0, bottom: 0 },

        // a popup group
        {
            name: '弹窗', opened: true, children: [
                leaf('sp_背景 #40', 240, 120, 480, 400, [30, 40, 70, 255]),
                leaf('lbl_标题', 380, 150, 200, 40, [255, 255, 255, 255]),
                // button group with state children + label
                {
                    name: 'btn_确定', opened: true, children: [
                        leaf('normal', 410, 420, 140, 56, [60, 160, 90, 255]),
                        leaf('pressed', 410, 420, 140, 56, [40, 120, 70, 255]),
                        leaf('lbl_文字', 450, 435, 60, 26, [255, 255, 255, 255]),
                    ],
                },
                // vertical layout list with two identical-image items (dedup)
                {
                    name: 'lay_v_列表', opened: true, children: [
                        leaf('icon_star', 300, 230, 48, 48, STAR),
                        leaf('icon_star2', 300, 290, 48, 48, STAR),
                    ],
                },
                // 2x hi-res decoration
                leaf('icon_装饰 @2x', 640, 140, 64, 64, [200, 60, 200, 255]),
            ],
        },
    ],
};

const out = path.join(__dirname, 'sample.psd');
const ab = writePsd(psd, { generateThumbnail: false });
fs.writeFileSync(out, Buffer.from(ab));
console.log('wrote', out, Buffer.from(ab).length, 'bytes');
