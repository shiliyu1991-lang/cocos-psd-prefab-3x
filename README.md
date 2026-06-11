**English** | [中文](README.zh-CN.md)

# cocos-psd-prefab-3x

A standalone **Cocos Creator 3.8.x** editor extension that converts a Photoshop
`.psd` into a prefab. A layer-naming convention drives node type / filtering /
9-slice; it exports PNGs + sprite-frame metas and de-duplicates identical images
by MD5.

> This is the 3.8.x port of [`cocos-psd-prefab-2x`](https://github.com/shiliyu1991-lang/cocos-psd-prefab-2x)
> (the Cocos 2.4.x version). The **conversion logic and naming convention are
> identical** (including the `Btn_` etc. prefixes); only the emitted asset format
> differs (see "2.x → 3.x differences" below).

## Install (editor extension)

Drop the whole `cocos-psd-prefab-3x/` folder into your project's `extensions/`
(or the global extensions dir) and restart Cocos Creator 3.8.x. A menu entry
**PSD 工具 / PSD 转预制体** (PSD Tools / PSD→Prefab) appears; open the panel:

1. **Pick PSD** → choose a `.psd` / `.psb`
2. Set the **output dir** (default `PSD` → written to `assets/PSD/`) and
   **prefab name** (blank = use the PSD file name)
3. Toggle options (dedup / trim transparent edges / flatten empty wrappers /
   merge decoration / validate cache)
4. **Convert** → results land in `assets/<out>/prefabs` and
   `assets/<out>/textures`, and the asset-db is refreshed automatically

Dependencies (`ag-psd` / `pngjs` / `pinyin-pro`) are vendored **and committed**
in `node_modules` — clone or download, drop into `extensions/`, and it just
works: **no npm install, no build step**.

## CLI (no editor needed)

```bash
node psd2prefab.js <input.psd> --project <cocosProjectRoot> [options]
#   --project <dir>   project root (contains assets/), required
#   --out <relDir>    subdir under assets/ (default: PSD)
#   --name <name>     prefab name (default: the psd file name)
#   --keep-hidden     also emit hidden layers (_active=false)
#   --no-dedup        disable MD5 image dedup
#   --dry-run         parse + report only, write nothing
```

## Test

```bash
npm test        # build a sample PSD → convert into ../testwork → run 18 structure/alignment/dedup assertions
```

## Naming convention

See `docs/PSD命名规范.md` (identical to 2.x). Highlights:

- Prefix decides the type: `btn_` button, `lbl_` label, `sp_` 9-slice,
  `node_` container, `lay_v_/lay_h_/lay_grid_` layout, `mask_` mask, etc.
- Leading `!` / `//`, or the `ref_` / `tmp_` prefix → the layer is ignored
- `#10` or `#10,20,10,20` → 9-slice borders; modifiers like `@2x` / `@nocrop` / `@unique`
- PSD text layers auto-become `cc.Label` (original text kept; node names are romanized via pinyin)

## 2.x → 3.x differences (output format only)

| | 2.4.x | 3.8.x (this) |
|---|---|---|
| Node transform | `_trs` TypedArray | `_lpos` / `_lrot` / `_lscale` / `_euler` |
| Size / anchor | `_contentSize` / `_anchorPoint` on the node | a separate **`cc.UITransform`** component |
| Opacity | node `_opacity` | a **`cc.UIOpacity`** component (only when < 255) |
| Color | node `_color` | on the renderable's `_color` (Sprite/Label) |
| Node layer | none | `_layer = 33554432` (UI_2D) |
| Prefab info | one `cc.PrefabInfo` per node | per-node `cc.PrefabInfo` + per-component `cc.CompPrefabInfo` |
| Image meta | `texture` + inline sprite-frame (ver 2.3.7) | `image` type, `userData.type = 'sprite-frame'`, `imported: false`; constant sub-assets `6c48a` (texture) / `f9941` (sprite-frame) |
| Sprite ref | `_spriteFrame.__uuid__` | `_spriteFrame.__uuid__ = imageUuid@f9941` |

> ⚠️ The image meta's `userData.type` **must** be `sprite-frame` (not `sprite`),
> with `imported: false`. Otherwise the editor builds no sprite-frame sub-asset
> and **all images go missing** after import.

## Layout

```
cocos-psd-prefab-3x/
  package.json      3.8.x extension manifest (contributions/menu/panels + methods)
  main.js           extension entry (methods + Editor.Message.request; asset-db refresh)
  panel/index.js    panel (Editor.Panel.define + ui-* widgets + Editor.Dialog.select)
  lib/convert.js    converter core (name parsing same as 2.x; 3.8.x prefab/meta emitters)
  psd2prefab.js     CLI
  docs/             PSD命名规范.md (naming spec, Chinese)
  test/             make_test_psd.js / verify.js
```
