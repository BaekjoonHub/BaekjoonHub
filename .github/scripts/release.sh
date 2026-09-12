#!/usr/bin/env bash
# 릴리즈 버전을 올리고 태그를 만드는 헬퍼.
#
# 사용법: .github/scripts/release.sh <새버전>   (예: .github/scripts/release.sh 1.4.20)
#
# 이 스크립트가 하는 일:
#   1. manifest.json / package.json 버전을 동기화
#   2. npm test 실행
#   3. 변경분을 "지금 HEAD" 커밋에 amend — 별도의 "chore: 버전 올림" 커밋을 만들지 않음
#   4. v<버전> 주석 태그 생성
#
# 전제: 아직 origin 에 푸시하지 않은 마지막 실질 커밋 위에서 실행한다.
#       (이미 푸시된 커밋을 amend 하면 이력이 갈라지므로 스크립트가 거부한다)
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "사용법: $0 <새버전> (예: $0 1.4.20)" >&2
  exit 1
fi
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "버전 형식이 올바르지 않습니다: $VERSION (X.Y.Z 형태여야 함)" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "워킹트리가 깨끗하지 않습니다. 먼저 커밋하거나 정리하세요." >&2
  exit 1
fi

if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "태그 v$VERSION 이 이미 존재합니다." >&2
  exit 1
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [[ -n "$UPSTREAM" ]] && git merge-base --is-ancestor HEAD "$UPSTREAM" 2>/dev/null; then
  echo "HEAD 가 이미 $UPSTREAM 에 푸시되어 있습니다. --amend 로 버전을 올리면 이력이" >&2
  echo "갈라집니다. 버전 올리기 전에 아직 푸시하지 않은 실질 커밋 위에서 실행하세요." >&2
  exit 1
fi

sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" manifest.json && rm -f manifest.json.bak
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json && rm -f package.json.bak

npm test

LAST_SUBJECT="$(git log -1 --pretty=%s)"
git add manifest.json package.json
git commit --amend --no-edit

git tag -a "v$VERSION" -m "v$VERSION: $LAST_SUBJECT"

cat <<EOF

버전 $VERSION 준비 완료 (커밋에 amend 됨, 태그 v$VERSION 생성됨).
확인 후 푸시하세요:
  git push --force-with-lease origin HEAD
  git push origin "v$VERSION"
EOF
