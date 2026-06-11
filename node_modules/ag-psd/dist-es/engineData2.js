/// Engine data 2 experiments
// /test/engineData2.json:1109 is character codes
var keysColor = {
    '0': {
        uproot: true,
        children: {
            '0': { name: 'Type' },
            '1': { name: 'Values' },
        },
    },
};
var keysStyleSheet = {
    '0': { name: 'Font' },
    '1': { name: 'FontSize' },
    '2': { name: 'FauxBold' },
    '3': { name: 'FauxItalic' },
    '4': { name: 'AutoLeading' },
    '5': { name: 'Leading' },
    '6': { name: 'HorizontalScale' },
    '7': { name: 'VerticalScale' },
    '8': { name: 'Tracking' },
    '9': { name: 'BaselineShift' },
    // '10': ???
    '11': { name: 'Kerning?' },
    '12': { name: 'FontCaps' },
    '13': { name: 'FontBaseline' },
    '15': { name: 'Strikethrough?' },
    '16': { name: 'Underline?' },
    '18': { name: 'Ligatures' },
    '19': { name: 'DLigatures' },
    // '20': ???
    // '21': ???
    // '22': ???
    '23': { name: 'Fractions' },
    '24': { name: 'Ordinals' },
    // '25': ???
    // '26': ???
    // '27': ???
    '28': { name: 'StylisticAlternates' },
    // '29': ???
    '30': { name: 'OldStyle?' },
    '35': { name: 'BaselineDirection' },
    '38': { name: 'Language' },
    '52': { name: 'NoBreak' },
    '53': { name: 'FillColor', children: keysColor },
    '54': { name: 'StrokeColor', children: keysColor },
    '55': { children: { '99': { uproot: true } } },
    // '68': ???
    // '70': ???
    // '71': ???
    // '72': ???
    // '73': ???
    '79': { children: keysColor },
    // '85': ???
    // '87': ???
    // '88': ???
};
var keysParagraph = {
    '0': { name: 'Justification' },
    '1': { name: 'FirstLineIndent' },
    '2': { name: 'StartIndent' },
    '3': { name: 'EndIndent' },
    '4': { name: 'SpaceBefore' },
    '5': { name: 'SpaceAfter' },
    '7': { name: 'AutoLeading' },
    '9': { name: 'AutoHyphenate' },
    '10': { name: 'HyphenatedWordSize' },
    '11': { name: 'PreHyphen' },
    '12': { name: 'PostHyphen' },
    '13': { name: 'ConsecutiveHyphens?' },
    '14': { name: 'Zone' },
    '15': { name: 'HypenateCapitalizedWords' },
    '17': { name: 'WordSpacing' },
    '18': { name: 'LetterSpacing' },
    '19': { name: 'GlyphSpacing' },
    '32': { name: 'StyleSheet', children: keysStyleSheet },
};
var keysStyleSheetData = {
    name: 'StyleSheetData',
    children: keysStyleSheet,
};
var keysRoot = {
    '0': {
        name: 'ResourceDict',
        children: {
            '1': {
                name: 'FontSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': {
                                        uproot: true,
                                        children: {
                                            '0': { name: 'Name' },
                                            '2': { name: 'FontType' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '2': {
                name: '2',
                children: {},
            },
            '3': {
                name: 'MojiKumiSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': { name: 'InternalName' },
                                },
                            },
                        },
                    },
                },
            },
            '4': {
                name: 'KinsokuSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': { name: 'Name' },
                                    '5': {
                                        uproot: true,
                                        children: {
                                            '0': { name: 'NoStart' },
                                            '1': { name: 'NoEnd' },
                                            '2': { name: 'Keep' },
                                            '3': { name: 'Hanging' },
                                            '4': { name: 'Name' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '5': {
                name: 'StyleSheetSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': { name: 'Name' },
                                    '6': keysStyleSheetData,
                                },
                            },
                        },
                    },
                },
            },
            '6': {
                name: 'ParagraphSheetSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': { name: 'Name' },
                                    '5': {
                                        name: 'Properties',
                                        children: keysParagraph,
                                    },
                                    '6': { name: 'DefaultStyleSheet' },
                                },
                            },
                        },
                    },
                },
            },
            '8': {
                name: 'TextFrameSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                name: 'path',
                                children: {
                                    '0': { name: 'name' },
                                    '1': {
                                        name: 'bezierCurve',
                                        children: {
                                            '0': { name: 'controlPoints' },
                                        },
                                    },
                                    '2': {
                                        name: 'data',
                                        children: {
                                            '0': { name: 'type' },
                                            '1': { name: 'orientation' },
                                            '2': { name: 'frameMatrix' },
                                            '4': { name: '4' },
                                            '6': { name: 'textRange' },
                                            '7': { name: 'rowGutter' },
                                            '8': { name: 'columnGutter' },
                                            '9': { name: '9' },
                                            '10': {
                                                name: 'baselineAlignment',
                                                children: {
                                                    '0': { name: 'flag' },
                                                    '1': { name: 'min' },
                                                },
                                            },
                                            '11': {
                                                name: 'pathData',
                                                children: {
                                                    '1': { name: '1' },
                                                    '0': { name: 'reversed' },
                                                    '2': { name: '2' },
                                                    '3': { name: '3' },
                                                    '4': { name: 'spacing' },
                                                    '5': { name: '5' },
                                                    '6': { name: '6' },
                                                    '7': { name: '7' },
                                                    '18': { name: '18' },
                                                },
                                            },
                                            '12': { name: '12' },
                                            '13': { name: '13' },
                                        },
                                    },
                                    '3': { name: '3' },
                                    '97': { name: 'uuid' },
                                },
                            },
                        },
                    },
                },
            },
            '9': {
                name: 'Predefined',
                children: {
                    '0': {
                        children: { '0': { uproot: true } },
                    },
                    '1': {
                        children: { '0': { uproot: true } },
                    },
                },
            },
        },
    },
    '1': {
        name: 'EngineDict',
        children: {
            '0': {
                name: '0',
                children: {
                    // 0: ???
                    // 1: ???
                    // 2: ???
                    '3': { name: 'SuperscriptSize' },
                    '4': { name: 'SuperscriptPosition' },
                    '5': { name: 'SubscriptSize' },
                    '6': { name: 'SubscriptPosition' },
                    '7': { name: 'SmallCapSize' },
                    '8': { name: 'UseFractionalGlyphWidths' },
                    '15': { children: { '0': { uproot: true } } },
                    // 16: ???
                    // 17: ???
                },
            },
            '1': {
                name: 'Editors?',
                children: {
                    '0': {
                        name: 'Editor',
                        children: {
                            '0': { name: 'Text' },
                            '5': {
                                name: 'ParagraphRun',
                                children: {
                                    '0': {
                                        name: 'RunArray',
                                        children: {
                                            '0': {
                                                name: 'ParagraphSheet',
                                                children: {
                                                    '0': {
                                                        uproot: true,
                                                        children: {
                                                            '0': { name: '0' },
                                                            '5': {
                                                                name: '5',
                                                                children: keysParagraph,
                                                            },
                                                            '6': { name: '6' },
                                                        },
                                                    },
                                                },
                                            },
                                            '1': { name: 'RunLength' },
                                        },
                                    },
                                },
                            },
                            '6': {
                                name: 'StyleRun',
                                children: {
                                    '0': {
                                        name: 'RunArray',
                                        children: {
                                            '0': {
                                                name: 'StyleSheet',
                                                children: {
                                                    '0': {
                                                        uproot: true,
                                                        children: {
                                                            '6': keysStyleSheetData,
                                                        },
                                                    },
                                                },
                                            },
                                            '1': { name: 'RunLength' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '1': {
                        name: 'FontVectorData ???',
                        // children: {
                        // 	'0': {},
                        // 	'2': {
                        // 		// '5'
                        // 		// '6'
                        // 	},
                        // }
                        //     "1": [ // this is probably bounding box? there seem to be many of them nested
                        //       0,
                        //       0,
                        //       999,
                        //       176.30014
                        //     ],
                        // various types: /PC, /F, /R, /L, /S, /G
                    },
                },
            },
            '2': {
                name: 'StyleSheet',
                children: keysStyleSheet,
            },
            '3': {
                name: 'ParagraphSheet',
                children: keysParagraph,
            },
        },
    },
};
function decodeObj(obj, keys) {
    var _a, _b;
    if (obj === null)
        return obj;
    if (Array.isArray(obj))
        return obj.map(function (x) { return decodeObj(x, keys); });
    if (typeof obj !== 'object')
        return obj;
    var result = {};
    for (var _i = 0, _c = Object.keys(obj); _i < _c.length; _i++) {
        var key = _c[_i];
        if (keys[key]) {
            if (keys[key].uproot) {
                if (key !== '99')
                    result = decodeObj(obj[key], (_a = keys[key].children) !== null && _a !== void 0 ? _a : {});
                if (obj['99'])
                    result._type = obj['99'];
                break;
            }
            else {
                result[keys[key].name || key] = decodeObj(obj[key], (_b = keys[key].children) !== null && _b !== void 0 ? _b : {});
            }
        }
        else if (key === '99') {
            result._type = obj[key];
        }
        else {
            result[key] = decodeObj(obj[key], {});
        }
    }
    return result;
}
export function decodeEngineData2(data) {
    return decodeObj(data, keysRoot);
}
//# sourceMappingURL=engineData2.js.map