# Path-normalization parity fixtures (issue #337)

These fixtures back `tests/pathNormalize.test.js`, which proves that the promoted
`scripts/utils/pathNormalize.js` produces **byte-identical** output to the pre-#337
behavior in `scripts/storage.js`.

- **`originalFilters.cjs`** — the four path filters extracted *verbatim* from
  `scripts/storage.js` as they existed before this refactor (the literal U+2005 byte in
  the space filter is preserved). This is the reference implementation the differential
  test compares against. Do not hand-edit.

- **`realPaths.txt`** — repo-relative paths harvested from ~99 recently-updated public
  BaekjoonHub-generated repositories, covering all four platforms (백준 / 프로그래머스 /
  SWEA / goormlevel) with ≥30 cases each, plus edge cases: `백준/새싹`, sub-leveled tiers
  (`Silver V`), `프로그래머스/Lv.1`, goorm `examId` folders (bare multi-digit), SWEA
  fullwidth titles, and date-template folders. Used to confirm `normalizePath` is unchanged
  on real-world data.
