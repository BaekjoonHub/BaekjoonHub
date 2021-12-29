<h1 align="center">
  <img src="assets/thumbnail.png" alt="BaekjoonHub - Automatically sync your code to GitHub." width="400">
  <br>
  BaekjoonHub - Automatically sync your code to GitHub.
  <br>
  <br>
</h1>

<p align="center">
  <a href="https://github.com/flaxinger/BaekjoonHub/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"/></a>
  <a href="https://chrome.google.com/webstore/detail/baekjoonhub/ccammcjdkpgjmcpijpahlehmapgmphmk"><img src="https://img.shields.io/chrome-web-store/v/ccammcjdkpgjmcpijpahlehmapgmphmk.svg" alt="chrome-webstore"/></a>
  <a href="https://chrome.google.com/webstore/detail/baekjoonhub/ccammcjdkpgjmcpijpahlehmapgmphmk"><img src="https://img.shields.io/chrome-web-store/d/ccammcjdkpgjmcpijpahlehmapgmphmk.svg" alt="users"></a>
  <a href="https://github.com/flaxinger/BaekjoonHub/graphs/contributors" alt="Contributors">
    <img src="https://img.shields.io/github/contributors/flaxinger/BaekjoonHub" />
</a>

 

</p>

## 지금 크롬 마켓에서 확인하세요!
<table style="border-collapse: separate;"><tr>
  <td style="border-spacing:2em 0"> 
      <a href="https://chrome.google.com/webstore/detail/BaekjoonHub/ccammcjdkpgjmcpijpahlehmapgmphmk">
        <img src="https://external-content.duckduckgo.com/iu/?u=http%3A%2F%2Fimg.talkandroid.com%2Fuploads%2F2014%2F10%2Fchrome_web_store_logo_new.png&f=1&nofb=1" alt="Chrome WebStore" height=100 width=200/>
      </a>  
  </td>
</tr></table>

## 백준허브란?(What is BaekjoonHub?)

<p>백준 허브는 LeetCode의 개인 풀이를 github에 자동 푸시해주는 <a href="https://github.com/QasimWani/LeetHub">LeetHub</a>에서 영감을 받아 만든 프로젝트입니다. 백준을 통해 알고리즘 공부를 하시는 분들이 보다 쉽게 코드를 저장하고 관리할 수 있도록 하기 위해 만들었으며, 오픈소스 프로젝트로 여러분의 조언과 참여를 환영합니다.()</p>
<p>BaekjoonHub is a chrome extension that automatically pushes your code to GitHub when you pass all tests on a <a href="https://www.acmicpc.net/">Baekjoon Online Judge</a> problem. This project was based off of <a href="https://github.com/QasimWani/LeetHub">LeetHub</a>, a similar extension for Leetcode.</p>
<a href="https://github.com/flaxinger/BOJAutoPush"> 예시 Repository</a>

## 작동방식(How it works)

![](assets/extension/output.gif)

### 1. 업로드 시점
<p> 백준허브는 제출 페이지가 감지되면 작동합니다. 제출이 정담임이 확인되었다면 '맞았습니다!!'라는 문구 옆에 로딩 아이콘이 뜨게 되며 Github에 업로드가 완료되면 초록색 완료표시가 뜹니다(반면 문제가 있었다면 빨간색으로 표시됩니다). 현재는 한 문제당 한번의 푸시를 지원하고 있으며 이는 제출 목록의 첫번째 항목을 대상으로 합니다. 2022년 1월 안으로 업로드를 Github에 업데이트 해주는 기능을 추가할 예정입니다.</p>
<p> 더불어 앞서 설명되었든 제출 페이지가 감지되면 바로 파싱 후 업로드를 하기 때문에 기존에 해결하셨던 문제도 제출 화면을 켜시면 Github에 자동 업로드하실 수 있습니다. 다만 기존 제출 문제를 한번에 업로드해주는 기능 또한 현재 개발 중에 있어 급하지 않다면 마찬가지로 2022년 1월까지 기다려주시길 바랍니다.</p>

### 2. 저장되는 정보
문제 메타 정보
<ol>
  <li>제목</li>
  <li>문제 아이디</li>
  <li>문제 등급(Solved.ac 기준)</li>
  <li>문제 설명</li>
  <li>사용 언어</li>
  <li>문제 분류</li>
</ol>
제출 정보
<ol>
  <li>코드</li>
  <li>사용한 메모리</li>
  <li>실행 시간</li>
</ol>


## Setup 방식(How to set it up)
<ol>
  <li>크롬에서 설치 후 우측 상단의 popup 버튼을 클릭합니다.</li>
  <li>"Authorize with GitHub" 버튼을 누르면 Repository 연동 화면이 표시됩니다.</li>
  <li>신규 혹은 기존의 Repository를 선택하면 BaekjoonHub과 연동이 완료됩니다
    (기본값은 private으로 되어있습니다).</li>
  <li>이후 제출화면이 감지되면 자동으로 업로드됩니다</li>
</ol>

## 개발 참여

향후 과제를 확인하고 싶다면 [링크](https://github.com/flaxinger/BaekjoonHub/blob/main/TODO.md)를 확인하세요.



