# SWEA browser regressions

From the repository root, run `python3 -m http.server 8766 --bind 127.0.0.1`,
then open `http://127.0.0.1:8766/tests/browser/sweaReview.html?pageIndex=2`.
The page reports four passing checks using the browser's native DOMParser and click events.

SWEA responses and GitHub writes are mocked locally; no login, extension installation,
or network request to either service is needed. Run `npm test` for the Node regression suite.
