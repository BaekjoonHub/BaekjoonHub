/* 백준 허브의 전역 변수 선언 파일입니다. */
/* 포함된 변수는 다음과 같습니다. 
    levels: 현재 등록된 프로그래머스 연습 문제의 레벨 구분입니다.
    uploadState: 현재 업로드 중인지를 저장하는 boolean입니다.
*/

/*
function get_csrf_token() {
  const csrfToken = document.querySelector('meta[name=csrf-token]').getAttribute('content');
  return csrfToken;
}

function get_levels() {
  let page = 1;

  fetch(`/learn/challenges/filter_lessons?page=1`, {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      'x-requested-with': 'XMLHttpRequest',
      'x-csrf-token': `${get_csrf_token()}`,
    },
  })
    .then((res) => res.text())
    .then((res) => {
      const html = /\$\('.algorithm-list'\).html\('(.*)'\);/.exec(res)[1];
      const doc = new DOMParser().parseFromString(html.replace(/\\"/g, '"').replace(/\\n/g, '').replace(/\\/g, ''), 'text/html');
      const last_page = [...doc.querySelectorAll('li.page-item:not(.next_page, .previous_page, .disabled)')].at(-1).innerText;
      // if (debug) console.log(doc);
      return Number(last_page) || 1;
    })
    .then((last_page) => {
      const fetches = [];
      for (let page = 1; page <= last_page; page++) {
        const data = new URLSearchParams();
        // data.set('challenge_statuses[]', 'solved');
        data.set('page', page);
        fetches.push(
          fetch(`/learn/challenges/filter_lessons?${data.toString()}`, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              'x-requested-with': 'XMLHttpRequest',
              'x-csrf-token': `${get_csrf_token()}`,
            },
          })
            .then((res) => res.text())
            .then((res) => {
              const result = [];
              const html = /\$\('.algorithm-list'\).html\('(.*)'\);/.exec(res)[1];
              const doc = new DOMParser().parseFromString(html.replace(/\\"/g, '"').replace(/\\n/g, '').replace(/\\/g, ''), 'text/html');
              // const isEnd = [...document.querySelector("li.next_page").classList].includes("disabled");
              // if (debug) console.log(doc);
              const cards = [...doc.querySelectorAll('div.card-algorithm')];
              console.log(cards);
              for (const card of cards) {
                const level =
                  card
                    .querySelector('span.level-badge')
                    .className.match(/(level-\d)/g, '')
                    ?.at(0)
                    .replace?.('level-', 'lv') || 'unrated';
                const problemId = card
                  .querySelector('a')
                  .getAttribute('href')
                  .match(/\d{3,}/)[0];
                result.push({ problemId, level });
              }
              console.log(result);
              return result;
            }),
        );
      }
      return Promise.all(fetches).then((res) => {
        const levels = {};
        for (const r of res) {
          for (const l of r) {
            levels[l.problemId] = l.level;
          }
        }
        console.log(levels);
        return levels;
      });
    });
}

get_levels();
*/

const levels = {
  1829: 'lv2',
  1830: 'lv3',
  1831: 'lv4',
  1832: 'lv3',
  1833: 'lv3',
  1834: 'lv5',
  1835: 'lv2',
  1836: 'lv3',
  1837: 'lv3',
  1838: 'lv3',
  1839: 'lv4',
  1840: 'lv5',
  1841: 'lv5',
  1842: 'lv5',
  1843: 'lv4',
  1844: 'lv2',
  1845: 'lv1',
  12899: 'lv2',
  12900: 'lv2',
  12901: 'lv1',
  12902: 'lv2',
  12903: 'lv1',
  12904: 'lv3',
  12905: 'lv2',
  12906: 'lv1',
  12907: 'lv3',
  12909: 'lv2',
  12910: 'lv1',
  12911: 'lv2',
  12912: 'lv1',
  12913: 'lv2',
  12914: 'lv2',
  12915: 'lv1',
  12916: 'lv1',
  12917: 'lv1',
  12918: 'lv1',
  12919: 'lv1',
  12920: 'lv3',
  12921: 'lv1',
  12922: 'lv1',
  12923: 'lv2',
  12924: 'lv2',
  12925: 'lv1',
  12926: 'lv1',
  12927: 'lv3',
  12928: 'lv1',
  12929: 'lv4',
  12930: 'lv1',
  12931: 'lv1',
  12932: 'lv1',
  12933: 'lv1',
  12934: 'lv1',
  12935: 'lv1',
  12936: 'lv2',
  12937: 'lv1',
  12938: 'lv3',
  12939: 'lv2',
  12940: 'lv1',
  12941: 'lv2',
  12942: 'lv3',
  12943: 'lv1',
  12944: 'lv1',
  12945: 'lv2',
  12946: 'lv2',
  12947: 'lv1',
  12948: 'lv1',
  12949: 'lv2',
  12950: 'lv1',
  12951: 'lv2',
  12952: 'lv2',
  12953: 'lv2',
  12954: 'lv1',
  12969: 'lv1',
  12971: 'lv3',
  12973: 'lv2',
  12974: 'lv5',
  12977: 'lv1',
  12978: 'lv2',
  12979: 'lv3',
  12980: 'lv2',
  12981: 'lv2',
  12982: 'lv1',
  12983: 'lv4',
  12984: 'lv4',
  12985: 'lv2',
  12987: 'lv3',
  17676: 'lv3',
  17677: 'lv2',
  17678: 'lv3',
  17679: 'lv2',
  17680: 'lv2',
  17681: 'lv1',
  17682: 'lv1',
  17683: 'lv2',
  17684: 'lv2',
  17685: 'lv4',
  17686: 'lv2',
  17687: 'lv2',
  42576: 'lv1',
  42577: 'lv2',
  42578: 'lv2',
  42579: 'lv3',
  42583: 'lv2',
  42584: 'lv2',
  42586: 'lv2',
  42587: 'lv2',
  42626: 'lv2',
  42627: 'lv3',
  42628: 'lv3',
  42746: 'lv2',
  42747: 'lv2',
  42748: 'lv1',
  42839: 'lv2',
  42840: 'lv1',
  42842: 'lv2',
  42860: 'lv2',
  42861: 'lv3',
  42862: 'lv1',
  42883: 'lv2',
  42884: 'lv3',
  42885: 'lv2',
  42888: 'lv2',
  42889: 'lv1',
  42890: 'lv2',
  42891: 'lv4',
  42892: 'lv3',
  42893: 'lv3',
  42894: 'lv4',
  42895: 'lv3',
  42897: 'lv4',
  42898: 'lv3',
  43105: 'lv3',
  43162: 'lv3',
  43163: 'lv3',
  43164: 'lv3',
  43165: 'lv2',
  43236: 'lv4',
  43238: 'lv3',
  49189: 'lv3',
  49190: 'lv5',
  49191: 'lv3',
  49993: 'lv2',
  49994: 'lv2',
  49995: 'lv4',
  59034: 'lv1',
  59035: 'lv1',
  59036: 'lv1',
  59037: 'lv1',
  59038: 'lv2',
  59039: 'lv1',
  59040: 'lv2',
  59041: 'lv2',
  59042: 'lv3',
  59043: 'lv3',
  59044: 'lv3',
  59045: 'lv4',
  59046: 'lv2',
  59047: 'lv2',
  59403: 'lv1',
  59404: 'lv1',
  59405: 'lv1',
  59406: 'lv2',
  59407: 'lv1',
  59408: 'lv2',
  59409: 'lv2',
  59410: 'lv2',
  59411: 'lv3',
  59412: 'lv2',
  59413: 'lv4',
  59414: 'lv2',
  59415: 'lv1',
  60057: 'lv2',
  60058: 'lv2',
  60059: 'lv3',
  60060: 'lv4',
  60061: 'lv3',
  60062: 'lv3',
  60063: 'lv3',
  62048: 'lv2',
  62050: 'lv4',
  62284: 'lv4',
  64061: 'lv1',
  64062: 'lv3',
  64063: 'lv4',
  64064: 'lv3',
  64065: 'lv2',
  67256: 'lv1',
  67257: 'lv2',
  67258: 'lv3',
  67259: 'lv3',
  67260: 'lv4',
  68644: 'lv1',
  68645: 'lv2',
  68646: 'lv3',
  68647: 'lv4',
  68935: 'lv1',
  68936: 'lv2',
  68937: 'lv4',
  68938: 'lv5',
  70128: 'lv1',
  70129: 'lv2',
  70130: 'lv3',
  70132: 'lv5',
  72410: 'lv1',
  72411: 'lv2',
  72412: 'lv2',
  72413: 'lv3',
  72414: 'lv3',
  72415: 'lv3',
  72416: 'lv4',
  76501: 'lv1',
  76502: 'lv2',
  76503: 'lv3',
  76504: 'lv5',
  77484: 'lv1',
  77485: 'lv2',
  77486: 'lv3',
  77487: 'lv3',
  77884: 'lv1',
  77885: 'lv2',
  77886: 'lv3',
  77887: 'lv5',
  81301: 'lv1',
  81302: 'lv2',
  81303: 'lv3',
  81304: 'lv4',
  81305: 'lv5',
  82612: 'lv1',
  84021: 'lv3',
  84512: 'lv2',
  86051: 'lv1',
  86052: 'lv2',
  86053: 'lv3',
  86054: 'lv4',
  86491: 'lv1',
  86971: 'lv2',
  87377: 'lv2',
  87389: 'lv1',
  87390: 'lv2',
  87391: 'lv3',
  87394: 'lv5',
  87694: 'lv3',
  87946: 'lv2',
  92334: 'lv1',
  92335: 'lv2',
  92341: 'lv2',
  92342: 'lv2',
  92343: 'lv3',
  92344: 'lv3',
  92345: 'lv3',
  118666: 'lv1',
  118667: 'lv2',
  118668: 'lv3',
  118669: 'lv3',
  118670: 'lv4',
};

/* state of upload for progress */
const uploadState = { uploading: false };
