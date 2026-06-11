'use strict';
/**
 * psd2prefab core — Cocos Creator 3.8.x PSD -> Prefab converter.
 *
 * Same layer-naming convention and parsing as the 2.x converter, but emits the
 * **Cocos Creator 3.8.x** asset format, which differs substantially from 2.4.x:
 *   - cc.Node uses _lpos / _lrot / _lscale / _euler / _layer (no _trs / _color /
 *     _contentSize / _opacity on the node itself).
 *   - size + anchor live on a separate cc.UITransform component on every node.
 *   - node opacity becomes a cc.UIOpacity component (only when < 255).
 *   - color lives on the renderable component (cc.Sprite / cc.Label _color).
 *   - every component carries a cc.CompPrefabInfo (via __prefab) and every node a
 *     cc.PrefabInfo (via _prefab); both hold a 22-char fileId.
 *   - images import as type "sprite": the .png.meta nests a texture sub-asset and
 *     a sprite-frame sub-asset; the prefab references  <imageUuid>@<spriteFrameId>.
 *
 * PSD TEXT layers still auto-become cc.Label; names are romanized to English
 * (pinyin) for node/image/prefab names while Label display text keeps the原文.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readPsd, initializeCanvas } = require('ag-psd');
const { PNG } = require('pngjs');

initializeCanvas(
    function createCanvas() { throw new Error('createCanvas not supported (headless psd2prefab)'); },
    function createImageData(width, height) {
        return { width: width, height: height, data: new Uint8ClampedArray(width * height * 4) };
    }
);

// Built-in 2D layer bit (UI_2D). 2.x had no per-node layer; 3.x requires it.
const LAYER_UI_2D = 33554432;

let _pinyin = null;
try { _pinyin = require('pinyin-pro').pinyin; } catch (e) { _pinyin = null; }
function romanizeName(s) {
    s = String(s == null ? '' : s);
    if (/^[\x00-\x7F]*$/.test(s)) return s;
    let r = '';
    for (const ch of s) {
        if (/[A-Za-z0-9]/.test(ch)) r += ch;
        else if (ch === '_' || ch === '-') r += ch;
        else if (/[一-龥]/.test(ch) && _pinyin) {
            const py = _pinyin(ch, { toneType: 'none', type: 'array' })[0] || '';
            r += py.charAt(0).toUpperCase() + py.slice(1);
        }
    }
    return r;
}
function englishName(base, kind) {
    let r = romanizeName(base).replace(/^[_\-]+|[_\-]+$/g, '');
    if (!r) {
        r = kind === 'label' ? 'Label' : kind === 'button' ? 'Button'
            : kind === 'layout' ? 'Layout'
            : (kind === 'sprite' || kind === 'sprite-sliced') ? 'Sprite' : 'Node';
    }
    return r;
}
function typePrefix(kind){
    if (kind==='sprite'||kind==='sprite-sliced') return 'Img_';
    if (kind==='label'||kind==='richtext') return 'Label_';
    if (kind==='button') return 'Btn_'; // btn_ 图层 -> 节点名加 Btn_ 前缀
    return 'Node_';
}
function clampSuffix(s){ // <=8 letters/digits; keep a trailing number for disambiguation
    s=String(s);
    const m=s.match(/(\d+)$/); const tail=m?m[1]:''; const head=tail?s.slice(0,s.length-tail.length):s;
    const budget=Math.max(0,8-tail.length);
    let out='', cnt=0;
    for(const ch of head){
        if(/[A-Za-z0-9]/.test(ch)){ if(cnt>=budget) break; cnt++; out+=ch; }
        else { if(cnt>=budget) break; out+=ch; }
    }
    return out.replace(/[_\-]+$/,'') + tail;
}
function prefixedName(base, kind){ const p=typePrefix(kind); base=String(base); if(base.indexOf(p)===0) base=base.slice(p.length); return p+clampSuffix(base); }

const TYPE_PREFIX = {
    lbl_: 'label', rt_: 'richtext', btn_: 'button', tog_: 'toggle',
    sp_: 'sprite-sliced', prog_: 'progress', node_: 'empty', mask_: 'mask',
    sv_: 'scrollview', edit_: 'editbox', lay_: 'layout',
};
const IGNORE_PREFIX = ['ref_', 'tmp_'];
const IGNORE_NAMES = new Set(['bg_guide']);

function parseName(rawName) {
    const r = { raw: rawName, ignore: false, ignoreReason: null, type: 'sprite',
        base: rawName, slice: null, mods: {}, ref: null, explicitType: false };
    let name = String(rawName == null ? '' : rawName).trim();
    if (name === '') { r.ignore = true; r.ignoreReason = 'empty-name'; return r; }
    if (name.startsWith('//')) { r.ignore = true; r.ignoreReason = 'comment'; return r; }
    if (name.startsWith('!')) { r.ignore = true; r.ignoreReason = 'bang-ignore'; return r; }
    for (const p of IGNORE_PREFIX) {
        if (name.toLowerCase().startsWith(p)) { r.ignore = true; r.ignoreReason = 'ignore-prefix:' + p; return r; }
    }
    if (IGNORE_NAMES.has(name.toLowerCase())) { r.ignore = true; r.ignoreReason = 'ignore-name'; return r; }
    if (name.toLowerCase().startsWith('keep_')) { r.mods.keepInactive = true; name = name.slice(5); }
    const tokens = name.split(/\s+/);
    const head = [];
    for (const tok of tokens) {
        if (tok.startsWith('#')) r.slice = parseSlice(tok.slice(1));
        else if (tok.startsWith('@')) parseMod(tok.slice(1), r.mods);
        else if (tok.includes('=')) r.ref = tok.split('=')[1] || null;
        else head.push(tok);
    }
    let core = head.join(' ');
    let matched = null;
    for (const pre of Object.keys(TYPE_PREFIX)) {
        if (core.toLowerCase().startsWith(pre)) { matched = pre; break; }
    }
    if (matched) {
        r.type = TYPE_PREFIX[matched];
        r.explicitType = true;
        r.base = core.slice(matched.length);
        if (matched === 'lay_') {
            const m = /^(h|v|grid)_/i.exec(r.base);
            if (m) { r.mods.layout = m[1].toLowerCase(); r.base = r.base.slice(m[0].length); }
            else r.mods.layout = 'h';
        }
    } else { r.base = core; }
    if (r.slice && r.type === 'sprite') r.type = 'sprite-sliced';
    if (!r.base) r.base = core || rawName;
    return r;
}
function parseSlice(s) {
    const n = s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));
    if (n.length === 1) return { top: n[0], right: n[0], bottom: n[0], left: n[0] };
    if (n.length === 2) return { top: n[0], right: n[1], bottom: n[0], left: n[1] };
    if (n.length >= 4) return { top: n[0], right: n[1], bottom: n[2], left: n[3] };
    return { top: 0, right: 0, bottom: 0, left: 0 };
}
function parseMod(m, mods) {
    const lower = m.toLowerCase();
    if (/^\d+x$/.test(lower)) { mods.scale = parseInt(lower, 10); return; }
    if (lower === 'nocrop') { mods.nocrop = true; return; }
    if (lower === 'flipx') { mods.flipX = true; return; }
    if (lower === 'flipy') { mods.flipY = true; return; }
    if (lower === 'gray') { mods.gray = true; return; }
    if (lower === 'unique') { mods.unique = true; return; }
    if (/^(90|180|270)$/.test(lower)) { mods.rotate = parseInt(lower, 10); return; }
    mods[lower] = true;
}

// ---- id / hash helpers ----
function uuid() {
    const b = crypto.randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.toString('hex');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
const FILEID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fileId() { let s = ''; const b = crypto.randomBytes(22); for (let i=0;i<22;i++) s += FILEID_CHARS[b[i]%64]; return s; }
// 3.x sub-asset id: 5 lowercase hex chars (e.g. "6c48a"). Stable within a run; the
// editor honours whatever id an already-imported .meta declares.
function subId() { return crypto.randomBytes(3).toString('hex').slice(0, 5); }

function alphaBBox(id){
    const W=id.width,H=id.height,data=id.data; let minX=W,minY=H,maxX=-1,maxY=-1;
    for(let y=0;y<H;y++){ const row=y*W; for(let x=0;x<W;x++){ if(data[(row+x)*4+3]>8){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; } } }
    if(maxX<0) return null;
    return { x:minX, y:minY, w:maxX-minX+1, h:maxY-minY+1 };
}
function hasAlphaPixels(id){
    const data=id.data; for(let i=3;i<data.length;i+=4){ if(data[i]<255) return true; } return false;
}
function layerToPng(layer, crop) {
    const id = layer.imageData;
    if (!id || !id.width || !id.height) return null;
    const c = crop || { x:0, y:0, w:id.width, h:id.height };
    const png = new PNG({ width: c.w, height: c.h });
    let anyAlpha = false;
    for(let y=0;y<c.h;y++){
        const srcStart=((y+c.y)*id.width + c.x)*4;
        png.data.set(id.data.subarray(srcStart, srcStart + c.w*4), (y*c.w)*4);
    }
    for(let i=3;i<png.data.length;i+=4){ if(png.data[i]<255){ anyAlpha=true; break; } }
    return { buf: PNG.sync.write(png), width: c.w, height: c.h, hasAlpha: anyAlpha };
}
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }

// ---- 3.8.x asset emitters ----
// 3.8.x image sub-asset ids are CONSTANT, not random: texture is always "6c48a",
// sprite-frame always "f9941". Use them so prefab refs (<uuid>@f9941) match what
// the editor builds. (Verified live against Cocos 3.8.8.)
const TEX_SUBID = '6c48a';
const SF_SUBID = 'f9941';
function makeImageMeta(imageUuid, name, w, h, slice, hasAlpha) {
    const b = slice || { top: 0, right: 0, bottom: 0, left: 0 };
    return {
        // imported:false is CRITICAL — it tells the editor to actually run the
        // importer and build the texture + sprite-frame library assets. With
        // imported:true the editor trusts the meta and builds nothing, leaving
        // every spriteFrame ref dangling (= "all images missing").
        ver: '1.0.27', importer: 'image', imported: false, uuid: imageUuid,
        files: ['.json', '.png'],
        subMetas: {
            [TEX_SUBID]: {
                importer: 'texture', uuid: imageUuid + '@' + TEX_SUBID, displayName: name,
                id: TEX_SUBID, name: 'texture', ver: '1.0.22', imported: false, files: ['.json'], subMetas: {},
                userData: {
                    wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge',
                    minfilter: 'linear', magfilter: 'linear', mipfilter: 'none',
                    premultiplyAlpha: false, anisotropy: 0,
                    isUuid: true, imageUuidOrDatabaseUri: imageUuid, visible: false,
                },
            },
            [SF_SUBID]: {
                importer: 'sprite-frame', uuid: imageUuid + '@' + SF_SUBID, displayName: name,
                id: SF_SUBID, name: 'spriteFrame', ver: '1.0.7', imported: false, files: ['.json'], subMetas: {},
                userData: {
                    trimType: 'auto', trimThreshold: 1, rotated: false,
                    offsetX: 0, offsetY: 0, trimX: 0, trimY: 0,
                    width: w, height: h, rawWidth: w, rawHeight: h,
                    borderTop: b.top, borderBottom: b.bottom, borderLeft: b.left, borderRight: b.right,
                    packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
                    isUuid: true, imageUuidOrDatabaseUri: imageUuid, atlasUuid: '',
                },
            },
        },
        // The Type dropdown value MUST be 'sprite-frame' (not 'sprite' — that is
        // not a valid image type and silently builds no sub-assets).
        userData: { type: 'sprite-frame', hasAlpha: !!hasAlpha, fixAlphaTransparencyArtifacts: false },
    };
}
function makePrefabMeta(prefabUuid, syncName) {
    return { ver: '1.1.50', importer: 'prefab', imported: true, uuid: prefabUuid,
        files: ['.json'], subMetas: {}, userData: { syncNodeName: syncName } };
}

function nodeObj(name, parentId, childIds, compIds, prefabId, active, lpos) {
    return { __type__: 'cc.Node', _name: name, _objFlags: 0,
        _parent: parentId == null ? null : { __id__: parentId },
        _children: childIds.map((id) => ({ __id__: id })), _active: active !== false,
        _components: compIds.map((id) => ({ __id__: id })), _prefab: { __id__: prefabId },
        _lpos: { __type__: 'cc.Vec3', x: lpos.x, y: lpos.y, z: 0 },
        _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
        _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
        _layer: LAYER_UI_2D,
        _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
        _id: '' };
}
function uiTransformObj(nodeId, prefabId, w, h) {
    return { __type__: 'cc.UITransform', _name: '', _objFlags: 0, __editorExtras__: {},
        node: { __id__: nodeId }, _enabled: true, __prefab: { __id__: prefabId },
        _contentSize: { __type__: 'cc.Size', width: w, height: h },
        _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 }, _id: '' };
}
function uiOpacityObj(nodeId, prefabId, opacity) {
    return { __type__: 'cc.UIOpacity', _name: '', _objFlags: 0, __editorExtras__: {},
        node: { __id__: nodeId }, _enabled: true, __prefab: { __id__: prefabId },
        _opacity: opacity, _id: '' };
}
function spriteObj(nodeId, prefabId, spriteFrameUuid, color, sliced) {
    return { __type__: 'cc.Sprite', _name: '', _objFlags: 0, __editorExtras__: {},
        node: { __id__: nodeId }, _enabled: true, __prefab: { __id__: prefabId },
        _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
        _color: { __type__: 'cc.Color', r: color.r, g: color.g, b: color.b, a: 255 },
        _spriteFrame: spriteFrameUuid ? { __uuid__: spriteFrameUuid, __expectedType__: 'cc.SpriteFrame' } : null,
        _type: sliced ? 1 : 0, _fillType: 0, _sizeMode: sliced ? 0 : 1,
        _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 }, _fillStart: 0, _fillRange: 0,
        _isTrimmedMode: true, _useGrayscale: false, _atlas: null, _id: '' };
}
function labelObj(nodeId, prefabId, str, fontSize, color) {
    const fs2 = fontSize || 24;
    return { __type__: 'cc.Label', _name: '', _objFlags: 0, __editorExtras__: {},
        node: { __id__: nodeId }, _enabled: true, __prefab: { __id__: prefabId },
        _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
        _color: { __type__: 'cc.Color', r: color.r, g: color.g, b: color.b, a: 255 },
        _string: str, _horizontalAlign: 1, _verticalAlign: 1,
        _actualFontSize: fs2, _fontSize: fs2, _fontFamily: 'Arial',
        _lineHeight: Math.round(fs2 * 1.25), _overflow: 0, _enableWrapText: false,
        _font: null, _isSystemFontUsed: true, _spacingX: 0, _isItalic: false, _isBold: false,
        _isUnderline: false, _underlineHeight: 2, _cacheMode: 0,
        _enableOutline: false, _outlineColor: { __type__: 'cc.Color', r: 0, g: 0, b: 0, a: 255 }, _outlineWidth: 2,
        _enableShadow: false, _shadowColor: { __type__: 'cc.Color', r: 0, g: 0, b: 0, a: 255 },
        _shadowOffset: { __type__: 'cc.Vec2', x: 2, y: 2 }, _shadowBlur: 2, _id: '' };
}
function buttonObj(nodeId, prefabId, targetNodeId) {
    return { __type__: 'cc.Button', _name: '', _objFlags: 0, __editorExtras__: {},
        node: { __id__: nodeId }, _enabled: true, __prefab: { __id__: prefabId },
        clickEvents: [], _interactable: true, _transition: 3,
        _normalColor: { __type__: 'cc.Color', r: 214, g: 214, b: 214, a: 255 },
        _hoverColor: { __type__: 'cc.Color', r: 211, g: 211, b: 211, a: 255 },
        _pressedColor: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
        _disabledColor: { __type__: 'cc.Color', r: 124, g: 124, b: 124, a: 255 },
        _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null,
        _duration: 0.1, _zoomScale: 1.2,
        _target: { __id__: targetNodeId == null ? nodeId : targetNodeId }, _id: '' };
}
function layoutObj(nodeId, prefabId, dir) {
    const type = dir === 'v' ? 2 : dir === 'grid' ? 3 : 1;
    return { __type__: 'cc.Layout', _name: '', _objFlags: 0, __editorExtras__: {},
        node: { __id__: nodeId }, _enabled: true, __prefab: { __id__: prefabId },
        _resizeMode: 0, _layoutType: type,
        _cellSize: { __type__: 'cc.Size', width: 40, height: 40 }, _startAxis: 0,
        _paddingLeft: 0, _paddingRight: 0, _paddingTop: 0, _paddingBottom: 0,
        _spacingX: 0, _spacingY: 0, _verticalDirection: 1, _horizontalDirection: 0,
        _constraint: 0, _constraintNum: 2, _affectedByScale: false, _isAlign: false, _id: '' };
}
function maskObj(nodeId, prefabId) {
    return { __type__: 'cc.Mask', _name: '', _objFlags: 0, __editorExtras__: {},
        node: { __id__: nodeId }, _enabled: true, __prefab: { __id__: prefabId },
        _type: 0, _inverted: false, _segments: 64, _alphaThreshold: 0.1, _id: '' };
}
function compPrefabInfoObj(fid) { return { __type__: 'cc.CompPrefabInfo', fileId: fid }; }
function prefabInfoObj(rootId, fid) {
    return { __type__: 'cc.PrefabInfo', root: { __id__: rootId }, asset: { __id__: 0 },
        fileId: fid, instance: null, targetOverrides: null, nestedPrefabInstanceRoots: null };
}

// ---- model build (shared structure with 2.x) ----
function _ctr(px){ return { x:(px.left+px.right)/2, y:(px.top+px.bottom)/2 }; }
function _area(n){ return (n.px.right-n.px.left)*(n.px.bottom-n.px.top); }
function flattenWrappers(node, report){
    if(!node.children) return;
    node.children = node.children.map(function(c){
        var cur=c, nm=c.name, did=false;
        while(cur.kind==='empty' && cur.children && cur.children.length===1 && cur.opacity===255 && cur.active!==false){ cur=cur.children[0]; did=true; }
        if(did){ cur.name=nm; report.flattened=(report.flattened||0)+1; }
        return cur;
    });
    node.children.forEach(function(c){ flattenWrappers(c, report); });
}
function mergeDecor(node, report){
    if(!node.children) return;
    var keep=[];
    for(var j=0;j<node.children.length;j++){
        var c=node.children[j], dropped=false;
        if(c.kind==='sprite'||c.kind==='sprite-sliced'){
            var cc=_ctr(c.px);
            for(var i=0;i<keep.length;i++){
                var k=keep[i]; if(k.kind!=='sprite'&&k.kind!=='sprite-sliced') continue;
                var kc=_ctr(k.px);
                var near=Math.abs(cc.x-kc.x)<=8 && Math.abs(cc.y-kc.y)<=8;
                var ratio=Math.min(_area(c),_area(k))/Math.max(_area(c),_area(k),1);
                if(near && ratio>=0.7){ if(_area(c)>_area(k)) keep[i]=c; dropped=true; report.mergedDecor=(report.mergedDecor||0)+1; break; }
            }
        }
        if(!dropped) keep.push(c);
    }
    node.children=keep;
    node.children.forEach(function(c){ mergeDecor(c, report); });
}
function uniquifySiblings(node){
    if(!node.children) return;
    var seen={};
    for(var i=0;i<node.children.length;i++){
        var c=node.children[i], nm=c.name, base=nm, k=2;
        while(seen[nm]) nm=base+'_'+(k++);
        seen[nm]=true; c.name=nm; uniquifySiblings(c);
    }
}
function mapGroupKind(type) {
    if (type === 'button') return 'button';
    if (type === 'layout') return 'layout';
    if (type === 'scrollview') return 'scrollview';
    if (type === 'mask') return 'mask';
    return 'empty';
}
function buildModel(psd, opts, report) {
    const W = psd.width, H = psd.height;
    function walk(layer, depth) {
        const info = parseName(layer.name);
        if (info.ignore) { report.ignored.push({ name: layer.name, reason: info.ignoreReason }); return null; }
        const hidden = layer.hidden === true || (layer.opacity === 0);
        if (hidden && !info.mods.keepInactive && !opts.keepHidden) { report.ignored.push({ name: layer.name, reason: 'hidden' }); return null; }
        const isGroup = Array.isArray(layer.children);
        if (isGroup) {
            const kids = [];
            for (const c of layer.children) { const k = walk(c, depth + 1); if (k) kids.push(k); }
            if (kids.length === 0) { report.ignored.push({ name: layer.name, reason: 'empty-group' }); return null; }
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const k of kids) { minX = Math.min(minX, k.px.left); minY = Math.min(minY, k.px.top); maxX = Math.max(maxX, k.px.right); maxY = Math.max(maxY, k.px.bottom); }
            const gk = info.type === 'empty' ? 'empty' : mapGroupKind(info.type);
            return { kind: gk, info,
                name: prefixedName((opts.englishNames !== false) ? englishName(info.base || layer.name, gk) : (info.base || layer.name), gk),
                px: { left: minX, top: minY, right: maxX, bottom: maxY }, width: maxX - minX, height: maxY - minY,
                opacity: Math.round((layer.opacity == null ? 1 : layer.opacity) * 255), color: { r: 255, g: 255, b: 255 }, active: !hidden, children: kids };
        }
        // ---- leaf ----
        const ts = (layer.text && typeof layer.text.text === 'string') ? layer.text : null;
        const isText = !!ts;
        let kind = info.type;
        if (isText && !info.explicitType) kind = 'label';

        let left = layer.left || 0, top = layer.top || 0;
        let right = (layer.right != null) ? layer.right : left;
        let bottom = (layer.bottom != null) ? layer.bottom : top;
        let w = right - left, h = bottom - top;

        let fontSize = null, textColor = null;
        if (isText) {
            const style = ts.style || {};
            fontSize = Math.round(style.fontSize || 0) || null;
            const fc = style.fillColor;
            if (fc && typeof fc.r === 'number') textColor = { r: Math.round(fc.r), g: Math.round(fc.g), b: Math.round(fc.b) };
            if (w <= 0 || h <= 0) {
                const fz = fontSize || 24;
                const len = (ts.text || '').replace(/\s/g, '').length || 1;
                h = Math.round(fz * 1.3); w = Math.max(fz, Math.round(len * fz));
                const tr = ts.transform || [];
                const tx = (typeof tr[4] === 'number') ? tr[4] : left;
                const ty = (typeof tr[5] === 'number') ? tr[5] : top;
                left = Math.round(tx - w / 2); top = Math.round(ty - fz);
                right = left + w; bottom = top + h;
            }
        }
        let crop = null;
        if (opts.trimTransparent !== false && !isText && layer.imageData && kind !== 'sprite-sliced' && !info.mods.nocrop) {
            const bb = alphaBBox(layer.imageData);
            if (!bb) { report.ignored.push({ name: layer.name, reason: 'fully-transparent' }); return null; }
            if (bb.w < (right - left) || bb.h < (bottom - top)) {
                left = left + bb.x; top = top + bb.y; right = left + bb.w; bottom = top + bb.h;
                w = bb.w; h = bb.h; crop = bb; report.trimmed++;
            }
        }
        if (w <= 0 || h <= 0) { report.ignored.push({ name: layer.name, reason: 'empty-bounds' }); return null; }
        return { kind: kind, info, crop: crop,
            name: prefixedName((opts.englishNames !== false) ? englishName(info.base || layer.name, kind) : (info.base || layer.name), kind),
            rawBase: isText ? ts.text : (info.base || layer.name), fontSize: fontSize,
            px: { left, top, right, bottom }, width: w, height: h,
            opacity: Math.round((layer.opacity == null ? 1 : layer.opacity) * 255),
            color: textColor || { r: 255, g: 255, b: 255 }, active: !hidden, layer, children: [] };
    }
    const roots = [];
    for (const c of (psd.children || [])) { const k = walk(c, 0); if (k) roots.push(k); }
    return { W, H, roots };
}

async function convert(opts) {
    const psdPath = opts.psdPath, projectRoot = opts.projectRoot;
    const outDir = opts.outDir || 'PSD';
    const prefabName = opts.prefabName || path.basename(psdPath).replace(/\.psd$/i, '');
    const dedup = opts.dedup !== false, dryRun = !!opts.dryRun;
    const validateCache = !!opts.validateCache;
    const outName = (opts.englishNames !== false) ? englishName(prefabName, 'empty') : prefabName;
    // writeImageMeta=false (editor flow): DON'T author .png.meta. In 3.8.x the
    // editor owns sprite-frame sub-asset uuids; a hand-written meta with
    // "imported":true makes the editor trust it and end up with EMPTY subMetas
    // (no spriteFrame), so prefab refs dangle and images go missing. Instead we
    // emit placeholder uuids + an imageMap{placeholder->png}; the caller imports
    // the PNGs, queries the real spriteFrame uuids, and patches the prefab.
    const writeImageMeta = opts.writeImageMeta !== false;
    const report = { ignored: [], images: [], reused: 0, revalidated: 0, trimmed: 0, flattened: 0, mergedDecor: 0, written: 0, nodes: 0, labels: 0, imageMap: {}, prefab: null };
    const buf = fs.readFileSync(psdPath);
    const psd = readPsd(buf, { useImageData: true, skipThumbnail: true, skipLinkedFilesData: true });
    const model = buildModel(psd, opts, report);
    const assetsRoot = path.join(projectRoot, 'assets');
    const texDirRel = path.posix.join(outDir, 'textures');
    const prefabDirRel = path.posix.join(outDir, 'prefabs');
    const texDirAbs = path.join(assetsRoot, outDir, 'textures');
    const prefabDirAbs = path.join(assetsRoot, outDir, 'prefabs');
    const tablePath = path.join(assetsRoot, outDir, '.psd_assets.json');
    if (!dryRun) { fs.mkdirSync(texDirAbs, { recursive: true }); fs.mkdirSync(prefabDirAbs, { recursive: true }); }
    let table = {};
    if (dedup && fs.existsSync(tablePath)) { try { table = JSON.parse(fs.readFileSync(tablePath, 'utf8')); } catch (e) { table = {}; } }
    const usedNames = new Set();
    function uniqueFileName(base) { const n = sanitize(base) || 'img'; let cand = n, i = 1; while (usedNames.has(cand)) cand = n + '_' + (i++); usedNames.add(cand); return cand; }

    // Resolve a leaf image to its 3.x sprite-frame uuid (<imageUuid>@<spriteFrameId>),
    // writing png + png.meta and recording the MD5 in the dedup table.
    function resolveImage(node) {
        const png = layerToPng(node.layer, node.crop); if (!png) return null;
        const hash = md5(png.buf); const sliced = node.kind === 'sprite-sliced' ? node.info.slice : null;
        if (dedup && !node.info.mods.unique && table[hash]) {
            const ent = table[hash];
            let cacheOk = true;
            if (validateCache) {
                const pngAbs = path.join(assetsRoot, ent.png);
                cacheOk = fs.existsSync(pngAbs) && (!writeImageMeta || fs.existsSync(pngAbs + '.meta'));
            }
            if (cacheOk && ent.spriteFrameUuid) { report.reused++; report.imageMap[ent.spriteFrameUuid] = ent.png; return { spriteFrameUuid: ent.spriteFrameUuid, w: png.width, h: png.height }; }
            report.revalidated++; delete table[hash];
        }
        const fname = uniqueFileName(node.name);
        const imageUuid = uuid();
        const spriteFrameUuid = imageUuid + '@' + SF_SUBID; // constant sprite-frame sub-id
        const pngRel = path.posix.join(texDirRel, fname + '.png');
        if (!dryRun) {
            fs.writeFileSync(path.join(texDirAbs, fname + '.png'), png.buf);
            if (writeImageMeta) {
                fs.writeFileSync(path.join(texDirAbs, fname + '.png.meta'),
                    JSON.stringify(makeImageMeta(imageUuid, fname, png.width, png.height, sliced, png.hasAlpha), null, 2));
            }
        }
        report.images.push({ name: fname, hash, w: png.width, h: png.height }); report.written++;
        report.imageMap[spriteFrameUuid] = pngRel;
        if (dedup && !node.info.mods.unique) table[hash] = { png: pngRel, imageUuid, spriteFrameUuid, w: png.width, h: png.height };
        return { spriteFrameUuid, w: png.width, h: png.height };
    }
    function resolveByRef(node) {
        for (const k of Object.keys(table)) { if (table[k].png.endsWith('/' + node.info.ref + '.png')) return { spriteFrameUuid: table[k].spriteFrameUuid, w: table[k].w, h: table[k].h }; }
        return null;
    }

    const out = [];
    out.push({ __type__: 'cc.Prefab', _name: outName, _objFlags: 0, _native: '', data: { __id__: 1 },
        optimizationPolicy: 0, asyncLoadAssets: false, persistent: false });

    const compFixups = []; // component array-ids needing a CompPrefabInfo
    const nodeFixups = []; // node array-ids needing a PrefabInfo
    function cocosCenter(px) { return { x: (px.left + px.right) / 2 - model.W / 2, y: model.H / 2 - (px.top + px.bottom) / 2 }; }

    function emit(node, parentId, parentAbs) {
        const abs = cocosCenter(node.px);
        const lpos = { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y };
        const nodeId = out.length; out.push(null);
        const compIds = [], childIds = [];
        const scale = node.info.mods.scale || 1;
        let w = node.width, h = node.height;
        if (scale > 1) { w = Math.round(w / scale); h = Math.round(h / scale); }

        // UITransform (size + anchor) on every node.
        const utId = out.length; out.push(uiTransformObj(nodeId, -1, w, h)); compIds.push(utId); compFixups.push(utId);

        if (node.kind === 'sprite' || node.kind === 'sprite-sliced') {
            const img = node.info.ref ? resolveByRef(node) : resolveImage(node);
            const cid = out.length; out.push(spriteObj(nodeId, -1, img ? img.spriteFrameUuid : null, node.color, node.kind === 'sprite-sliced')); compIds.push(cid); compFixups.push(cid);
        } else if (node.kind === 'label') {
            const str = (node.layer && node.layer.text && node.layer.text.text) || node.rawBase || node.name;
            const cid = out.length; out.push(labelObj(nodeId, -1, str, node.fontSize || guessFontSize(node), node.color)); compIds.push(cid); compFixups.push(cid); report.labels++;
        } else if (node.kind === 'button') {
            const cid = out.length; out.push(buttonObj(nodeId, -1, nodeId)); compIds.push(cid); compFixups.push(cid);
        } else if (node.kind === 'layout') {
            const cid = out.length; out.push(layoutObj(nodeId, -1, node.info.mods.layout || 'h')); compIds.push(cid); compFixups.push(cid);
        } else if (node.kind === 'mask') {
            const cid = out.length; out.push(maskObj(nodeId, -1)); compIds.push(cid); compFixups.push(cid);
        }
        // Node opacity -> cc.UIOpacity (only when partially transparent).
        if (node.opacity != null && node.opacity < 255) {
            const cid = out.length; out.push(uiOpacityObj(nodeId, -1, node.opacity)); compIds.push(cid); compFixups.push(cid);
        }

        for (const child of (node.children || [])) { const id = emit(child, nodeId, abs); childIds.push(id); }
        out[nodeId] = nodeObj(node.name, parentId, childIds, compIds, -1, node.active, lpos);
        nodeFixups.push(nodeId);
        report.nodes++; return nodeId;
    }

    const rootNode = { kind: 'empty', info: parseName(prefabName), name: outName,
        px: { left: 0, top: 0, right: model.W, bottom: model.H }, width: model.W, height: model.H,
        opacity: 255, color: { r: 255, g: 255, b: 255 }, active: true, children: model.roots };
    if (opts.flattenWrappers !== false) flattenWrappers(rootNode, report);
    if (opts.mergeDecor) mergeDecor(rootNode, report);
    uniquifySiblings(rootNode);
    const rootId = emit(rootNode, null, { x: 0, y: 0 });

    // Append CompPrefabInfo per component and wire each component's __prefab.
    for (const cid of compFixups) { const piId = out.length; out.push(compPrefabInfoObj(fileId())); out[cid].__prefab = { __id__: piId }; }
    // Append PrefabInfo per node and wire each node's _prefab.
    for (const nid of nodeFixups) { const piId = out.length; out.push(prefabInfoObj(rootId, fileId())); out[nid]._prefab = { __id__: piId }; }

    const prefabJson = JSON.stringify(out, null, 2); const prefabUuid = uuid();
    const prefabRel = path.posix.join(prefabDirRel, outName + '.prefab');
    if (!dryRun) {
        fs.writeFileSync(path.join(prefabDirAbs, outName + '.prefab'), prefabJson);
        fs.writeFileSync(path.join(prefabDirAbs, outName + '.prefab.meta'), JSON.stringify(makePrefabMeta(prefabUuid, outName), null, 2));
        if (dedup) fs.writeFileSync(tablePath, JSON.stringify(table, null, 2));
    }
    report.prefab = { name: outName, uuid: prefabUuid, path: 'db://assets/' + prefabRel,
        fileAbs: path.join(prefabDirAbs, outName + '.prefab'), objectCount: out.length };
    return report;
}
function guessFontSize(node) { const h = node.height; if (h >= 8 && h <= 200) return Math.max(12, Math.round(h * 0.8)); return 24; }
function sanitize(s) { return String(s).replace(/[^\w一-龥\-]+/g, '_').replace(/^_+|_+$/g, ''); }
module.exports = { convert, parseName, buildModel };
