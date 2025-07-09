# 기여 가이드 (CONTRIBUTING)

이 저장소는 기본적인 [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)와  
[Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/) 스타일을 따릅니다.

## Pull Request 규칙

- **모든 PR은 별도의 브랜치에서 작업 후 master 브랜치로 보내주세요.**
- **PR 제목은 반드시 [Conventional Commits](https://www.conventionalcommits.org/) 스타일**로 작성해주세요.
    - 예시:
      ```
      feat: 검색 기능 추가
      fix: 로그인 오류 수정
      docs: 사용법 문서 보완
      ```
- 변경 사항, 동작 방식, 테스트 방법 등 간략한 설명을 본문에 적어 주세요.
- PR을 머지하기 전에 반드시 리뷰를 받아야 합니다.  
  리뷰어는 프로젝트 관리자나 다른 기여자가 될 수 있습니다.

## 버전 관리 정책 (자동 릴리즈 기준)

릴리즈 자동화 도구는 PR/커밋 메시지의 변경 레벨에 따라 버전을 아래와 같이 결정합니다.

- **메이저(major):**
    - `feat!`, `fix!` 등 느낌표(!) 또는
    - 커밋 본문에 `BREAKING CHANGE:`
    - → **기존과 호환되지 않는 변화** (버전 앞자리가 1씩 올라감, 예: 2.x.x → 3.0.0)
- **마이너(minor):**
    - `feat:`
    - → **새로운 기능 추가** (중간 자리 1씩 올라감, 예: 2.1.0 → 2.2.0)
- **패치(patch):**
    - `fix:`
    - → **버그 수정** (마지막 자리 1씩 올라감, 예: 2.1.0 → 2.1.1)

### 우선순위

동일한 릴리즈 범위(=PR, 배포 기준)에 여러 종류의 커밋이 포함된 경우  
**아래 우선순위에 따라 가장 높은 레벨로 버전이 올라갑니다.**

1. `feat!`, `fix!`, `BREAKING CHANGE` → **메이저**
2. `feat` → **마이너**
3. `fix` → **패치**

## 자동 CHANGELOG 및 버전 관리 안내

- 이 저장소는 **CHANGELOG.md, release-please-manifest.json, package.json의 버전/릴리즈 정보**를  
  [release-please](https://github.com/googleapis/release-please) 등 자동화 도구로 관리합니다.
- **CHANGELOG.md, .release-please-manifest.json, package.json, manifest 등의 파일을 직접 수정하지 마세요.**
    - 버전 정보, CHANGELOG, 릴리즈 태그는 모두 자동 생성/업데이트됩니다.
    - 임의 수정을 하게 되면 충돌이나 자동화 오류가 발생할 수 있습니다.

> 버전 업, CHANGELOG 업데이트, 릴리즈 태그 생성 등은  
> PR 머지 및 릴리즈 자동화 워크플로우를 통해 자동 처리됩니다.

---

