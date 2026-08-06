/**
 * 언어 폴더 마이그레이션 유틸 (#346).
 *
 * 언어별 정리(Organize by Language) 모드에서 플랫폼별 원시 언어 표기가 폴더명이 되어
 * 저장소 최상위에 Python/, Python3/, PyPy3/ 등이 파편화되어 온 것을, 확장 업데이트 시점에
 * 단일 커밋으로 표준 폴더(Python/)에 통합합니다.
 *
 * 동작 원칙:
 * - 계획(트리 조회)·base_tree·parent 를 같은 커밋(refSHA)에 고정하고 updateHead 를
 *   force:false 로 수행합니다. 그 사이 다른 커밋(다른 탭의 업로드 등)이 끼면 422 로 실패하며,
 *   플래그가 남지 않으므로 다음 stats 재구축 때 새 HEAD 기준으로 재시도됩니다(TOCTOU 차단).
 * - 이동은 기존 blob SHA 재사용 + 구 경로 삭제(sha: null)로 구성한 단일 트리 커밋이라 원자적입니다.
 * - 표준 경로에 같은 파일이 이미 있으면 구 사본을 삭제해 병합합니다(표준 파일 유지, 구 내용은
 *   git 히스토리에 보존). 같은 표준 경로를 노리는 구 사본이 여럿이면 CPython 계열(Python3 등)을
 *   PyPy 계열보다 우선 이동하고 나머지를 병합 삭제합니다.
 * - 마이그레이션 완료 플래그는 "커밋 직후"가 아니라 "표준 상태가 확인된 재구축"에서 기록합니다.
 *   커밋이 경합으로 유실되어도 다음 재구축이 재계획하므로 자가 치유됩니다.
 * - 재귀 트리가 truncated 인 극대형 레포는 불완전한 목록 기준의 쓰기가 위험하므로 보류합니다.
 *
 * 콘텐츠 스크립트에서는 전역 함수로 노출되고, Node 테스트에서는 module.exports 로 require
 * 가능합니다(dual-mode). manifest 의 각 플랫폼 content_scripts 에서 scripts/utils/pathNormalize.js
 * 이후, scripts/storage.js 이전에 로드되어야 합니다.
 */

// dual-mode 의존성 해석: 브라우저에선 pathNormalize.js 가 먼저 로드한 전역, Node 에선 require
const _normalizeLanguageNameForMigration =
  typeof normalizeLanguageName !== 'undefined'
    ? normalizeLanguageName
    : require('./pathNormalize.js').normalizeLanguageName;

/** 마이그레이션 완료 여부를 hook 별로 기록하는 스토리지 키. 값 형태: { [hook]: true } */
const LANG_MIGRATION_FLAG_KEY = 'BaekjoonHub_LangFolderMigration';

/**
 * @typedef LanguageMigrationPlan
 * @prop {Array<object>} treeEntries Git tree API 항목 — 이동(신규 경로+blob SHA 재사용)과 삭제(sha:null)
 * @prop {string[]} moved 표준 경로로 이동된 구 경로
 * @prop {string[]} merged 표준 경로에 파일이 이미 있어 병합 삭제된 구 경로
 * @prop {string[]} blocked 표준 경로의 조상이 파일(blob)이라 배치가 불가능해 보류된 구 경로
 */

/**
 * 재귀 트리에서 표준 폴더로 옮겨야 할 항목을 계산하는 순수 플래너입니다.
 * 최상위 세그먼트가 파이썬 계열 비표준 표기(Python3, PyPy3, 'Python 3' 등
 * {@link normalizeLanguageName} 이 'Python' 으로 판정하되 'Python' 자체는 제외)인
 * blob 만 대상으로 하며, 하위 경로는 그대로 보존합니다.
 * @param {Array<{path: string, sha: string, mode: string, type: string}>} treeItems - 재귀 트리 항목
 * @returns {LanguageMigrationPlan}
 */
function planLanguageFolderMigration(treeItems) {
  const blobs = (Array.isArray(treeItems) ? treeItems : []).filter((item) => item.type === 'blob');
  const existing = new Set(blobs.map((item) => item.path));
  const claimed = new Set(); // 이번 커밋에서 새로 생길 표준 경로
  const treeEntries = [];
  const moved = [];
  const merged = [];
  const blocked = [];

  const candidates = [];
  for (const item of blobs) {
    const slash = item.path.indexOf('/');
    if (slash < 0) continue; // 최상위 파일(README.md 등)
    const top = item.path.slice(0, slash);
    if (top === 'Python' || _normalizeLanguageNameForMigration(top) !== 'Python') continue;
    candidates.push({ item, top, newPath: `Python${item.path.slice(slash)}` });
  }
  // 같은 표준 경로를 두고 경합하면 CPython 계열(Python3 등)이 PyPy 계열보다 우선 이동한다.
  // (Array.prototype.sort 는 안정 정렬이라 같은 계열 안에서는 트리 순서가 유지된다.)
  candidates.sort((a, b) => {
    const rank = (top) => (top.toLowerCase().startsWith('pypy') ? 1 : 0);
    return rank(a.top) - rank(b.top);
  });

  // 세그먼트 경계 기준의 모든 조상 디렉토리 경로를 나열한다. ex) 'a/b/c' -> ['a', 'a/b']
  const ancestorsOf = (path) => {
    const list = [];
    for (let i = path.indexOf('/'); i >= 0; i = path.indexOf('/', i + 1)) {
      list.push(path.slice(0, i));
    }
    return list;
  };
  // 기존 blob 들이 함의하는 디렉토리 경로 집합 (파일 자리 ↔ 디렉토리 자리 양방향 충돌 판정용)
  const existingDirs = new Set();
  for (const p of existing) {
    for (const prefix of ancestorsOf(p)) existingDirs.add(prefix);
  }
  const claimedDirs = new Set(); // 이번 커밋에서 새로 생길 경로들이 함의하는 디렉토리

  for (const { item, newPath } of candidates) {
    const ancestors = ancestorsOf(newPath);
    // 배치 불가 판정(양방향). 구 사본을 지우면 살아남는 사본이 없으므로 보류하고 그대로 둔다:
    // (1) newPath 의 조상이 파일이면(기존 blob 또는 이번에 생길 blob — 예: 루트 'Python' 파일,
    //     'Python3/백준' 파일이 먼저 'Python/백준' 을 차지) 그 아래에 파일을 만들 수 없다.
    // (2) newPath 자리가 이미 디렉토리면(기존 blob 들의 조상 또는 이번에 생길 경로의 조상 —
    //     예: 'Python3/백준' 파일의 목적지 'Python/백준' 이 표준 폴더의 디렉토리) 파일을 만들 수 없다.
    const blockedByAncestorFile = ancestors.some((prefix) => existing.has(prefix) || claimed.has(prefix));
    const blockedByDirectory = existingDirs.has(newPath) || claimedDirs.has(newPath);
    if (blockedByAncestorFile || blockedByDirectory) {
      blocked.push(item.path);
      continue;
    }
    if (existing.has(newPath) || claimed.has(newPath)) {
      // 병합: 표준 파일을 유지하고 구 사본을 삭제한다(내용은 git 히스토리에 남음).
      treeEntries.push({ path: item.path, mode: item.mode, type: 'blob', sha: null });
      merged.push(item.path);
      continue;
    }
    claimed.add(newPath);
    for (const prefix of ancestors) claimedDirs.add(prefix);
    treeEntries.push({ path: newPath, mode: item.mode, type: 'blob', sha: item.sha });
    treeEntries.push({ path: item.path, mode: item.mode, type: 'blob', sha: null });
    moved.push(item.path);
  }
  return { treeEntries, moved, merged, blocked };
}

/**
 * 계획이 "더 할 일이 없는 표준 상태"인지 판정합니다. 이때에만 완료 플래그를 기록합니다.
 * (커밋 직후에는 기록하지 않음 — 다음 재구축이 표준 상태를 재확인한 뒤 기록한다.)
 * @param {LanguageMigrationPlan} plan
 * @returns {boolean}
 */
function isMigrationComplete(plan) {
  return plan.treeEntries.length === 0 && plan.blocked.length === 0;
}

/**
 * 언어별 정리 모드 사용자의 저장소에 파이썬 폴더 통합 마이그레이션을 수행합니다.
 * 완료 플래그가 기록될 때까지 stats 재구축마다 재검사하며, 예외는 호출부로 전파합니다 —
 * 호출부는 반드시 try/catch 로 감싸 실패가 stats 재구축을 막지 않게 해야 합니다.
 * @param {GitHub} git - GitHub API 래퍼 인스턴스
 * @param {string} hook - 연결된 저장소 (owner/repo)
 * @returns {Promise<boolean>} 마이그레이션 커밋이 실제로 생성되었으면 true
 */
async function runLanguageFolderMigrationIfNeeded(git, hook) {
  if (isNull(hook) || isNull(git)) return false;
  if ((await getOrgOption()) !== 'language') return false;
  const migrated = (await getObjectFromLocalStorage(LANG_MIGRATION_FLAG_KEY)) || {};
  if (migrated[hook] === true) return false;
  const markMigrated = async () => {
    migrated[hook] = true;
    await saveObjectInLocalStorage({ [LANG_MIGRATION_FLAG_KEY]: migrated });
  };

  const defaultBranch = await git.getDefaultBranchOnRepo();
  let refData;
  try {
    refData = await git.getReference(defaultBranch);
  } catch (e) {
    // 빈 레포(커밋 없음, 404/409): 구 폴더가 존재할 수 없고 이후 업로드는 전부 표준 폴더이므로 완료 처리
    if (e && (e.status === 404 || e.status === 409)) {
      await markMigrated();
      return false;
    }
    throw e;
  }
  const { refSHA, ref } = refData;

  // 계획·base_tree·parent 를 같은 커밋(refSHA)에 고정한다(TOCTOU 차단).
  const { tree, truncated } = await git.getTreeWithTruncation(refSHA);
  if (truncated) {
    log('language folder migration deferred: recursive tree truncated', hook);
    return false; // 불완전한 목록 기준의 쓰기는 위험 — 플래그 없이 보류
  }

  const plan = planLanguageFolderMigration(tree);
  if (plan.treeEntries.length > 0) {
    const treeData = await git.createTree(refSHA, plan.treeEntries);
    const commitSHA = await git.createCommit(
      'refactor: 언어 폴더 표준화 Python3·PyPy3 → Python (#346) -BaekjoonHub',
      treeData.sha,
      refSHA,
    );
    // force:false — refSHA 이후 다른 커밋이 끼었으면 422 로 실패시켜 그 커밋을 보호한다.
    await git.updateHead(ref, commitSHA, false);
    log('language folder migration committed', { hook, moved: plan.moved.length, merged: plan.merged.length, blocked: plan.blocked });
    return true;
  }
  if (isMigrationComplete(plan)) await markMigrated();
  return false;
}

// dual-mode: 브라우저 콘텐츠 스크립트에서는 전역 함수로, Node 테스트에서는 require 로 사용
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    planLanguageFolderMigration,
    isMigrationComplete,
    LANG_MIGRATION_FLAG_KEY,
  };
}
