// أيقونات بكسلية أصلية (8×8) للنسخ. كل صف 8 أحرف؛ النقطة = شفاف.
(() => {
  const B = [
    ['grass', 'بلوك عشب', { G: '#5fae3c', g: '#4a9230', D: '#8b5a2b', d: '#6e4520' }, ['GGGGGGGG', 'GgGGGgGG', 'DGDGGDGD', 'DDDDDDDD', 'DdDDDdDD', 'DDDdDDDD', 'DDDDDdDD', 'dDDDDDDd']],
    ['dirt', 'تراب', { D: '#8b5a2b', d: '#6e4520' }, ['DDdDDDDd', 'DDDDdDDD', 'dDDDDDdD', 'DDdDDDDD', 'DDDDDdDD', 'DdDDDDDd', 'DDDdDDDD', 'DDDDdDDD']],
    ['stone', 'حجر', { S: '#8a8a8a', s: '#6f6f6f', l: '#9d9d9d' }, ['SSsSSSlS', 'SSSSsSSS', 'lSSSSSsS', 'SSsSSSSS', 'SSSSSlSS', 'SsSSSSSS', 'SSSlSSsS', 'SSSSSsSS']],
    ['cobble', 'حجر مرصوف', { S: '#8a8a8a', s: '#6f6f6f', K: '#555555' }, ['SSKSSSKK', 'SsSKSSSS', 'KSSSSsSK', 'SSSKKSSS', 'SKSSSSsS', 'SSSSKSSS', 'KSsSSSKS', 'SSSKSSSS']],
    ['planks', 'ألواح خشب', { P: '#b8894a', p: '#9a6f38' }, ['PPPPPPPP', 'pppppppp', 'PPPPPpPP', 'PPPPPPPP', 'pppppppp', 'PpPPPPPP', 'PPPPPPPP', 'pppppppp']],
    ['tnt', 'تي إن تي', { R: '#c62828', r: '#9e1f1f', W: '#e8e8e8', K: '#333333' }, ['RRRRRRRR', 'rrrrrrrr', 'WWWWWWWW', 'WKKWKWKW', 'WWKWKKWW', 'WWWWWWWW', 'RRRRRRRR', 'rrrrrrrr']],
    ['crafting', 'طاولة صناعة', { B: '#6b4a25', P: '#b8894a', K: '#3b2a18' }, ['KKKKKKKK', 'KPPKPPPK', 'KPPKPPPK', 'KKKKKKKK', 'BPPBPPPB', 'BPPBPPPB', 'BBBBBBBB', 'BKBBBBKB']],
    ['furnace', 'فرن', { S: '#8a8a8a', s: '#6f6f6f', K: '#2b2b2b', O: '#ff9f1c', Y: '#ffd23f' }, ['SSSSSSSS', 'SsSSSSsS', 'SKKKKKKS', 'SKOOYOKS', 'SKKOOKKS', 'SKKKKKKS', 'SsSSSSsS', 'SSSSSSSS']],
    ['chest', 'صندوق', { B: '#9a6a2f', b: '#6e4a1e', Y: '#e6c15a', K: '#3b2a18' }, ['KKKKKKKK', 'KBBBBBBK', 'KBBBBBBK', 'KKKYYKKK', 'KBBYYBBK', 'KBBBBBBK', 'KbbbbbbK', 'KKKKKKKK']],
    ['bookshelf', 'رف كتب', { P: '#b8894a', K: '#3b2a18', R: '#aa3333', G: '#33aa77', B: '#3366aa', Y: '#ccaa33' }, ['PPPPPPPP', 'KRGBYRGK', 'KRGBYRGK', 'PPPPPPPP', 'KBYRGBYK', 'KBYRGBYK', 'KBYRGBYK', 'PPPPPPPP']],
    ['creeper', 'كريبر', { G: '#4caf50', g: '#388e3c', K: '#111111' }, ['GGGGgGGG', 'GKKGGKKG', 'GKKGGKKG', 'GGGKKGGG', 'GGKKKKGG', 'GGKKKKGG', 'GGKGGKGG', 'gGGGGGGG']],
    ['sword', 'سيف ألماس', { C: '#4de8e8', c: '#27b5b5', B: '#6b4a25', K: '#3b2a18' }, ['......cC', '.....cCc', '....cCc.', '.K.cCc..', '..KCc...', '..KB....', '.B.K....', 'B.......']],
    ['pickaxe', 'معول', { C: '#4de8e8', B: '#6b4a25' }, ['.CCCCC..', 'C.....C.', '...B...C', '..B.....', '..B.....', '.B......', '.B......', 'B.......']],
    ['diamond', 'ألماسة', { C: '#4de8e8', c: '#27b5b5', W: '#d8ffff' }, ['...CC...', '..CWCc..', '.CWCCCc.', 'CCCCCCcc', '.CCCCcc.', '..CCcc..', '...Cc...', '........']],
    ['torch', 'شعلة', { Y: '#ffd23f', O: '#ff9f1c', B: '#6b4a25' }, ['...Y....', '..YOY...', '...O....', '...B....', '...B....', '...B....', '...B....', '...B....']],
    ['ore', 'خام ألماس', { S: '#8a8a8a', s: '#6f6f6f', l: '#9d9d9d', C: '#4de8e8' }, ['SSCSSSlS', 'SCCSSSSS', 'SSsSSCCS', 'lSSSSCSS', 'SSCCSSsS', 'SSCSSSSS', 'SSSSlSsS', 'SsSSSSSS']]
  ].map(([id, name, pal, rows]) => ({ id, name, pal, rows }));

  const byId = Object.fromEntries(B.map((b) => [b.id, b]));
  window.BLOCKS = B;
  // يعيد SVG بكسلي؛ يعود إلى العشب إذا كان المعرّف غير معروف.
  window.blockSvg = (id, cls = '') => {
    const b = byId[id] || byId.grass; let r = '';
    b.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (b.pal[ch]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${b.pal[ch]}"/>`; }));
    return `<svg class="blk ${cls}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  };
})();
