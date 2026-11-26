'use strict';

// normalizePath 는 업로드 캐시(stats.submission)의 키다. 같은 문제가 티어·레벨·언어 폴더 표기만 다르면 같은 키로 모여야
// 같은 코드를 다시 올리지 않고, 다른 문제나 다른 언어는 서로 다른 키로 남아야 한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizePath, normalizeLanguageName, removeBaekjoonRank, removeProgrammersRank, removeSpaces, removeSwexpertacademyRank, unifyPythonFolder } = require('../scripts/utils/pathNormalize.js');

const U = String.fromCodePoint(0x2005); // FOUR-PER-EM SPACE (실제 제목 구분자)

test('normalizePath: 실데이터 경로의 정규화 결과', () => {
  for (const [input, expected] of [
    // 프로그래머스
    [`프로그래머스/0/120814. 피자${U}나눠${U}먹기${U}（1）/피자${U}나눠${U}먹기${U}（1）.py`, '프로그래머스/120814.피자나눠먹기（1）/피자나눠먹기（1）.py'],
    ['프로그래머스/lv0/12345. 제목/제목.java', '프로그래머스/12345.제목/제목.java'],
    [`프로그래머스/Lv.1/12906. 같은${U}숫자는${U}싫어/같은${U}숫자는${U}싫어.py`, '프로그래머스/12906.같은숫자는싫어/같은숫자는싫어.py'],
    // 백준
    ['백준/Gold/1000. A＋B/A＋B.py', '백준/1000.A＋B/A＋B.py'],
    [`백준/Silver${U}V/9655. 돌${U}게임/돌${U}게임.java`, '백준/9655.돌게임/돌게임.java'],
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
    // 언어 폴더 수렴(#346)과 티어 스트립의 결합
    ['owner/repo/PyPy3/백준/Gold/1000. 제목/제목.py', 'owner/repo/Python/백준/1000.제목/제목.py'],
    ['owner/repo/Python 3/백준/1000. 제목/제목.py', 'owner/repo/Python/백준/1000.제목/제목.py'], // removeSpaces 이후 적용
  ]) {
    assert.equal(normalizePath(input), expected, input);
  }
  assert.notEqual(normalizePath('owner/repo/Java/백준/1000. 제목/sol.txt'), normalizePath('owner/repo/Python/백준/1000. 제목/sol.txt'), '다른 언어 폴더는 서로 구분된다');
});

test('경로 필터: 티어·레벨·공백 표기는 지우고, 제목이나 여러 자리 폴더는 과하게 지우지 않는다', () => {
  for (const [fn, input, expected] of [
    ...['Unrated', 'Silver', 'Bronze', 'Gold', 'Platinum', 'Diamond', 'Ruby', 'Master'].map((tier) => [removeBaekjoonRank, `백준/${tier}/1000/x`, '백준/1000/x']),
    ...['I', 'II', 'III', 'IV', 'V'].flatMap((r) => [[removeBaekjoonRank, `백준/Gold ${r}/x`, '백준/x'], [removeBaekjoonRank, `백준/Gold${U}${r}/x`, '백준/x']]),
    [removeBaekjoonRank, '백준/Gold X/x', '백준/Gold X/x'], // X 는 세부 티어가 아니다
    [removeBaekjoonRank, '백준/1234. Silver Bullet/x', '백준/1234. Silver Bullet/x'],
    ...['0', 'lv3', 'unrated', 'Lv.0', 'Lv.5', 'lv.3'].map((level) => [removeProgrammersRank, `프로그래머스/${level}/x`, '프로그래머스/x']),
    ...['프로그래머스/lv10/x', '프로그래머스/12/x', '프로그래머스/Lv.10/x', '260420/x'].map((p) => [removeProgrammersRank, p, p]), // 날짜·두 자리 레벨
    ...[0, 8].map((d) => [removeSwexpertacademyRank, `SWEA/D${d}/x`, 'SWEA/x']),
    [removeSwexpertacademyRank, 'SWEA/D9/x', 'SWEA/D9/x'],
    [removeSpaces, `a${U}b c`, 'abc'],
    [removeSpaces, 'a%20b%E2%80%85c&#160d&#8197e&nbspf', 'abcdef'],
  ]) {
    assert.equal(fn(input), expected, `${fn.name}(${input})`);
  }
});

test('normalizeLanguageName: 파이썬 계열만 Python 으로 모은다 (#346)', () => {
  const toPython = ['Python', 'python', 'PYTHON', 'Python3', 'python3', 'Python 3', 'Python 2', 'Python2', 'Python 3.8', 'PyPy', 'PyPy2', 'PyPy3', 'pypy3', 'PYPY3', `Python${U}3`];
  for (const lang of toPython) assert.equal(normalizeLanguageName(lang), 'Python', JSON.stringify(lang));
  for (const lang of ['Java', 'C++', 'C', 'C#', 'JavaScript', 'Kotlin', 'MySQL', 'Swift', 'Go', 'Ruby', 'Pythonic', '', undefined, null]) {
    assert.equal(normalizeLanguageName(lang), lang, `${lang} 무변경`);
  }
});

test('unifyPythonFolder: 언어 폴더 세그먼트만 Python 으로 수렴하고 hook·제목·파일명은 건드리지 않는다 (#346)', () => {
  for (const [input, expected] of [
    ['owner/repo/Python3/프로그래머스/x', 'owner/repo/Python/프로그래머스/x'],
    ['owner/repo/pypy/백준/x', 'owner/repo/Python/백준/x'],
    ['owner/repo/PyPy3/Python3/x', 'owner/repo/Python/Python/x'], // 연속 세그먼트 (lookahead)
    ['owner/repo/MySQL/프로그래머스/x', 'owner/repo/MySQL/프로그래머스/x'],
    // hook(owner/repo) 두 세그먼트는 raw hook 조회와 어긋나면 안 된다
    ['python3/algo/백준/1000.제목/x.py', 'python3/algo/백준/1000.제목/x.py'],
    ['owner/python3/Python3/프로그래머스/x', 'owner/python3/Python/프로그래머스/x'],
    ['owner/repo', 'owner/repo'], // bare hook (getStatsSHAfromPath(hook))
    ['owner/repo/백준/1000.Python3풀이/x.py', 'owner/repo/백준/1000.Python3풀이/x.py'],
    ['owner/repo/Python3풀이/x.py', 'owner/repo/Python3풀이/x.py'],
    ['owner/repo/백준/1000.제목/Python3.py', 'owner/repo/백준/1000.제목/Python3.py'], // 파일명
  ]) {
    assert.equal(unifyPythonFolder(input), expected, input);
  }
});
