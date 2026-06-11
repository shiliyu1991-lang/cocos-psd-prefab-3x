'use strict';
// cocos-psd-prefab-3x CLI. Convert a .psd into a Cocos Creator 3.8.x prefab without the editor.
//
//   node psd2prefab.js <input.psd> --project <cocosProjectRoot> [options]
//
// Options:
//   --project <dir>   Cocos project root (contains assets/). Required.
//   --out <relDir>    Asset subdir under assets/ (default: PSD)
//   --name <name>     Prefab name (default: psd file base name)
//   --keep-hidden     Emit hidden layers as nodes with _active=false
//   --no-dedup        Disable MD5 image dedup
//   --dry-run         Parse + report, write nothing
const core = require('./lib/convert');

function parseArgs(argv) {
    const a = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i];
        if (t === '--project') a.project = argv[++i];
        else if (t === '--out') a.out = argv[++i];
        else if (t === '--name') a.name = argv[++i];
        else if (t === '--keep-hidden') a.keepHidden = true;
        else if (t === '--no-dedup') a.dedup = false;
        else if (t === '--dry-run') a.dryRun = true;
        else a._.push(t);
    }
    return a;
}

async function main() {
    const a = parseArgs(process.argv.slice(2));
    const psdPath = a._[0];
    if (!psdPath || !a.project) {
        console.error('Usage: node psd2prefab.js <input.psd> --project <cocosProjectRoot> '
            + '[--out PSD] [--name X] [--keep-hidden] [--no-dedup] [--dry-run]');
        process.exit(2);
    }
    const report = await core.convert({
        psdPath, projectRoot: a.project, outDir: a.out, prefabName: a.name,
        keepHidden: a.keepHidden, dedup: a.dedup, dryRun: a.dryRun,
    });
    console.log(JSON.stringify(report, null, 2));
    console.log(`\n[psd2prefab-3x] prefab=${report.prefab.name} nodes=${report.nodes} `
        + `imagesWritten=${report.written} reused=${report.reused} ignored=${report.ignored.length}`);
}

module.exports = core;

if (require.main === module) {
    main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
}
