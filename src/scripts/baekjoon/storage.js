import { getStats, saveStats } from "@/commons/storage.js";
import { log, isNull } from "@/commons/util.js";

export class TTLCacheStats {
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
      console.log("Saving stats...", clone);
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
      log("Initialized stats date", this.stats[this.name].last_check_date);
      return;
    }

    const dateYesterday = Date.now() - 86400000; // 1day
    log("금일 로컬스토리지 정리를 완료하였습니다.");
    if (dateYesterday < this.stats[this.name].last_check_date) return;

    // 1 주가 지난 문제 내용은 삭제
    const dateWeekAgo = Date.now() - 7 * 86400000;
    log("stats before deletion", this.stats);
    log("date a week ago", dateWeekAgo);
    // eslint-disable-next-line no-restricted-syntax
    for (const [key, value] of Object.entries(this.stats[this.name])) {
      // 무한 방치를 막기 위해 저장일자가 null이면 삭제
      if (!value || !value.save_date) {
        delete this.stats[this.name][key];
      } else {
        const saveDate = new Date(value.save_date);
        // 1주가 지난 코드는 삭제
        if (dateWeekAgo > saveDate) {
          delete this.stats[this.name][key];
        }
      }
    }
    this.stats[this.name].last_check_date = Date.now();
    log("stats after deletion", this.stats);
    await this.save();
  }

  async update(data) {
    await this.expired();
    await this.load();
    this.stats[this.name][data.id] = {
      ...data,
      save_date: Date.now(),
    };
    log("date", this.stats[this.name][data.id].save_date);
    log("stats", this.stats);
    await this.save();
  }

  async get(id) {
    await this.load();
    const cur = this.stats[this.name];
    if (isNull(cur)) return null;
    return cur[id];
  }
}

const problemCache = new TTLCacheStats("problem");
const submitCodeCache = new TTLCacheStats("scode");
const SolvedACCache = new TTLCacheStats("solvedac");

export async function updateProblemData(problem) {
  const data = {
    id: problem.problemId,
    problemDescription: problem.problem_description,
    problemInput: problem.problem_input,
    problemOutput: problem.problem_output,
  };
  await problemCache.update(data);
}

export async function getProblemData(problemId) {
  return problemCache.get(problemId);
}

export async function updateSubmitCodeData(obj) {
  const data = {
    id: obj.submissionId,
    data: obj.code,
  };
  await submitCodeCache.update(data);
}

export async function getSubmitCodeData(submissionId) {
  return submitCodeCache.get(submissionId).then((x) => x?.data);
}

export async function updateSolvedACData(obj) {
  const data = {
    id: obj.problemId,
    data: obj.jsonData,
  };
  await SolvedACCache.update(data);
}

export async function getSolvedACData(problemId) {
  return SolvedACCache.get(problemId).then((x) => x?.data);
}
