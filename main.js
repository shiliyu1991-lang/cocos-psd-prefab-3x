'use strict';

/**
 * cocos-psd-prefab-3x — standalone Cocos Creator 3.8.x editor extension.
 *
 * Adds menu  PSD 工具/PSD 转预制体  → opens a dockable panel that converts a
 * .psd into a 3.x prefab (PNG export + sprite-frame meta + MD5 dedup), writing
 * the result into the project's assets and refreshing the asset-db.
 *
 * 3.8.x plugin model (vs 2.4.x): menu/panel messages are wired to `methods`
 * here; the panel talks to this process via Editor.Message.request(pkg, msg,…)
 * and a method's return value (or resolved Promise) is the reply. The conversion
 * logic lives in ./lib/convert.js; ag-psd + pngjs are vendored under
 * ./node_modules so the extension runs without any npm install.
 */

const Path = require('path');

const PKG = 'cocos-psd-prefab-3x';

function _safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
function _err(e) {
    if (!e) return new Error('unknown error');
    return (e instanceof Error) ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e));
}
function _log() { try { console.log.apply(console, ['[' + PKG + ']'].concat([].slice.call(arguments))); } catch (e) { /* ignore */ } }

// Run a conversion and import the result. Returns the converter report.
async function convertPsd(params) {
    params = params || {};
    if (!params.psdPath) throw new Error('convert-psd needs psdPath');

    const projectRoot = _safe(() => Editor.Project.path, null);
    if (!projectRoot) throw new Error('cannot resolve Editor.Project.path');

    let core;
    try {
        core = require(Path.join(__dirname, 'lib', 'convert.js'));
    } catch (e) {
        throw new Error('failed to load converter deps (ag-psd / pngjs). They are '
            + 'normally vendored under ' + Path.join(__dirname, 'node_modules')
            + '. If missing, run `npm install` in ' + __dirname + '. '
            + (e && e.message ? e.message : String(e)));
    }

    const outDir = (params.outDir && String(params.outDir).trim()) || 'PSD';

    // Write PNGs (+ correct sprite-frame metas) and the prefab. The converter
    // authors each .png.meta with userData.type='sprite-frame' and imported:false,
    // so the editor actually builds the texture + sprite-frame sub-assets and the
    // prefab's <uuid>@f9941 references resolve. (See lib/convert.js makeImageMeta.)
    const report = await core.convert({
        psdPath: params.psdPath,
        projectRoot: projectRoot,
        outDir: outDir,
        prefabName: (params.name && String(params.name).trim()) || undefined,
        dedup: params.dedup !== false,
        trimTransparent: params.trim !== false,
        flattenWrappers: params.flatten !== false,
        mergeDecor: !!params.mergeDecor,
        validateCache: !!params.validateCache,
        keepHidden: !!params.keepHidden,
    });

    // Import textures first (so sprite-frames exist), then the prefab that refs them.
    try { await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/' + outDir + '/textures'); } catch (e) { /* ignore */ }
    try { await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/' + outDir); } catch (e) { /* ignore */ }

    _log('converted:', (report.prefab && report.prefab.path),
        'nodes=' + report.nodes, 'images=' + report.written,
        'reused=' + report.reused, 'ignored=' + report.ignored.length);
    return report;
}

module.exports = {
    load() { _log('loaded — menu: PSD 工具/PSD 转预制体'); },
    unload() {},

    methods: {
        // Menu entry -> open the dockable panel.
        openPanel() { Editor.Panel.open(PKG); },
        // Panel -> run a conversion. Returns the report (or throws -> rejected request).
        async convertPsd(params) {
            try { return await convertPsd(params || {}); }
            catch (e) { throw _err(e); }
        },
        // Expose project path so the panel can show it.
        projectPath() { return { path: _safe(() => Editor.Project.path, null) }; },
    },
};
