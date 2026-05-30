'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizePath, removeBaekjoonRank, removeProgrammersRank, removeSpaces, removeSwexpertacademyRank } = require('../scripts/utils/pathNormalize.js');
const { originalNormalize } = require('./fixtures/originalFilters.cjs');

const U = String.fromCodePoint(0x2005); // FOUR-PER-EM SPACE (real title separator)

// 의도된 dedup 수정 대상(동작 변경 O): 백준 세부 티어("Silver V" 등) / 프로그래머스 "Lv.N".
// 이 패턴에 해당하는 경로만 원본과 달라지며(랭크 스트립), 나머지는 전부 원본과 바이트 동일(무회귀)해야 한다.
const SUBTIER_RE = new RegExp('/(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)[ \\u2005](I{1,3}|IV|V)/');
const LVDOT_RE = /\/[Ll]v\.[0-9]\//;
const isDedupFix = (p) => SUBTIER_RE.test(p) || LVDOT_RE.test(p);

/* ------------------------------------------------------------------ *
 * 1) DIFFERENTIAL PARITY — 새 모듈 출력이 기존(storage.js) 출력과 완전히 동일한가
 *    실제 BaekjoonHub 레포에서 수확한 경로 픽스처 전체를 원본 구현과 바이트 단위 비교.
 * ------------------------------------------------------------------ */
function loadFixture() {
  const file = path.join(__dirname, 'fixtures', 'realPaths.txt');
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
}
const PLATFORMS = ['백준', '프로그래머스', 'SWEA', 'swexpertacademy', 'goormlevel'];
function platformOf(p) {
  const segs = p.split('/');
  for (const plat of PLATFORMS) if (segs.includes(plat)) return plat === 'swexpertacademy' ? 'SWEA' : plat;
  return 'other';
}

describe('differential parity over real harvested paths', () => {
  const paths = loadFixture();
  const fixPaths = paths.filter(isDedupFix);
  const restPaths = paths.filter((p) => !isDedupFix(p));

  test('fixture is non-empty', () => {
    assert.ok(paths.length > 0, 'realPaths.txt should not be empty');
  });

  test('every NON-fix real path still normalizes identically to the original (no regression)', () => {
    const mismatches = [];
    for (const p of restPaths) {
      const got = normalizePath(p);
      const want = originalNormalize(p);
      if (got !== want) mismatches.push({ p, got, want });
    }
    assert.equal(mismatches.length, 0, `parity mismatches:\n${mismatches.slice(0, 10).map((m) => JSON.stringify(m)).join('\n')}`);
    assert.ok(restPaths.length >= 100, `expected a substantial corpus, got ${restPaths.length}`);
  });

  test('every sub-tier / Lv.N real path is now rank-stripped (old→new dedup fix)', () => {
    assert.ok(fixPaths.length >= 30, `expected a meaningful set of fix paths, got ${fixPaths.length}`);
    const wrong = [];
    for (const p of fixPaths) {
      const got = normalizePath(p);
      const old = originalNormalize(p); // 구버전은 랭크를 남김
      // 1) 새 출력은 구버전과 달라야 한다(수정이 실제로 적용됨)
      if (got === old) { wrong.push({ p, got, old, why: 'unchanged' }); continue; }
      // 2) 스트립 후 랭크 토큰이 키에 남아있지 않아야 한다
      const strandedTier = /(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)(I{1,3}|IV|V)\//.test(got);
      const strandedLv = /[Ll]v\.[0-9]/.test(got);
      if (strandedTier || strandedLv) wrong.push({ p, got, why: 'stranded rank' });
    }
    assert.equal(wrong.length, 0, `unexpected fix results:\n${wrong.slice(0, 10).map((m) => JSON.stringify(m)).join('\n')}`);
  });

  // 각 플랫폼 당 최소 30케이스 이상이어야 한다.
  const counts = {};
  for (const p of paths) counts[platformOf(p)] = (counts[platformOf(p)] || 0) + 1;
  for (const plat of ['백준', '프로그래머스', 'SWEA', 'goormlevel']) {
    test(`platform ${plat} has >= 30 real cases (got ${counts[plat] || 0})`, () => {
      assert.ok((counts[plat] || 0) >= 30, `${plat}: only ${counts[plat] || 0} cases`);
    });
  }
});

/* ------------------------------------------------------------------ *
 * 2) DIFFERENTIAL PARITY over a generated combinatorial corpus
 *    모든 티어/레벨/난이도/특수문자 분기를 망라해 원본과 비교(분기 커버리지).
 * ------------------------------------------------------------------ */
describe('differential parity over generated combinatorial corpus', () => {
  const titles = [
    `오늘${U}날짜`, `피자${U}나눠${U}먹기${U}（1）`, `A＋B`, `［S／W${U}문제해결］${U}5일차${U}－${U}M`,
    `1000.&nbsp;제목`, `테스트%20제목`, `값${U}구하기`, `별${U}찍기－12`,
  ];
  const corpus = [];
  const baekTiers = ['Unrated', 'Silver', 'Bronze', 'Gold', 'Platinum', 'Diamond', 'Ruby', 'Master', 'Silver I', 'Gold V'];
  const progLevels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'lv0', 'lv1', 'lv5', 'unrated', 'Lv.1', 'Lv.2'];
  const sweaDiffs = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'Unrated'];
  const goormIds = ['1', '12', '159695', '244330', '47882'];
  for (const t of titles) {
    for (const tier of baekTiers) corpus.push(`백준/${tier}/1000.${U}${t}/${t}.cpp`);
    for (const lv of progLevels) corpus.push(`프로그래머스/${lv}/12345.${U}${t}/${t}.py`);
    for (const d of sweaDiffs) corpus.push(`SWEA/${d}/1234.${U}${t}/${t}.cpp`);
    for (const id of goormIds) corpus.push(`goormlevel/${id}/1.${U}${t}/${t}.py`);
    corpus.push(`260420/9012.${U}${t}/${t}.py`); // date-template folder
    corpus.push(`MySQL/프로그래머스/1/131112.${U}${t}/${t}.sql`); // language-grouped
  }

  test(`generated NON-fix paths match the original; sub-tier/Lv.N paths get stripped`, () => {
    const mismatches = [];
    const notFixed = [];
    for (const p of corpus) {
      const got = normalizePath(p);
      const old = originalNormalize(p);
      if (isDedupFix(p)) {
        if (got === old) notFixed.push(p); // 수정 대상인데 그대로면 실패
      } else if (got !== old) {
        mismatches.push(p); // 비대상인데 달라지면 회귀
      }
    }
    assert.equal(mismatches.length, 0, `non-fix mismatched: ${mismatches.slice(0, 10).join(' | ')}`);
    assert.ok(corpus.some(isDedupFix), 'corpus should include sub-tier / Lv.N cases');
    assert.equal(notFixed.length, 0, `fix paths not stripped: ${notFixed.slice(0, 10).join(' | ')}`);
  });

  test('corpus actually exercises every platform', () => {
    const plats = new Set(corpus.map(platformOf));
    for (const plat of ['백준', '프로그래머스', 'SWEA', 'goormlevel']) assert.ok(plats.has(plat), `missing ${plat}`);
  });
});

/* ------------------------------------------------------------------ *
 * 3) GOLDEN characterization — 정확한 출력 박제 (실데이터 기반)
 * ------------------------------------------------------------------ */
describe('golden characterization (real-data vectors)', () => {
  const golden = [
    // 프로그래머스
    [`프로그래머스/0/120814. 피자${U}나눠${U}먹기${U}（1）/피자${U}나눠${U}먹기${U}（1）.py`, '프로그래머스/120814.피자나눠먹기（1）/피자나눠먹기（1）.py'],
    [`프로그래머스/lv0/12345. 제목/제목.java`, '프로그래머스/12345.제목/제목.java'],
    [`프로그래머스/Lv.1/12906. 같은${U}숫자는${U}싫어/같은${U}숫자는${U}싫어.py`, '프로그래머스/12906.같은숫자는싫어/같은숫자는싫어.py'], // Lv.N 스트립(수정됨)
    // 백준
    [`백준/Gold/1000. A＋B/A＋B.py`, '백준/1000.A＋B/A＋B.py'],
    [`백준/Silver${U}V/9655. 돌${U}게임/돌${U}게임.java`, '백준/9655.돌게임/돌게임.java'], // 세부 티어 스트립(수정됨)
    // SWEA
    [`SWEA/D3/1220. ［S／W${U}문제해결${U}기본］${U}5일차${U}－${U}Magnetic/［S／W${U}문제해결${U}기본］${U}5일차${U}－${U}Magnetic.py`, 'SWEA/1220.［S／W문제해결기본］5일차－Magnetic/［S／W문제해결기본］5일차－Magnetic.py'],
    [`SWEA/Unrated/1949. ［모의${U}SW${U}역량테스트］${U}등산로${U}조성/［모의${U}SW${U}역량테스트］${U}등산로${U}조성.cpp`, 'SWEA/1949.［모의SW역량테스트］등산로조성/［모의SW역량테스트］등산로조성.cpp'],
    // goorm
    [`goormlevel/159695/1. 별${U}찍기－12/별${U}찍기－12.undefined`, 'goormlevel/159695/1.별찍기－12/별찍기－12.undefined'],
  ];
  for (const [input, expected] of golden) {
    test(`normalizePath: ${expected}`, () => {
      assert.equal(normalizePath(input), expected);
    });
  }
});

/* ------------------------------------------------------------------ *
 * 4) Per-filter unit behavior
 * ------------------------------------------------------------------ */
describe('removeBaekjoonRank', () => {
  test('strips each baekjoon tier folder', () => {
    for (const tier of ['Unrated', 'Silver', 'Bronze', 'Gold', 'Platinum', 'Diamond', 'Ruby', 'Master']) {
      assert.equal(removeBaekjoonRank(`백준/${tier}/1000/x`), '백준/1000/x');
    }
  });
  test('strips sub-leveled tiers (Silver V 등) for both U+0020 and U+2005 separators', () => {
    for (const r of ['I', 'II', 'III', 'IV', 'V']) {
      assert.equal(removeBaekjoonRank(`백준/Gold ${r}/x`), '백준/x', `Gold ${r} (U+0020)`);
      assert.equal(removeBaekjoonRank(`백준/Gold${U}${r}/x`), '백준/x', `Gold ${r} (U+2005)`);
    }
    assert.equal(removeBaekjoonRank('백준/Bronze II/1234. T/T.cc'), '백준/1234. T/T.cc');
  });
  test('does NOT over-strip a non-roman suffix (e.g. "Gold X" or title that starts with a tier word)', () => {
    assert.equal(removeBaekjoonRank('백준/Gold X/x'), '백준/Gold X/x'); // X는 세부 티어 아님
    assert.equal(removeBaekjoonRank('백준/1234. Silver Bullet/x'), '백준/1234. Silver Bullet/x');
  });
  test('consecutive tiers: only the first is removed (regex /g, non-overlapping)', () => {
    assert.equal(removeBaekjoonRank('백준/Gold/Silver/x'), '백준/Silver/x');
  });
});

describe('removeProgrammersRank', () => {
  test('strips single-digit, lv-prefixed, and unrated', () => {
    assert.equal(removeProgrammersRank('프로그래머스/0/x'), '프로그래머스/x');
    assert.equal(removeProgrammersRank('프로그래머스/lv3/x'), '프로그래머스/x');
    assert.equal(removeProgrammersRank('프로그래머스/unrated/x'), '프로그래머스/x');
  });
  test('strips Lv.N notation (capital L / lowercase, escaped dot)', () => {
    for (const n of [0, 1, 2, 3, 4, 5]) assert.equal(removeProgrammersRank(`프로그래머스/Lv.${n}/x`), '프로그래머스/x', `Lv.${n}`);
    assert.equal(removeProgrammersRank('프로그래머스/lv.3/x'), '프로그래머스/x');
  });
  test('does NOT strip multi-digit folders (C-regression guard: goorm examId / date / two-digit lv / Lv.10)', () => {
    assert.equal(removeProgrammersRank('goormlevel/159695/x'), 'goormlevel/159695/x');
    assert.equal(removeProgrammersRank('260420/x'), '260420/x');
    assert.equal(removeProgrammersRank('프로그래머스/lv10/x'), '프로그래머스/lv10/x');
    assert.equal(removeProgrammersRank('프로그래머스/12/x'), '프로그래머스/12/x');
    assert.equal(removeProgrammersRank('프로그래머스/Lv.10/x'), '프로그래머스/Lv.10/x');
  });
});

describe('removeSpaces', () => {
  test('removes U+0020 and U+2005', () => {
    assert.equal(removeSpaces(`a${U}b c`), 'abc');
  });
  test('removes %20, %E2%80%85, &#160, &#8197, &nbsp tokens', () => {
    assert.equal(removeSpaces('a%20b%E2%80%85c&#160d&#8197e&nbspf'), 'abcdef');
  });
  test('&nbsp; leaves a trailing ; (preserved quirk — entity has no semicolon)', () => {
    assert.equal(removeSpaces('1000.&nbsp;제목'), '1000.;제목');
  });
});

describe('removeSwexpertacademyRank', () => {
  test('strips D0..D8', () => {
    for (let d = 0; d <= 8; d++) assert.equal(removeSwexpertacademyRank(`SWEA/D${d}/x`), 'SWEA/x');
  });
  test('does NOT strip D9 (out of [0-8]) — no such difficulty on SWEA anyway', () => {
    assert.equal(removeSwexpertacademyRank('SWEA/D9/x'), 'SWEA/D9/x');
  });
});

/* ------------------------------------------------------------------ *
 * 5) Invariants
 * ------------------------------------------------------------------ */
describe('dedup invariants', () => {
  test('same problem at different baekjoon tier maps to the same key', () => {
    assert.equal(
      normalizePath(`백준/Gold/1000. 제목/제목.py`),
      normalizePath(`백준/Silver/1000. 제목/제목.py`),
    );
  });
  test('same programmers problem at lv vs bare-digit level maps to the same key', () => {
    assert.equal(
      normalizePath(`프로그래머스/lv1/12345. 제목/sol.py`),
      normalizePath(`프로그래머스/1/12345. 제목/sol.py`),
    );
  });
  test('백준 세부 티어 ↔ bare 티어 ↔ 무티어가 모두 같은 키로 수렴 (#344 수정)', () => {
    const none = normalizePath(`백준/1000. 제목/제목.py`);
    const bare = normalizePath(`백준/Gold/1000. 제목/제목.py`);
    const sub = normalizePath(`백준/Gold${U}V/1000. 제목/제목.py`);
    const subSpace = normalizePath(`백준/Silver V/1000. 제목/제목.py`);
    assert.equal(bare, none);
    assert.equal(sub, none);
    assert.equal(subSpace, none);
  });
  test('프로그래머스 Lv.N ↔ bare-digit 레벨이 같은 키로 수렴 (#344 수정)', () => {
    assert.equal(
      normalizePath(`프로그래머스/Lv.1/12345. 제목/sol.py`),
      normalizePath(`프로그래머스/1/12345. 제목/sol.py`),
    );
  });
});

/* ------------------------------------------------------------------ *
 * 6) CUSTOM directory templates (welcome.js buildDirectory feature)
 *    사용자가 ${platform}/${level}/${levelFull}/${id}/${title}/${language}/${examId}
 *    조합으로 경로를 직접 정의할 수 있다. 세부 티어(${levelFull}=="Gold V") 템플릿만
 *    #344 수정으로 랭크가 제거되고(=원본과 달라짐), 그 외 형태는 원본과 바이트 동일해야 한다.
 * ------------------------------------------------------------------ */
describe('custom directory templates', () => {
  // scripts/storage.js applyDirectoryTemplate 의 미러
  const applyTemplate = (tmpl, vars) => tmpl.replace(/\$\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : ''));
  const VARS = {
    baekjoon: { platform: '백준', level: 'Gold', levelFull: 'Gold V', id: '1000', title: 'A＋B', language: 'Python', ext: 'py' },
    programmers: { platform: '프로그래머스', level: '2', id: '12345', title: `타겟${U}넘버`, language: 'JavaScript', ext: 'js' },
    swea: { platform: 'SWEA', level: 'D4', id: '1234', title: '문제제목', language: 'Java', ext: 'java' },
    goormlevel: { platform: 'goormlevel', level: '3', examId: '159695', id: '54321', title: `문제${U}제목`, language: 'Python', ext: 'py' },
  };
  const render = (plat, tmpl) => { const v = VARS[plat]; return `owner/repo/${applyTemplate(tmpl, v)}/${v.title}.${v.ext}`; };

  const cases = [
    ['baekjoon', '${platform}/${levelFull}/${id}. ${title}', 'owner/repo/백준/1000.A＋B/A＋B.py'], // Gold V 세부 티어 스트립(#344)
    ['programmers', '${title}', 'owner/repo/타겟넘버/타겟넘버.js'],
    ['baekjoon', '${id}/${title}', 'owner/repo/1000/A＋B/A＋B.py'],
    ['programmers', 'solutions/${language}/${platform}/${level}/${id}. ${title}', 'owner/repo/solutions/JavaScript/프로그래머스/12345.타겟넘버/타겟넘버.js'],
    ['goormlevel', '${platform}/${examId}/${id}. ${title}', 'owner/repo/goormlevel/159695/54321.문제제목/문제제목.py'],
    ['goormlevel', '${platform}/${level}/${id}. ${title}', 'owner/repo/goormlevel/54321.문제제목/문제제목.py'],
    ['swea', '${level}-${id}_${title}', 'owner/repo/D4-1234_문제제목/문제제목.java'],
    ['baekjoon', '${platform}/${nope}/${id}. ${title}', 'owner/repo/백준//1000.A＋B/A＋B.py'],
  ];
  for (const [plat, tmpl, expected] of cases) {
    test(`template "${tmpl}" -> ${expected}`, () => {
      const input = render(plat, tmpl);
      assert.equal(normalizePath(input), expected, 'golden');
      if (isDedupFix(input)) {
        // 세부 티어/Lv.N 템플릿: 의도적으로 원본과 달라진다(랭크 제거)
        assert.notEqual(normalizePath(input), originalNormalize(input), 'dedup fix should change output vs original');
      } else {
        assert.equal(normalizePath(input), originalNormalize(input), 'parity vs original');
      }
    });
  }

  test('levelFull (Gold V) 템플릿 사용자도 이제 dedup 됨 — 세부 티어가 키에서 제거된다 (#344)', () => {
    const out = normalizePath(render('baekjoon', '${platform}/${levelFull}/${id}. ${title}'));
    assert.ok(!out.includes('GoldV'), `Gold V should be stripped now, got ${out}`);
    // levelFull(Gold V) 키 == 무티어 키
    assert.equal(out, normalizePath(render('baekjoon', '${platform}/${id}. ${title}')), 'levelFull과 무티어가 같은 키로 수렴해야 함');
  });

  test('bare numeric custom folders (${id}, goorm examId) survive — C-regression guard for custom templates', () => {
    assert.equal(normalizePath('owner/repo/1000/x.py'), 'owner/repo/1000/x.py');
    assert.equal(normalizePath('owner/repo/goormlevel/159695/54321.t/x.py'), 'owner/repo/goormlevel/159695/54321.t/x.py');
  });
});

describe('module hygiene', () => {
  test('source uses ASCII \\u2005 escape, not a raw invisible U+2005 byte', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'utils', 'pathNormalize.js'), 'utf8');
    assert.ok(!src.includes(U), 'pathNormalize.js must not contain a literal U+2005 character');
    assert.ok(src.includes('\\u2005'), 'pathNormalize.js should reference \\u2005 explicitly');
  });
});
