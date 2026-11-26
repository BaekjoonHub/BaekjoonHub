/* eslint-disable no-unused-vars */
/* 받은 문제·제출 코드·solved.ac 응답은 stats 안의 캐시 셋에 일주일 동안 둔다. 전체 업로드가 오류나 탭 닫힘으로 멈춰도 받은 것을
   다시 요청하지 않도록, 항목이 계속 들어오는 중에도 3초마다 저장한다(예전에는 마지막 항목 뒤 1초가 지나야 저장해, 끝나기 전에
   멈추면 받은 것을 모두 잃었다). 캐시마다 stats 를 따로 읽고 쓰면 서로의 새 항목을 덮으므로 바뀐 캐시를 모아 한 번에 저장한다. */
const TTL_CACHE_SAVE_MS = 3000;
const ttlCachesUnsaved = new Set();
let ttlCacheSaveTimer = null;

function saveTTLCaches() {
  if (ttlCacheSaveTimer) return;
  ttlCacheSaveTimer = setTimeout(() => {
    ttlCacheSaveTimer = null;
    const caches = [...ttlCachesUnsaved];
    ttlCachesUnsaved.clear();
    updateStats((stats) => {
      for (const cache of caches) stats[cache.name] = cache.stats[cache.name];
    }).catch((error) => console.warn('[BaekjoonHub] 문제·코드 캐시를 저장하지 못했습니다.', error));
  }, TTL_CACHE_SAVE_MS);
}

class TTLCacheStats {
  constructor(name) {
    this.name = name;
    this.stats = null;
  }

  async forceLoad() {
    this.stats = await getStats();
    if (isNull(this.stats[this.name])) {
      this.stats[this.name] = {};
    }
  }

  async load() {
    if (this.stats === null) {
      await this.forceLoad();
    }
  }

  save() {
    ttlCachesUnsaved.add(this);
    saveTTLCaches();
  }

  async expired() {
    await this.load();
    if (!this.stats[this.name].last_check_date) {
      this.stats[this.name].last_check_date = Date.now();
      this.save(this.stats);
      log('Initialized stats date', this.stats[this.name].last_check_date);
      return;
    }

    const date_yesterday = Date.now() - 86400000; // 1day
    log('금일 로컬스토리지 정리를 완료하였습니다.');
    if (date_yesterday < this.stats[this.name].last_check_date) return;

    // 1 주가 지난 문제 내용은 삭제
    const date_week_ago = Date.now() - 7 * 86400000;
    log('stats before deletion', this.stats);
    log('date a week ago', date_week_ago);
    // eslint-disable-next-line no-restricted-syntax
    for (const [key, value] of Object.entries(this.stats[this.name])) {
      // 무한 방치를 막기 위해 저장일자가 null이면 삭제
      if (!value || !value.save_date) {
        delete this.stats[this.name][key];
      } else {
        const save_date = new Date(value.save_date);
        // 1주가 지난 코드는 삭제
        if (date_week_ago > save_date) {
          delete this.stats[this.name][key];
        }
      }
    }
    this.stats[this.name].last_check_date = Date.now();
    log('stats after deletion', this.stats);
    await this.save();
  }

  async update(data) {
    await this.expired();
    await this.load();
    this.stats[this.name][data.id] = {
      ...data,
      save_date: Date.now(),
    };
    log('date', this.stats[this.name][data.id].save_date);
    log('stats', this.stats);
    await this.save();
  }

  async get(id) {
    await this.load();
    const cur = this.stats[this.name];
    if (isNull(cur)) return null;
    return cur[id];
  }
}

const problemCache = new TTLCacheStats('problem');
const submitCodeCache = new TTLCacheStats('scode');
const SolvedACCache = new TTLCacheStats('solvedac');

async function updateProblemsFromStats(problem) {
  const data = {
    id: problem.problemId,
    problem_description: problem.problem_description,
    problem_input: problem.problem_input,
    problem_output: problem.problem_output,
    samples: problem.samples || [],
  };
  await problemCache.update(data);
}

async function getProblemFromStats(problemId) {
  return problemCache.get(problemId);
}

async function updateSubmitCodeFromStats(obj) {
  const data = {
    id: obj.submissionId,
    data: obj.code,
  };
  await submitCodeCache.update(data);
}

async function getSubmitCodeFromStats(submissionId) {
  return submitCodeCache.get(submissionId).then((x) => x?.data);
}

async function updateSolvedACFromStats(obj) {
  const data = {
    id: obj.problemId,
    data: obj.jsonData,
  };
  await SolvedACCache.update(data);
}

async function getSolvedACFromStats(problemId) {
  return SolvedACCache.get(problemId).then((x) => x?.data);
}
