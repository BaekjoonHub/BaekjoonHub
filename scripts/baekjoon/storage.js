/* eslint-disable no-unused-vars */
class TTLCacheStats {
  constructor(name) {
    this.name = name;
    this.stats = null;
    this.saveTimer = null;
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

  async save() {
    // 부하가 많이 일어나는 것을 막기 위해 1초에 한번만 저장
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(async () => {
      const clone = this.stats[this.name]; // 얇은 복사
      console.log('Saving stats...', clone);
      await this.forceLoad(); // 최신화
      this.stats[this.name] = clone; // 업데이트
      await saveStats(this.stats);
      this.saveTimer = null;
    }, 1000);
  }

  async expired() {
    await this.load();
    if (!this.stats[this.name].last_check_date) {
      this.stats[this.name].last_check_date = Date.now();
      this.save(this.stats);
      if (debug) console.log('Initialized stats date', this.stats[this.name].last_check_date);
      return;
    }

    const date_yesterday = Date.now() - 86400000; // 1day
    if (debug) console.log('금일 로컬스토리지 정리를 완료하였습니다.');
    if (date_yesterday < this.stats[this.name].last_check_date) return;

    // 1 주가 지난 문제 내용은 삭제
    const date_week_ago = Date.now() - 7 * 86400000;
    if (debug) console.log('stats before deletion', this.stats);
    if (debug) console.log('date a week ago', date_week_ago);
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
    if (debug) console.log('stats after deletion', this.stats);
    await this.save();
  }

  async update(data) {
    await this.expired();
    await this.load();
    this.stats[this.name][data.id] = {
      ...data,
      save_date: Date.now(),
    };
    if (debug) console.log('date', this.stats[this.name][data.id].save_date);
    if (debug) console.log('stats', this.stats);
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
