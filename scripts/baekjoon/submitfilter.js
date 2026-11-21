(function () {
  'use strict';

  const DEBUG = false;

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
    {
      text: 'numeric_limits',
      rule: 'board/166494',
      tip: '백준허브: 이 부분(numeric_limits)이 들어 있으면 제출이 거부(403)된다는 사용자 제보가 있습니다(확인되지 않음). 제출이 거부되면 이 부분을 바꿔 보세요.',
    },
    {
      regex: /<[^\w<>]{0,8}(?:[^<>\"'\s]{0,32}:)?[^\w<>]{0,8}\W{0,8}?(?:(?:a\W{0,8}?(?:n\W{0,8}?i\W{0,8}?m\W{0,8}?a\W{0,8}?t\W{0,8}?e|p\W{0,8}?p\W{0,8}?l\W{0,8}?e\W{0,8}?t|u\W{0,8}?d\W{0,8}?i\W{0,8}?o)|b\W{0,8}?(?:i\W{0,8}?n\W{0,8}?d\W{0,8}?i\W{0,8}?n\W{0,8}?g\W{0,8}?s|a\W{0,8}?s\W{0,8}?e|o\W{0,8}?d\W{0,8}?y)|i?\W{0,8}?f\W{0,8}?r\W{0,8}?a\W{0,8}?m\W{0,8}?e|o\W{0,8}?b\W{0,8}?j\W{0,8}?e\W{0,8}?c\W{0,8}?t|i\W{0,8}?m\W{0,8}?a?\W{0,8}?g\W{0,8}?e?|e\W{0,8}?m\W{0,8}?b\W{0,8}?e\W{0,8}?d|p\W{0,8}?a\W{0,8}?r\W{0,8}?a\W{0,8}?m|v\W{0,8}?i\W{0,8}?d\W{0,8}?e\W{0,8}?o|l\W{0,8}?i\W{0,8}?n\W{0,8}?k)[^>\w]|s\W{0,8}?(?:c\W{0,8}?r\W{0,8}?i\W{0,8}?p\W{0,8}?t|t\W{0,8}?y\W{0,8}?l\W{0,8}?e|e\W{0,8}?t[^>\w]|v\W{0,8}?g)|m\W{0,8}?(?:a\W{0,8}?r\W{0,8}?q\W{0,8}?u\W{0,8}?e\W{0,8}?e|e\W{0,8}?t\W{0,8}?a[^>\w])|f\W{0,8}?o\W{0,8}?r\W{0,8}?m)/gi,
      rule: '941160',
      tip:
        '백준허브: 이 부분은 HTML 태그 같은 글(<script, <style, <svg, <form, <iframe, <object, <embed, <set< 등)이라, ' +
        '들어 있으면 백준 서버가 제출을 거부(403)하는 것으로 알려져 있습니다. 제출하려면 이 부분을 바꿔 주세요.',
      hintOf: (matched) => (/s\W{0,8}?e\W{0,8}?t[^>\w]$/i.test(matched) ? 'set' : ''),
      hints: { set: '예: vector<set<int>> 는 using S = set<int>; 로 이름을 붙여 vector<S> 처럼 쓰면 됩니다.' },
    },
  ];

  const MAX_LENGTH = 64 * 1024;
  const MAX_HITS = 200;
  const DEBOUNCE_MS = 250;
  const POLL_MS = 200;
  const POLL_LIMIT_MS = 5000;
  const HIT_CLASS = 'bjh-filter-hit';
  const TIP_CLASS = 'bjh-filter-tooltip';
  const INDEX_ATTR = 'data-bjh-pattern';
  const VARIANT_ATTR = 'data-bjh-variant';

  const MATCHERS = PATTERNS.map((p) => p.regex || new RegExp(p.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));

  function log(...args) {
    if (DEBUG) console.log('[BaekjoonHub submitfilter]', ...args);
  }

  function findHits(text) {
    const hits = [];
    MATCHERS.forEach((re, index) => {
      for (const m of text.matchAll(re)) {
        if (hits.length > MAX_HITS) return;
        const variant = PATTERNS[index].hintOf ? PATTERNS[index].hintOf(m[0]) : '';
        hits.push({ index, variant, start: m.index, end: m.index + m[0].length });
      }
    });
    return hits.sort((a, b) => a.start - b.start);
  }

  let tip = null;

  function hideTip() {
    if (tip) tip.remove();
    tip = null;
  }

  function showTip(markEl) {
    hideTip();
    const index = markEl.getAttribute(INDEX_ATTR);
    const pattern = PATTERNS[/^\d+$/.test(index) ? Number(index) : -1];
    if (!pattern) return;
    const rect = markEl.getBoundingClientRect();
    tip = document.createElement('div');
    tip.className = TIP_CLASS;
    tip.setAttribute('role', 'tooltip');
    const hint = pattern.hint || (pattern.hints && pattern.hints[markEl.getAttribute(VARIANT_ATTR)]);
    tip.textContent =
      (pattern.tip ||
        `백준허브: 이 부분(${pattern.text})이 들어 있으면 백준 서버가 제출을 거부(403)하는 것으로 알려져 있습니다. ` +
          `제출하려면 이 부분을 바꿔 주세요.`) + (hint ? ` ${hint}` : '');
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
        hideTip();
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
                attributes: { [INDEX_ATTR]: String(h.index), [VARIANT_ATTR]: h.variant },
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
