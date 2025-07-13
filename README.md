<h1 align="center">
  <img src="assets/thumbnail.png" alt="BaekjoonHub - Automatically sync your code to GitHub." width="400">
  <br>
  BaekjoonHub - Automatically sync your code to GitHub.
  <br>
  <br>
</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"/></a>
  <a href="https://chrome.google.com/webstore/detail/ccammcjdkpgjmcpijpahlehmapgmphmk"><img src="https://img.shields.io/chrome-web-store/v/ccammcjdkpgjmcpijpahlehmapgmphmk.svg" alt="chrome-webstore"/></a>
  <a href="https://chrome.google.com/webstore/detail/ccammcjdkpgjmcpijpahlehmapgmphmk"><img src="https://img.shields.io/chrome-web-store/d/ccammcjdkpgjmcpijpahlehmapgmphmk.svg" alt="users"></a>
</p>

## 목차

1. [크롬 마켓](#지금-크롬-마켓에서-확인하세요)
2. [백준허브란?](#백준허브란what-is-baekjoonhub)
3. [설치 및 연동](#설치-및-연동how-to-set-it-up)
4. [작동 원리](#작동원리how-it-works)
    1. [동작 화면](#1-동작-화면)
    2. [업로드 시점](#2-업로드-시점)
    3. [백준 제출 기준](#3-백준-제출-기준)
    4. [저장되는 정보](#4-저장되는-정보)
5. [링크 및 문서](#링크-및-문서)

   <br />
   <br />

<!--- 마켓  --->

## 지금 크롬 마켓에서 확인하세요!

<a href="https://chrome.google.com/webstore/detail/ccammcjdkpgjmcpijpahlehmapgmphmk">
  <img src="assets/extension/bookmark1.png" alt="BaekjoonHub - Automatically sync your code to GitHub."/>
</a>

<a href="https://chrome.google.com/webstore/detail/ebcggjojbiojfmiaammkfbdgmlpfflig">
  <img src="assets/extension/bookmark2.png" alt="BaekjoonHub - Automatically sync your code to GitHub."/>
</a>

<!--- 소개 --->

## 백준허브란?(What is BaekjoonHub?)

<p>
  백준 허브는 LeetCode의 개인 풀이를 github에 자동 푸시해주는 <a href="https://github.com/QasimWani/LeetHub">LeetHub</a>에서 영감을 받아 만든 프로젝트입니다. <a href="https://www.acmicpc.net/">백준</a>, <a href="https://programmers.co.kr/">프로그래머스</a>, <a href="https://level.goorm.io/">goormlevel</a>를 통해 알고리즘 공부를 하시는 분들이 더욱 쉽게 코드를 저장하고 관리할 수 있게 하도록 만들었으며, 오픈소스 프로젝트로 여러분의 조언과 참여를 환영합니다.<br/>
</p>
<p>
  BaekjoonHub is a Chrome extension that automatically pushes your code to GitHub when you pass all tests on a <a href="https://www.acmicpc.net/">Baekjoon Online Judge</a> problem. This project was based off of <a href="https://github.com/QasimWani/LeetHub">LeetHub</a>, a similar extension for Leetcode.
</p>
👉 <a href="https://github.com/flaxinger/BOJAutoPush"> 예시 Repository</a> 보러 가기<br/>

<br />
<br />

<!--- 설치 및 연동 --->

## 설치 및 연동(How to set it up)

<ol>
  <li>크롬에서 설치 후 우측 상단의 popup 버튼을 클릭합니다.</li>
  <li>"Authorize with GitHub" 버튼을 누르고 인증을 완료하면 Repository 연동 화면이 표시됩니다.</li>
  <li>Repository를 신규로 만들거나 기존에 존재하는 Repository에 연동 가능합니다. (신규 Repository 생성시 visibility 기본값은 private으로 되어있습니다)</li>
  <li>디렉토리 구조를 플랫폼별로 또는 언어별로 하는 옵션이 있습니다.</li>
  <li>Get Started 버튼을 누르면 링크가 완료됩니다.</li>
  <li>이후 제출화면이 감지되면 자동으로 업로드됩니다.</li>
</ol>
<br />
<br />

<!--- 작동 원리 --->

## 작동원리(How it works)

<p>백준허브는 Github API를 이용합니다.</p>
<p>코드가 제출되면 정답여부를 식별하고 제출된 코드와 메타데이터를 파싱해서 Github API를 통해 Repository에 반영합니다.</p>

### 1. 동작 화면

![](assets/extension/Baekjoon.gif)

<div align="center">백준 동작 화면</div>
<br/>

![](assets/extension/Programmers.gif)

<div align="center">프로그래머스 동작 화면</div>
<br/>

![](assets/extension/SWExpertAcademy.gif)

<div align="center">SW Expert Academy 동작 화면</div>
<br/>

![](assets/extension/goormlevel.gif)

<div align="center">goormlevel 동작 화면</div>

### 2. 업로드 시점

<p>백준허브는 기본적으로 풀이 채점 후 정답임을 감지하여 작동합니다.</p>
<p>다만 SW Expert Academy 플랫폼은 정답을 맞추면 "백준허브로 업로드" 버튼이 생깁니다.</p>
<p>업로드 도중 페이지 이동은 권장드리지 않습니다.</p>

### 3. 백준 제출 기준

<p>백준의 경우 "내 제출" 목록을 정렬해서 가장 적합한 제출을 업로드하며 비교 요소는 아래와 같습니다.</p>

1. 서브태스크가 있는 문제일 경우 점수가 더 높은 제출
2. 실행시간이 짧은 제출
3. 사용메모리가 적은 제출
4. 코드길이가 짧은 제출
5. 제출번호가 더 큰 제출(i.e. 최신 제출)

### 4. 저장되는 정보

<p>플랫폼 별로 문제 해결 시 파싱 후 저장되는 정보는 다음과 같습니다.</p>

<table>
  <tbody>
    <tr>
      <th>플랫폼</th>
      <th align="center">문제 메타 정보</th>
      <th align="center">사용자 제출 정보</th>
    </tr>
    <tr>
      <td>백준</td>
      <td align="left">
        <li>문제 제목</li>
        <li>문제 아이디</li>
        <li>문제 링크</li>
        <li>문제 등급</li>
        <li>문제 설명</li>
        <li>사용 언어</li>
        <li>문제 분류</li>
      </td>
      <td align="left">
        <li>코드</li>
        <li>사용한 메모리</li>
        <li>실행 시간</li>
      </td>
    </tr>
    <tr>
      <td>프로그래머스</td>
      <td align="left">
        <li>문제 제목</li>
        <li>문제 아이디</li>
        <li>문제 링크</li>
        <li>문제 등급</li>
        <li>문제 설명</li>
        <li>사용 언어</li>
      </td>
      <td align="left">
        <li>코드</li>
        <li>사용한 메모리</li>
        <li>실행 시간</li>
      </td>
    </tr>
    <tr>
      <td>SW Expert Academy</td>
      <td align="left">
        <li>문제 제목</li>
        <li>문제 아이디</li>
        <li>문제 링크</li>
        <li>문제 등급</li>
        <li>사용 언어</li>
      </td>
      <td align="left">
        <li>코드</li>
        <li>사용한 메모리</li>
        <li>실행 시간</li>
        <li>코드 길이</li>
      </td>
    </tr>
    <tr>
      <td>goormlevel</td>
      <td align="left">
        <li>문제 제목</li>
        <li>시험 아이디</li>
        <li>문제 아이디</li>
        <li>문제 링크</li>
        <li>사용 언어</li>
      </td>
      <td align="left">
        <li>코드</li>
        <li>사용한 메모리</li>
        <li>실행 시간</li>
      </td>
    </tr>
  </tbody>
</table>

<br />
<br />

<!--- 링크 및 문서 --->

## 링크 및 문서

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/BaekjoonHub/BaekjoonHub/issues" title="버그신고">
          <img src="./assets/readme_icons/bug.png" width="100" height="100" alt="버그 신고">
      </a><br/><sub><b>버그 신고</b></sub>
    </td>
    <td align="center">
      <a href="https://open.kakao.com/o/gOWn2ySd" title="카카오톡 협업방">
        <img src="./assets/readme_icons/kakao.png" width="100" height="100" alt="카카오톡 협업방">
      </a><br/><sub><b>카카오톡 협업방</b></sub>
    </td>
  </tr>
</table>

<br>
<br>