'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizePath, normalizeLanguageName, removeBaekjoonRank, removeProgrammersRank, removeSpaces, removeSwexpertacademyRank, unifyPythonFolder } = require('../scripts/utils/pathNormalize.js');

const U = String.fromCodePoint(0x2005); // FOUR-PER-EM SPACE (real title separator)

/* ------------------------------------------------------------------ *
 * 1) GOLDEN characterization — 정확한 출력 박제 (실데이터 기반)
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
    // 사용자 지정 디렉토리 템플릿(설정 페이지)이 만드는 경로
    ['owner/repo/백준/Gold V/1000. A＋B/A＋B.py', 'owner/repo/백준/1000.A＋B/A＋B.py'], // ${platform}/${levelFull}/… 세부 티어 스트립(#344)
    [`owner/repo/타겟${U}넘버/타겟${U}넘버.js`, 'owner/repo/타겟넘버/타겟넘버.js'], // ${title}
    ['owner/repo/1000/A＋B/A＋B.py', 'owner/repo/1000/A＋B/A＋B.py'], // ${id}/${title} — 여러 자리 숫자 폴더는 남는다
    [`owner/repo/solutions/JavaScript/프로그래머스/2/12345. 타겟${U}넘버/타겟${U}넘버.js`, 'owner/repo/solutions/JavaScript/프로그래머스/12345.타겟넘버/타겟넘버.js'],
    ['owner/repo/D4-1234_문제제목/문제제목.java', 'owner/repo/D4-1234_문제제목/문제제목.java'], // ${level}-${id}_${title}
    ['owner/repo/백준//1000. A＋B/A＋B.py', 'owner/repo/백준//1000.A＋B/A＋B.py'], // 없는 변수는 빈 문자열
  ];
  for (const [input, expected] of golden) {
    test(`normalizePath: ${expected}`, () => {
      assert.equal(normalizePath(input), expected);
    });
  }
});

/* ------------------------------------------------------------------ *
 * 2) Per-filter unit behavior
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
  test('does NOT strip multi-digit folders (C-regression guard: date / two-digit lv / Lv.10)', () => {
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

describe('normalizeLanguageName — 파이썬 계열 표준화 (#346)', () => {
  const toPython = [
    'Python', 'python', 'PYTHON', // 케이싱 변형 (SWEA 원시 표기 포함)
    'Python3', 'python3', 'Python 3', 'Python 2', 'Python2', 'Python 3.8', // 버전 표기 (프로그래머스/백준)
    'PyPy', 'PyPy2', 'PyPy3', 'pypy3', 'PYPY3', // PyPy 계열도 Python 으로 수렴
    `Python${U}3`, // U+2005 구분자 방어
  ];
  for (const lang of toPython) {
    test(`'${lang.replace(U, '\\u2005')}' -> 'Python'`, () => {
      assert.equal(normalizeLanguageName(lang), 'Python');
    });
  }
  const unchanged = ['Java', 'C++', 'C', 'C#', 'JavaScript', 'Kotlin', 'MySQL', 'Swift', 'Go', 'Ruby', 'Pythonic', ''];
  for (const lang of unchanged) {
    test(`'${lang}' 무변경`, () => {
      assert.equal(normalizeLanguageName(lang), lang);
    });
  }
  test('비문자열 입력은 그대로 통과 (buildDirectory 방어)', () => {
    assert.equal(normalizeLanguageName(undefined), undefined);
    assert.equal(normalizeLanguageName(null), null);
  });
});

describe('unifyPythonFolder — 캐시 키 언어 폴더 수렴 (#346)', () => {
  test('구 파이썬 계열 폴더 세그먼트를 Python 으로 치환', () => {
    assert.equal(unifyPythonFolder('owner/repo/Python3/프로그래머스/x'), 'owner/repo/Python/프로그래머스/x');
    assert.equal(unifyPythonFolder('owner/repo/PyPy3/백준/x'), 'owner/repo/Python/백준/x');
    assert.equal(unifyPythonFolder('owner/repo/pypy/백준/x'), 'owner/repo/Python/백준/x');
  });
  test('표준형/비파이썬 폴더는 무변경', () => {
    assert.equal(unifyPythonFolder('owner/repo/Python/프로그래머스/x'), 'owner/repo/Python/프로그래머스/x');
    assert.equal(unifyPythonFolder('owner/repo/MySQL/프로그래머스/x'), 'owner/repo/MySQL/프로그래머스/x');
    assert.equal(unifyPythonFolder('owner/repo/Java/백준/x'), 'owner/repo/Java/백준/x');
  });
  test('hook(owner/repo) 두 세그먼트는 파이썬 계열 이름이어도 건드리지 않음 — raw hook 조회와 어긋나면 안 됨', () => {
    assert.equal(unifyPythonFolder('python3/algo/백준/1000.제목/x.py'), 'python3/algo/백준/1000.제목/x.py');
    assert.equal(unifyPythonFolder('owner/python3/백준/1000.제목/x.py'), 'owner/python3/백준/1000.제목/x.py');
    assert.equal(unifyPythonFolder('owner/python3/Python3/프로그래머스/x'), 'owner/python3/Python/프로그래머스/x'); // 언어 폴더만 수렴
    assert.equal(unifyPythonFolder('owner/repo'), 'owner/repo'); // bare hook (getStatsSHAfromPath(hook))
  });
  test('파이썬 계열 세그먼트가 연속되어도 전부 수렴 — 구분자 비소비(lookahead)', () => {
    assert.equal(unifyPythonFolder('owner/repo/PyPy3/Python3/x'), 'owner/repo/Python/Python/x');
  });
  test('세그먼트 전체 일치가 아니면 오매칭하지 않음 (제목 폴더 가드)', () => {
    assert.equal(unifyPythonFolder('owner/repo/백준/1000.Python3풀이/x.py'), 'owner/repo/백준/1000.Python3풀이/x.py');
    assert.equal(unifyPythonFolder('owner/repo/Python3풀이/x.py'), 'owner/repo/Python3풀이/x.py');
    assert.equal(unifyPythonFolder('owner/repo/Pythonic/x.py'), 'owner/repo/Pythonic/x.py');
  });
  test('마지막 세그먼트(파일명)는 절대 건드리지 않음', () => {
    assert.equal(unifyPythonFolder('owner/repo/백준/1000.제목/Python3.py'), 'owner/repo/백준/1000.제목/Python3.py');
  });
});

/* ------------------------------------------------------------------ *
 * 3) Invariants
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
  test('구 Python3 폴더 업로드와 신 Python 폴더 업로드가 같은 키로 수렴 (#346 수정)', () => {
    assert.equal(
      normalizePath(`owner/repo/Python3/프로그래머스/1/12345. 제목/sol.py`),
      normalizePath(`owner/repo/Python/프로그래머스/1/12345. 제목/sol.py`),
    );
  });
  test('백준 PyPy3 폴더도 Python 키로 수렴 — 티어 스트립과 결합 (#346 수정)', () => {
    assert.equal(
      normalizePath(`owner/repo/PyPy3/백준/Gold/1000. 제목/제목.py`),
      normalizePath(`owner/repo/Python/백준/1000. 제목/제목.py`),
    );
  });
  test("공백 포함 'Python 3' 폴더도 수렴 — removeSpaces 이후 적용 순서 보장 (#346)", () => {
    assert.equal(
      normalizePath(`owner/repo/Python 3/백준/1000. 제목/제목.py`),
      normalizePath(`owner/repo/Python/백준/1000. 제목/제목.py`),
    );
  });
  test('다른 언어 폴더는 서로 구분 유지 — Java 키 != Python 키 (#346 과매칭 가드)', () => {
    assert.notEqual(
      normalizePath(`owner/repo/Java/백준/1000. 제목/sol.txt`),
      normalizePath(`owner/repo/Python/백준/1000. 제목/sol.txt`),
    );
  });
});

describe('module hygiene', () => {
  test('source uses ASCII \\u2005 escape, not a raw invisible U+2005 byte', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'utils', 'pathNormalize.js'), 'utf8');
    assert.ok(!src.includes(U), 'pathNormalize.js must not contain a literal U+2005 character');
    assert.ok(src.includes('\\u2005'), 'pathNormalize.js should reference \\u2005 explicitly');
  });
});
