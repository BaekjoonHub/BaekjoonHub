/**
 * 백준 제출 페이지(/submit/*)에서, 백준 서버가 거부(403)하는 것으로 알려진 문자열을 소스 편집기에 붉게 표시하고
 * 마우스를 올리면 안내(툴팁)를 보여 준다. 경고만 한다: 제출 폼과 버튼은 건드리지 않는다.
 *
 * 패턴 출처: OWASP CRS (https://github.com/coreruleset/coreruleset), 태그 v3.3.8,
 *   rules/REQUEST-941-APPLICATION-ATTACK-XSS.conf 의 규칙 941180 (paranoia-level/1) 의 @pm 단어 목록.
 *   Apache License 2.0 (licenses/coreruleset-LICENSE.txt). 가져온 날: 2026-11-21.
 *   원문에서 바뀐 점: 단어 아홉 개만 옮겼고, 규칙의 디코딩(urlDecodeUni 등)과 점수 계산은 옮기지 않았다.
 *
 * 편집기 객체(.CodeMirror 요소의 .CodeMirror 속성)는 페이지의 JS 세계에만 있어서, 콘텐츠 스크립트(baekjoon.js 의 injectPageScript)가
 * 제출 페이지에 이 파일을 <script src> 요소로 넣어 페이지 세계에서 돌린다(manifest 의 "world" 키는 Chrome 111 이상이라 쓰지 않는다).
 * 페이지 스크립트가 이 파일을 볼 수 있으니 전역에 아무것도 남기지 않는다.
 */
(function () {
  'use strict';

  const DEBUG = false;

  // 백준이 -->를 거부한다는 것은 위키(2차 자료)의 보고다. 나머지 단어는 같은 규칙에서 따온 추정이다.
  // shortcut: 소스에 적힌 그대로만 찾는다. 서버의 필터는 \x2d\x2d> 나 --&gt; 같은 인코딩도 풀어서 보므로 그건 놓친다.
  //   그런 사례가 제보되면 디코딩 단계를 추가한다.
  const PATTERNS = [
    { text: 'document.cookie', rule: '941180' },
    { text: 'document.write', rule: '941180' },
    { text: '.parentnode', rule: '941180' },
    { text: '.innerhtml', rule: '941180' },
    { text: 'window.location', rule: '941180' },
    { text: '-moz-binding', rule: '941180' },
    { text: '<!--', rule: '941180' },
    { text: '-->', rule: '941180', hint: '예: n --> 0 은 n-- > 0 처럼 띄어 쓰면 됩니다.' },
    { text: '<![cdata[', rule: '941180' },
  ];

  const MAX_LENGTH = 64 * 1024; // 이보다 긴 소스는 표시하지 않는다 (제출 한도이기도 하다)
  const MAX_HITS = 200;
  const DEBOUNCE_MS = 250;
  const POLL_MS = 200;
  const POLL_LIMIT_MS = 5000;
  const HIT_CLASS = 'bjh-filter-hit';
  const TIP_CLASS = 'bjh-filter-tooltip';
  const INDEX_ATTR = 'data-bjh-pattern';

  // 대소문자를 가리지 않는 글자 그대로의 일치. toLowerCase() 는 글자 수가 바뀔 수 있어(İ) 위치가 어긋나므로 RegExp 의 i 플래그를 쓴다.
  const MATCHERS = PATTERNS.map((p) => new RegExp(p.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));

  function log(...args) {
    if (DEBUG) console.log('[BaekjoonHub submitfilter]', ...args);
  }

  /** 소스에서 패턴이 나오는 모든 자리를 앞에서부터 돌려준다. MAX_HITS 를 넘으면 MAX_HITS + 1 개에서 멈춘다. */
  function findHits(text) {
    const hits = [];
    MATCHERS.forEach((re, index) => {
      for (const m of text.matchAll(re)) {
        if (hits.length > MAX_HITS) return;
        hits.push({ index, start: m.index, end: m.index + m[0].length });
      }
    });
    return hits.sort((a, b) => a.start - b.start);
  }

  let tip = null;

  function hideTip() {
    if (tip) tip.remove();
    tip = null;
  }

  // 툴팁은 .CodeMirror 의 overflow: hidden 에 잘리지 않게 body 의 자식으로 position: fixed 로 둔다.
  // 글은 패턴 데이터로만 만들고(사용자 소스 아님) textContent 로만 넣는다.
  function showTip(markEl) {
    hideTip();
    const index = markEl.getAttribute(INDEX_ATTR);
    const pattern = PATTERNS[/^\d+$/.test(index) ? Number(index) : -1]; // 속성이 없으면 Number(null) 이 0 이라 첫 패턴으로 오인한다
    if (!pattern) return;
    const rect = markEl.getBoundingClientRect();
    tip = document.createElement('div');
    tip.className = TIP_CLASS;
    tip.setAttribute('role', 'tooltip');
    tip.textContent =
      `백준허브: 이 부분(${pattern.text})이 들어 있으면 백준 서버가 제출을 거부(403)하는 것으로 알려져 있습니다. ` +
      `제출하려면 이 부분을 바꿔 주세요.` +
      (pattern.hint ? ` ${pattern.hint}` : '');
    tip.style.position = 'fixed';
    tip.style.left = `${Math.max(8, Math.min(rect.left, (document.documentElement.clientWidth || 1000) - 340))}px`;
    tip.style.top = `${rect.bottom + 6}px`;
    document.body.appendChild(tip);
  }

  function start(cm) {
    let marks = [];
    let timer = null;
    let stopped = false;

    function clearMarks() {
      const old = marks;
      marks = [];
      old.forEach((m) => {
        try {
          m.clear();
        } catch (e) {
          log('clear failed', e);
        }
      });
    }

    // 무엇이 던져도 표시를 걷고 멈춘다. 페이지(제출)에는 아무 영향도 주지 않는다.
    function stop(error) {
      log('stopped', error);
      stopped = true;
      clearTimeout(timer);
      hideTip();
      clearMarks();
      try {
        cm.off('change', schedule);
      } catch (e) {
        log('off failed', e);
      }
    }

    function run() {
      if (stopped) return;
      try {
        hideTip(); // 지워진 표시 위에서는 mouseout 이 오지 않는다
        cm.operation(() => {
          clearMarks();
          const text = cm.getValue();
          if (text.length > MAX_LENGTH) return;
          const hits = findHits(text);
          if (hits.length > MAX_HITS) return;
          for (const h of hits) {
            marks.push(
              cm.markText(cm.posFromIndex(h.start), cm.posFromIndex(h.end), {
                className: HIT_CLASS,
                attributes: { [INDEX_ATTR]: String(h.index) },
              })
            );
          }
        });
      } catch (e) {
        stop(e);
      }
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    }

    cm.on('change', schedule);
    document.addEventListener('mouseover', (e) => {
      try {
        const el = e.target && e.target.closest && e.target.closest(`.${HIT_CLASS}`);
        if (el && !stopped) showTip(el);
        else hideTip();
      } catch (err) {
        hideTip();
        log('tooltip failed', err);
      }
    });
    document.addEventListener('mouseout', hideTip);
    run();
  }

  // 편집기는 페이지 스크립트가 만들므로 나타날 때까지 5초 동안 기다린다. 없으면 아무것도 하지 않는다.
  function waitForEditor(waited) {
    try {
      const el = document.querySelector('.CodeMirror');
      if (el && el.CodeMirror) return start(el.CodeMirror);
    } catch (e) {
      return log('start failed', e);
    }
    if (waited < POLL_LIMIT_MS) setTimeout(() => waitForEditor(waited + POLL_MS), POLL_MS);
  }

  waitForEditor(0);
})();
