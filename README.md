# cocos-psd-prefab-3x

把 Photoshop `.psd` 转成 **Cocos Creator 3.8.x** 预制体的独立编辑器扩展。
图层命名规范驱动节点类型 / 过滤 / 九宫格；导出 PNG + sprite-frame meta，按 MD5 去重复用相同图片。

> 这是 [`cocos-psd-prefab-2x`](https://github.com/shiliyu1991-lang/cocos-psd-prefab-2x)（Cocos 2.4.x 版）的 3.8.x 移植版。**转换逻辑、命名规范完全一致**（含 `Btn_` 等前缀），差别只在输出的资源格式（见下方「2.x → 3.x 的差异」）。

## 安装（编辑器扩展）

把整个 `cocos-psd-prefab-3x/` 放到工程的 `extensions/` 下（或全局扩展目录），重启 Cocos Creator 3.8.x。
菜单出现 **PSD 工具 / PSD 转预制体**，点开面板：

1. **选择 PSD** → 选一个 `.psd`/`.psb`
2. 填**输出目录**（默认 `PSD` → 写到 `assets/PSD/`）、**预制体名**（留空用文件名）
3. 勾选项（去重 / 裁剪透明边 / 压平空容器 / 合并装饰 / 校验缓存）
4. **转换为预制体** → 结果写入 `assets/<out>/prefabs` 与 `assets/<out>/textures`，并自动刷新资源库

依赖（`ag-psd` / `pngjs` / `pinyin-pro`）已内置在 `node_modules`（**无需 npm install**）。
> 本目录的 `node_modules` 是指向 `../cocos-psd-prefab-2x/node_modules` 的目录联接（junction），与 2x 共享同一份依赖。独立分发时把它换成真实拷贝即可。

## 命令行（无需编辑器）

```bash
node psd2prefab.js <input.psd> --project <cocos工程根目录> [选项]
#   --project <dir>   工程根（含 assets/），必填
#   --out <relDir>    assets/ 下的子目录（默认 PSD）
#   --name <name>     预制体名（默认取 psd 文件名）
#   --keep-hidden     隐藏图层也导出（_active=false）
#   --no-dedup        关闭 MD5 图片去重
#   --dry-run         只解析+报告，不写文件
```

## 测试

```bash
npm test        # 生成样例 PSD → 转换到 ../testwork → 跑 18 项结构/对齐/去重断言
```

## 命名规范

见 `docs/PSD命名规范.md`（与 2.x 完全一致）。要点：
- 前缀决定类型：`btn_` 按钮、`lbl_` 文本、`sp_` 九宫格、`node_` 容器、`lay_v_/lay_h_/lay_grid_` 布局、`mask_` 遮罩 等
- `!` / `//` 开头、`ref_` / `tmp_` 前缀 → 忽略该图层
- `#10` 或 `#10,20,10,20` → 九宫格边距；`@2x`/`@nocrop`/`@unique` 等修饰
- PSD 文本图层自动转 `cc.Label`（保留原文内容；节点名走拼音英文化）

## 2.x → 3.x 的差异（仅输出格式）

| | 2.4.x | 3.8.x（本版） |
|---|---|---|
| 节点变换 | `_trs` TypedArray | `_lpos`/`_lrot`/`_lscale`/`_euler` |
| 尺寸/锚点 | 节点上的 `_contentSize`/`_anchorPoint` | 独立的 **`cc.UITransform`** 组件 |
| 不透明度 | 节点 `_opacity` | **`cc.UIOpacity`** 组件（<255 时才加） |
| 颜色 | 节点 `_color` | 渲染组件的 `_color`（Sprite/Label） |
| 节点层 | 无 | `_layer = 33554432`（UI_2D） |
| 预制信息 | 每节点一个 `cc.PrefabInfo` | 每节点 `cc.PrefabInfo` + 每组件 `cc.CompPrefabInfo` |
| 图片 meta | `texture` + 内嵌 sprite-frame（ver 2.3.7） | `image` 类型，内嵌 `texture` + `sprite-frame` 子资源；prefab 引用 `<uuid>@<spriteFrameId>` |
| Sprite 引用 | `_spriteFrame.__uuid__` | `_spriteFrame.__uuid__ = imageUuid@subId` |

## 结构

```
cocos-psd-prefab-3x/
  package.json      3.8.x 扩展清单（contributions/menu/panels + methods）
  main.js           扩展入口（methods + Editor.Message.request；asset-db 刷新）
  panel/index.js    面板（Editor.Panel.define + ui-* 组件 + Editor.Dialog.select）
  lib/convert.js    转换核心（命名解析同 2.x；3.8.x prefab/meta 发射器）
  psd2prefab.js     CLI
  docs/             PSD命名规范.md
  test/             make_test_psd.js / verify.js
```
