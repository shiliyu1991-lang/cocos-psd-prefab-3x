'use strict';

/**
 * cocos-psd-prefab-3x — dockable panel (3.8.x panel API).
 *
 * Pick a .psd, set output dir / prefab name / options, hit Convert. Talks to the
 * main process via Editor.Message.request('cocos-psd-prefab-3x', 'convert-psd'|…).
 * File picking uses Editor.Dialog.select (3.x) instead of a hidden <input file>.
 */

const PKG = 'cocos-psd-prefab-3x';

module.exports = Editor.Panel.define({
    template: `
<div class="pp">
    <header>PSD → 预制体 <small>(3.8.x)</small></header>
    <div class="hint" id="proj">project: …</div>

    <ui-prop>
        <ui-label slot="label" value="PSD 文件"></ui-label>
        <ui-input id="psdpath" slot="content" placeholder="点右侧“选择”…" readonly></ui-input>
    </ui-prop>
    <div class="minirow"><ui-button id="pickpsd">选择 PSD</ui-button></div>

    <ui-prop>
        <ui-label slot="label" value="输出目录"></ui-label>
        <ui-input id="psdout" slot="content" placeholder="PSD  →  assets/PSD/"></ui-input>
    </ui-prop>
    <ui-prop>
        <ui-label slot="label" value="预制体名"></ui-label>
        <ui-input id="psdname" slot="content" placeholder="留空则用 PSD 文件名"></ui-input>
    </ui-prop>

    <ui-prop><ui-checkbox id="psddedup" slot="label"></ui-checkbox><ui-label slot="content" value="MD5 去重复用相同图片"></ui-label></ui-prop>
    <ui-prop><ui-checkbox id="psdtrim" slot="label"></ui-checkbox><ui-label slot="content" value="裁剪图片四周透明边（尺寸/位置更准）"></ui-label></ui-prop>
    <ui-prop><ui-checkbox id="psdflatten" slot="label"></ui-checkbox><ui-label slot="content" value="压平只含1个子节点的空容器"></ui-label></ui-prop>
    <ui-prop><ui-checkbox id="psddecor" slot="label"></ui-checkbox><ui-label slot="content" value="合并重叠的装饰图（实验性）"></ui-label></ui-prop>
    <ui-prop><ui-checkbox id="psdvalidate" slot="label"></ui-checkbox><ui-label slot="content" value="检测缓存图片是否还在（被删过就重导）"></ui-label></ui-prop>

    <div class="row"><ui-button id="convertpsd" type="primary">转换为预制体</ui-button></div>
    <div class="hint" id="psdresult"></div>

    <footer>独立扩展 · 依赖已内置（无需 npm install）。规范见 docs/PSD命名规范.md</footer>
</div>`,
    style: `
:host { display: block; }
.pp { padding: 12px; font-size: 12px; display: flex; flex-direction: column; gap: 6px; }
.pp header { font-weight: bold; font-size: 14px; }
.pp header small { color: #888; font-weight: normal; }
.pp .row { display: flex; gap: 8px; margin-top: 4px; }
.pp .row ui-button { flex: 1; }
.pp .minirow { display: flex; justify-content: flex-end; margin-top: -2px; }
.pp .hint { color: #888; font-size: 11px; white-space: pre-wrap; word-break: break-all; line-height: 1.5; min-height: 14px; }
.pp .hint .ok { color: #3c3; } .pp .hint .bad { color: #d66; }
.pp footer { color: #777; margin-top: 6px; font-size: 11px; }
`,
    $: {
        proj: '#proj',
        psdpath: '#psdpath',
        pickpsd: '#pickpsd',
        psdout: '#psdout',
        psdname: '#psdname',
        psddedup: '#psddedup',
        psdtrim: '#psdtrim',
        psdflatten: '#psdflatten',
        psddecor: '#psddecor',
        psdvalidate: '#psdvalidate',
        convertpsd: '#convertpsd',
        psdresult: '#psdresult',
    },
    methods: {
        _setDisabled(el, on) {
            if (!el) return;
            if (on) el.setAttribute('disabled', ''); else el.removeAttribute('disabled');
        },
        _checked(el, def) {
            if (!el) return def;
            // ui-checkbox exposes .value (boolean); fall back to attribute.
            if (typeof el.value === 'boolean') return el.value;
            return el.hasAttribute('checked');
        },
        async _pickPsd() {
            try {
                const res = await Editor.Dialog.select({
                    title: '选择 PSD 文件', type: 'file',
                    filters: [{ name: 'Photoshop', extensions: ['psd', 'psb'] }],
                });
                const p = res && res.filePaths && res.filePaths[0];
                if (p) {
                    this._psdPath = p;
                    if (this.$.psdpath) this.$.psdpath.value = p;
                    if (this.$.psdresult) this.$.psdresult.innerText = '';
                }
            } catch (e) { /* user canceled */ }
        },
        async _convertPsd() {
            if (!this._psdPath) {
                if (this.$.psdresult) this.$.psdresult.innerHTML = '<span class="bad">请先选择 PSD 文件</span>';
                return;
            }
            const params = {
                psdPath: this._psdPath,
                outDir: ((this.$.psdout && this.$.psdout.value) || '').trim() || 'PSD',
                name: ((this.$.psdname && this.$.psdname.value) || '').trim() || undefined,
                dedup: this._checked(this.$.psddedup, true),
                trim: this._checked(this.$.psdtrim, true),
                flatten: this._checked(this.$.psdflatten, true),
                mergeDecor: this._checked(this.$.psddecor, false),
                validateCache: this._checked(this.$.psdvalidate, false),
            };
            try {
                if (this.$.psdresult) this.$.psdresult.innerText = '转换中…';
                this._setDisabled(this.$.convertpsd, true);
                const r = await Editor.Message.request(PKG, 'convert-psd', params);
                const p = (r && r.prefab) || {};
                const ignored = (r && r.ignored && r.ignored.length) || 0;
                if (this.$.psdresult) {
                    this.$.psdresult.innerHTML =
                        '<span class="ok">完成</span>  节点 ' + (r.nodes || 0) +
                        ' · 新图 ' + (r.written || 0) + ' · 复用 ' + (r.reused || 0) +
                        (r.trimmed ? ' · 裁剪 ' + r.trimmed : '') +
                        (r.flattened ? ' · 压平 ' + r.flattened : '') +
                        (r.mergedDecor ? ' · 合并 ' + r.mergedDecor : '') +
                        (r.revalidated ? ' · 重导 ' + r.revalidated : '') +
                        ' · 忽略 ' + ignored + '\n' + (p.path || '');
                }
            } catch (e) {
                if (this.$.psdresult) {
                    this.$.psdresult.innerHTML = '<span class="bad">失败</span>: ' +
                        String(e && e.message ? e.message : e);
                }
            } finally {
                this._setDisabled(this.$.convertpsd, false);
            }
        },
    },

    ready() {
        // Default the three "on" checkboxes.
        ['psddedup', 'psdtrim', 'psdflatten'].forEach((k) => {
            const el = this.$[k]; if (el) el.setAttribute('checked', '');
        });
        if (this.$.pickpsd) this.$.pickpsd.addEventListener('confirm', () => this._pickPsd());
        if (this.$.convertpsd) this.$.convertpsd.addEventListener('confirm', () => this._convertPsd());
        Editor.Message.request(PKG, 'project-path').then((d) => {
            if (this.$.proj) this.$.proj.innerText = 'project: ' + ((d && d.path) || '(unknown)');
        }).catch(() => {});
    },

    close() {},
});
