## 변경 사항



## 체크리스트

- [ ] 기여자 목록에 추가할 내용이 있다면, 별도의 `docs: 기여자 목록에 X 추가` 커밋/PR을 만들지 않고
      `npx all-contributors-cli@6.26.1 add <github-id> <기여유형>` 실행 후 이 PR의 커밋에 포함했다.
- [ ] 이 PR이 릴리즈라면, `manifest.json` 과 `package.json` 의 `version` 을 같은 값으로 올렸다
      (master 에 바로 올릴 때는 `chore: v<버전> — <이 릴리즈가 고치는 것>` 커밋으로).
      릴리즈는 머지한 뒤 `gh workflow run release.yml --ref master` 로 하며, 릴리즈 노트에는 직전 릴리즈 태그 이후 master 에 들어간 커밋들의 제목이 들어간다.
