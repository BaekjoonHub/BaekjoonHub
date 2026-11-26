/*
  정올의 제출 상세를 읽어 업로드할 데이터로 만드는 함수의 모음입니다.
  코드와 채점 결과는 화면이 아니라 제출 상세 페이지의 HTML 에서 읽습니다. 화면의 에디터는 보이는 줄만 DOM 에 두고,
  정올 API 는 본문을 난독화해 직접 부를 수 없기 때문입니다.
*/

/**
 * SvelteKit 이 페이지 HTML 에 실어 보내는 데이터(devalue 가 만든 JS 리터럴)를 읽습니다.
 * 콘텐츠 스크립트는 eval 을 쓸 수 없고, 써서도 안 된다(페이지가 준 글자를 실행하게 된다).
 * 읽는 문법: 객체·배열·문자열·숫자·true/false/null/void 0, 그리고 한 노드에서 반복되는 값을 묶은
 * (function(a,b){return 값}(값,값)). 그 밖의 식(new Date(…), 함수 호출)은 undefined 로 읽는다.
 * shortcut: 새 devalue 가 쓰는 (function(){let a=…;return 값}()) 꼴은 읽지 못해 null 을 돌려준다. 정올이 그 꼴로 바꾸면 let 문을 읽게 고친다.
 * @param {string} html - 페이지 HTML
 * @returns {Array|null} kit.start 에 넘긴 data 배열. 읽지 못하면 null
 */
function readSvelteKitData(html) {
  const head = /node_ids:\s*\[[\d,\s]*\],\s*data:\s*(?=\[)/.exec(html);
  if (!head) return null;
  let i = head.index + head[0].length;
  const scope = {}; // 반복 값을 묶은 함수의 매개변수 이름 → 값

  const fail = () => {
    throw new SyntaxError(`위치 ${i}`);
  };
  const skip = () => {
    while (i < html.length && /\s/.test(html[i])) i += 1;
  };
  const eat = (text) => {
    skip();
    if (!html.startsWith(text, i)) return false;
    i += text.length;
    return true;
  };
  const expect = (text) => eat(text) || fail();
  const match = (pattern) => {
    skip();
    pattern.lastIndex = i;
    const found = pattern.exec(html);
    if (!found) return fail();
    i = pattern.lastIndex;
    return found[0];
  };
  const word = () => match(/[\w$.]+/y);

  /* 여는 글자 다음부터 닫는 글자까지, 쉼표로 나뉜 항목을 읽는다 */
  function list(close, item) {
    const items = [];
    while (!eat(close)) {
      items.push(item());
      if (!eat(',')) {
        expect(close);
        break;
      }
    }
    return items;
  }

  /* devalue 는 문자열을 JSON 과 같은 방식으로 이스케이프한다 (<, U+2028, U+2029 는 \u 로 쓴다) */
  function string() {
    const begin = i;
    for (i += 1; html[i] !== '"'; i += html[i] === '\\' ? 2 : 1) if (i >= html.length) fail();
    i += 1;
    return JSON.parse(html.slice(begin, i));
  }

  function entry() {
    skip();
    const key = html[i] === '"' ? string() : word();
    expect(':');
    return [key, value()];
  }

  /* 인자가 본문 뒤에 있으므로, 본문을 한 번 건너뛰어 인자를 읽은 다음 본문을 다시 읽는다 */
  function hoisted() {
    expect('(function(');
    const names = list(')', word);
    expect('{');
    expect('return');
    const body = i;
    value();
    expect('}');
    expect('(');
    const args = list(')', value);
    expect(')');
    const end = i;
    names.forEach((name, index) => {
      scope[name] = args[index];
    });
    i = body;
    const result = value();
    i = end;
    return result;
  }

  function value() {
    skip();
    const char = html[i];
    if (char === '"') return string();
    if (char === '[') {
      i += 1;
      return list(']', value);
    }
    if (char === '{') {
      i += 1;
      return Object.fromEntries(list('}', entry));
    }
    if (char === '(') return hoisted();
    if (/[-.\d]/.test(char)) return Number(match(/-?(?:Infinity|NaN|[\d.]+(?:e[+-]?\d+)?)/y));
    const name = word();
    if (name === 'true') return true;
    if (name === 'false') return false;
    if (name === 'null') return null;
    if (name === 'void') {
      expect('0');
      return undefined;
    }
    if (name === 'new') word();
    /* 호출과 멤버 접근이 이어지면 끝까지 읽어 넘긴다: new Date(1), __sveltekit_x.defer(1), new Uint8Array([1]).buffer */
    let called = name === 'new';
    for (skip(); html[i] === '(' || html[i] === '.'; skip()) {
      called = true;
      if (html[i] === '.') word();
      else {
        i += 1;
        list(')', value);
      }
    }
    return !called && Object.prototype.hasOwnProperty.call(scope, name) ? scope[name] : undefined;
  }

  try {
    return value();
  } catch (error) {
    console.warn('[BaekjoonHub] 정올 페이지의 데이터를 읽지 못했습니다.', error);
    return null;
  }
}

/**
 * 읽은 데이터에서 key 를 가진 객체를 찾아 그 값을 돌려줍니다.
 * (SvelteKit 은 서버에서 받은 API 응답을 '$/submission/123' 같은 key 로 싣는다)
 * @param {any} node
 * @param {string} key
 * @param {boolean} [prefix=false] - true 면 key 로 시작하는 이름을 찾는다 (질의가 붙는 '$/submission?…')
 * @returns {any} 없으면 undefined
 */
function findLoaded(node, key, prefix = false) {
  if (isNull(node) || typeof node !== 'object') return undefined;
  const own = Object.keys(node).find((name) => (prefix ? name.startsWith(key) : name === key));
  if (own !== undefined) return node[own];
  for (const child of Object.values(node)) {
    const found = findLoaded(child, key, prefix);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * 정올 페이지를 받아 거기 실린 데이터를 읽습니다.
 * @param {string} path - 받을 주소 (같은 출처)
 * @returns {Promise<Array>} kit.start 에 넘긴 data 배열
 */
async function fetchLoaded(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`정올 페이지를 받지 못했습니다 (${response.status})`);
  const nodes = readSvelteKitData(await response.text());
  if (isNull(nodes)) throw new Error('정올 페이지의 데이터를 읽지 못했습니다');
  return nodes;
}

/**
 * 제출 상세를 업로드할 데이터로 만듭니다.
 * README 에 문제 본문은 싣지 않는다. 정올 약관(제10조)이 서비스에서 얻은 정보를 승낙 없이 복제해 제3자에게 주는 것을 금지하고,
 * 회원에게 권리가 있는 것은 제출한 코드다(제17조).
 * @param {object} detail - 제출 상세 ($/submission/번호 의 data)
 * @returns {Promise<({problemId, directory, message, fileName, readme, code}|null)>} 코드를 볼 수 없는 제출이면 null
 */
async function makeData(detail) {
  /* 코드를 볼 수 없는 제출은 source 가 파일 목록이 아니라 안내 문구(문자열)다 */
  const code = detail.source?.[0]?.source;
  if (typeof code !== 'string' || isNull(detail.problemInfo)) return null;
  const problemId = `${detail.problemId}`;
  const { title } = detail.problemInfo;
  const safeTitle = convertSingleCharToDoubleChar(title);
  const [language, extension] = jungolLanguage(detail.language);
  const levelFull = solvedTierName(detail.problemInfo.fTier ?? detail.problemInfo.tier?.tier);
  const level = levelFull.split(' ')[0];
  const directory = await buildDirectory('jungol', {
    platform: '정올',
    level,
    levelFull,
    id: problemId,
    title: safeTitle,
    language,
    _defaultDir: `정올/${level}/${problemId}. ${safeTitle}`,
  });
  const message = `[${levelFull}] Title: ${title}, Time: ${detail.m_time} ms, Memory: ${detail.m_memory} KB -BaekjoonHub`;
  const fileName = `${safeTitle}.${extension}`;
  // prettier-ignore
  const readme =
    `# [${levelFull}] ${title} - ${problemId} \n\n`
    + `[문제 링크](https://jungol.co.kr/problem/${problemId}) \n\n`
    + `### 성능 요약\n\n메모리: ${detail.m_memory} KB, 시간: ${detail.m_time} ms\n\n`
    + `### 제출 일자\n\n${getDateString(new Date(detail.additional?.time ?? Date.now()))}\n\n`
    + `> 출처: 정올(JUNGOL), https://jungol.co.kr/`;
  return { problemId, directory, message, fileName, readme, code };
}
