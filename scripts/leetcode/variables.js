/* LeetCode 모듈의 전역 상수와 상태 정의 */

/**
 * LeetCode가 GraphQL 응답으로 돌려주는 lang slug → 파일 확장자.
 * `submissionDetails.lang.name` 값과 정확히 일치하는 키를 사용한다.
 */
const LC_LANG_EXT = {
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  python: 'py',
  python3: 'py',
  pythondata: 'py',
  csharp: 'cs',
  javascript: 'js',
  typescript: 'ts',
  ruby: 'rb',
  bash: 'sh',
  swift: 'swift',
  golang: 'go',
  scala: 'scala',
  kotlin: 'kt',
  rust: 'rs',
  php: 'php',
  racket: 'rkt',
  erlang: 'erl',
  elixir: 'ex',
  dart: 'dart',
  mssql: 'sql',
  mysql: 'sql',
  oraclesql: 'sql',
  postgresql: 'sql',
};

function getLeetCodeLanguageExtension(langSlug) {
  if (!langSlug) return 'txt';
  return LC_LANG_EXT[langSlug.toLowerCase()] || 'txt';
}

/* 업로드 진행 상태 (백준 모듈과 동일한 형태) */
const uploadState = { uploading: false };
const multiloader = { wrap: null, nom: null, denom: null };

/* polling 상태 — startSubmitPoller에서 사용 */
const lcPoller = { timer: null, baselineId: null, slug: null };

const debug = false;

/* 단일 문제 폴링 루프 파라미터 */
const LC_POLL_INTERVAL_MS = 2000;
const LC_POLL_MAX_ATTEMPTS = 20; // 약 40초
