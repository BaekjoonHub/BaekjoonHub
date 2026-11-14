/**
 * 같은 문제를 다시 풀었을 때 서로 다른 풀이를 번호 붙은 파일로 모두 남기는 옵션(bjhKeepSolutionVersions, 기본 꺼짐)의 규칙.
 * 네 플랫폼의 단일 업로드(각 uploadfunctions.js 의 upload)가 함께 쓴다.
 *
 * 풀이 파일 이름이 `이름.확장자` 일 때 "버전" 은 같은 디렉토리의 `이름.확장자` 와 `이름_숫자.확장자` 다.
 * - 버전이 없으면 `이름.확장자` (지금과 같다)
 * - 코드가 어느 버전과 같으면(git blob SHA 비교, 지금의 스킵과 같다) 커밋하지 않는다
 * - 아니면 `이름_NNN.확장자`. NNN 은 가장 큰 번호 + 1 (번호 없는 파일은 1), 3자리 이상으로 0 을 채운다
 * 버전 목록은 로컬 캐시가 아니라 이번 커밋의 부모 커밋에 있는 파일에서 읽는다 — 다른 탭·기기가 그 사이 올린 파일과 번호가
 * 겹치지 않게 하려는 것이다. 커밋이 fast-forward 로 밀려 다시 시도되면(GitHub.commitTreeItems) 새 부모로 다시 정한다.
 */

/**
 * 파일 목록과 올릴 코드로 풀이를 어느 이름으로 저장할지 정합니다.
 * @param {Array<{name: string, sha: string}>} files - 풀이 디렉토리의 파일 (listDirectory)
 * @param {string} fileName - 이번 풀이 파일 이름 (예: '문제.py')
 * @param {string} code - 올릴 코드
 * @returns {{skip: true}|{fileName: string}} skip: 같은 코드가 이미 있다
 */
function planSolutionVersion(files, fileName, code) {
  const dot = fileName.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [fileName.slice(0, dot), fileName.slice(dot)] : [fileName, ''];
  const codeSHA = calculateBlobSHA(code);
  let highest = -1n; // -1: 버전 없음
  for (const { name, sha } of files) {
    if (name.length < stem.length + ext.length || !name.startsWith(stem) || !name.endsWith(ext)) continue;
    const middle = name.slice(stem.length, name.length - ext.length);
    if (middle !== '' && !/^_\d+$/.test(middle)) continue;
    if (sha === codeSHA) return { skip: true };
    const number = middle === '' ? 1n : BigInt(middle.slice(1));
    if (number > highest) highest = number;
  }
  if (highest < 0n) return { fileName };
  return { fileName: `${stem}_${(highest + 1n).toString().padStart(3, '0')}${ext}` };
}

/**
 * 업로드할 tree 항목을 옵션에 맞게 준비합니다. git.commitTreeItems 의 두 번째 인자로 `.items` 를 넘기고,
 * 커밋한 뒤 `.committed` 를 recordUploadInStats 에 넘기면 된다.
 * - 옵션이 꺼져 있으면 items 도 committed 도 넘긴 treeItems 그대로다(예전 동작).
 * - 켜져 있으면 items 는 함수다: 커밋의 부모에서 디렉토리를 읽어 풀이 파일의 경로를 바꾸거나(null 이면 커밋하지 않는다),
 *   committed 에는 마지막으로 정한 항목이 담긴다(커밋하지 않았으면 []).
 *   같은 코드가 이미 있으면 README·예제 파일도 올리지 않는다.
 * @param {GitHub} git
 * @param {string} directory - 풀이 디렉토리
 * @param {string} fileName - 풀이 파일 이름
 * @param {string} code - 올릴 코드
 * @param {Array<{path: string}>} treeItems - 풀이 파일(`${directory}/${fileName}`)을 포함한 올릴 항목
 * @returns {Promise<{items: Array|function, committed: Array}>}
 */
async function prepareSolutionItems(git, directory, fileName, code, treeItems) {
  const prepared = { items: treeItems, committed: treeItems };
  if (!(await getKeepSolutionVersionsOption())) return prepared;
  prepared.committed = [];
  prepared.items = async (headSHA) => {
    const plan = planSolutionVersion(await git.listDirectory(directory, headSHA), fileName, code);
    prepared.committed = plan.skip ? [] : treeItems.map((item) => (item.path === `${directory}/${fileName}` ? { ...item, path: `${directory}/${plan.fileName}` } : item));
    return plan.skip ? null : prepared.committed;
  };
  return prepared;
}

/**
 * 파일 하나의 tree 항목을 만듭니다. 옵션이 꺼져 있으면 예전처럼 blob 을 먼저 만들고, 켜져 있으면 같은 코드라서 커밋하지
 * 않을 수도 있으므로 blob 을 미리 만들지 않고 content 를 tree 에 직접 싣는다(전체 업로드와 같은 방식).
 * @param {GitHub} git
 * @param {string} content
 * @param {string} path
 * @returns {Promise<{path: string, mode: string, type: string, sha?: string, content?: string}>}
 */
async function createSolutionItem(git, content, path) {
  if (await getKeepSolutionVersionsOption()) return { path, mode: '100644', type: 'blob', content };
  return git.createBlob(content, path);
}
