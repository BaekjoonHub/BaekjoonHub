# Path-normalization parity fixtures (issue #337)

These fixtures back `tests/pathNormalize.test.js`, which proves that the promoted
`scripts/utils/pathNormalize.js` produces **byte-identical** output to the pre-#337
behavior in `scripts/storage.js`.

- **`originalFilters.cjs`** — the four path filters extracted *verbatim* from
  `scripts/storage.js` as they existed before this refactor (the literal U+2005 byte in
  the space filter is preserved). This is the reference implementation the differential
  test compares against. Do not hand-edit.

- **`realPaths.txt`** — repo-relative paths harvested from recently-updated public
  BaekjoonHub-generated repositories: ~99 repos sampled via the GitHub tree API, plus the
  full path tree of [`oneplast/ProgrammersCT`](https://github.com/oneplast/ProgrammersCT).
  Covers all four platforms (백준 / 프로그래머스 / SWEA / goormlevel) with ≥30 cases each —
  **2,673 unique paths** in total. Includes real-world edge cases: sub-leveled tiers
  (`Silver V`), `프로그래머스/Lv.1`, goorm `examId` folders (bare multi-digit), SWEA
  fullwidth titles (`A＋B`), and date-template folders. The differential test asserts these
  paths are unchanged vs. the pre-#337 implementation — **except** the sub-tier / `Lv.N`
  paths, which #344 intentionally normalizes (old→new transition characterized explicitly).

## BOJ live page (`boj/`)

- **`boj/problem-1000.html`** — `https://acmicpc.net/problem/1000` as served to a logged-out browser on
  2026-11-20, after BOJ reopened on the apex host (`www.acmicpc.net` answers 301). The contributor
  usernames in the 출처 section are replaced with `testerN`; nothing else is edited. Backs
  `tests/baekjoonHost.test.js`.
