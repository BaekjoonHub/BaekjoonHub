/**
 * 백준허브 디렉토리 경로 처리 및 업로드 기능 테스트 스크립트
 * 
 * 이 스크립트는 모든 플랫폼(백준, 프로그래머스, SWEA, 구름레벨)에서 디렉토리 경로 생성 및 업로드 기능이
 * 올바르게 작동하는지 테스트합니다.
 */

import { UploadService } from '../UploadService.js';
import { EnhancedTemplateService } from '../template/enhancedTemplate.js';
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from '../storage.js';

/**
 * 각 플랫폼별 테스트 데이터
 */
const testData = {
  // 백준 테스트 데이터
  baekjoon: {
    platform: '백준',
    problemId: '1000',
    title: '더하기',
    level: 'Bronze V',
    language: 'Python',
    code: 'a, b = map(int, input().split())\nprint(a + b)',
    memory: '30840 KB',
    runtime: '68 ms',
    submissionTime: '2023년 10월 25일 12:34:56',
    problem_tags: ['수학', '구현', '사칙연산'],
    problem_description: 'A+B를 출력하는 문제',
    defaultDir: '백준/Bronze V/1000. 더하기'
  },
  
  // 프로그래머스 테스트 데이터
  programmers: {
    platform: '프로그래머스',
    problemId: '42583',
    title: '다리를 지나는 트럭',
    level: '2',
    language: 'JavaScript',
    code: 'function solution(bridge_length, weight, truck_weights) {\n    let answer = 0;\n    return answer;\n}',
    memory: '32.1 MB',
    runtime: '0.22 ms',
    submissionTime: '2023년 10월 25일 13:45:12',
    division: '코딩테스트 연습/스택&큐',
    problem_description: '트럭이 다리를 건너는 문제',
    defaultDir: '프로그래머스/2/42583. 다리를 지나는 트럭'
  },
  
  // SWEA 테스트 데이터
  swea: {
    platform: 'SWEA',
    problemId: '1204',
    title: '최빈수 구하기',
    level: 'D2',
    language: 'C++',
    code: '#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}',
    memory: '13,540 KB',
    runtime: '7 ms',
    length: '156 Bytes',
    submissionTime: '2023-10-25 14:23:45',
    defaultDir: 'SWEA/D2/1204. 최빈수 구하기'
  },
  
  // 구름레벨 테스트 데이터
  goormlevel: {
    platform: 'goormlevel',
    examSequence: 123,
    quizNumber: 456,
    title: '거스름돈 문제',
    difficulty: 3,
    language: 'Java',
    code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}',
    memory: '32.5 MB',
    runtime: '65 ms',
    submissionTime: '2023년 10월 25일 15:12:34',
    defaultDir: 'goormlevel/123/456. 거스름돈 문제'
  }
};

/**
 * 각 플랫폼별 디렉토리 경로 생성 테스트
 */
async function testDirectoryGeneration() {
  console.log('--- 디렉토리 경로 생성 테스트 시작 ---');
  
  // 플랫폼별 테스트
  for (const [platform, data] of Object.entries(testData)) {
    // 1. 기본 경로
    console.log(`${platform} 기본 경로:`, data.defaultDir);
    
    // 2. 언어별 정리 옵션
    await saveObjectInLocalStorage({ BaekjoonHub_OrgOption: 'language' });
    const langDir = await EnhancedTemplateService.getDirNameWithTemplate(
      data.platform, 
      data.defaultDir, 
      data.language, 
      data
    );
    console.log(`${platform} 언어별 정리:`, langDir);
    
    // 3. 커스텀 템플릿 적용
    await saveObjectInLocalStorage({ BaekjoonHub_UseCustomTemplate: true });
    await saveObjectInLocalStorage({ 
      BaekjoonHub_DirTemplate: '{{platform}}/{{language}}/{{level}}/{{problemId}}_{{title}}' 
    });
    
    const customDir = await EnhancedTemplateService.getDirNameWithTemplate(
      data.platform, 
      data.defaultDir, 
      data.language, 
      data
    );
    console.log(`${platform} 커스텀 템플릿:`, customDir);
    
    console.log('---');
  }
  
  console.log('--- 디렉토리 경로 생성 테스트 완료 ---');
}

/**
 * 각 플랫폼별 업로드 처리 시뮬레이션
 */
async function simulateUpload() {
  console.log('--- 업로드 시뮬레이션 시작 ---');
  
  // 모의 콜백 함수
  const mockCallback = (branches, directory) => {
    console.log(`업로드 완료: ${directory}`);
  };
  
  // 각 플랫폼별 업로드 데이터 생성 및 시뮬레이션
  for (const [platform, data] of Object.entries(testData)) {
    console.log(`${platform} 업로드 준비...`);
    
    // 디렉토리 경로 생성
    const directory = await EnhancedTemplateService.getDirNameWithTemplate(
      data.platform, 
      data.defaultDir, 
      data.language, 
      data
    );
    
    // README 생성 (간단한 예시)
    const readme = `# ${data.title} - ${data.problemId}\n\n` +
      `[문제 링크](https://example.com/${data.problemId})\n\n` +
      `### 성능 요약\n\n` +
      `메모리: ${data.memory}, 시간: ${data.runtime}\n\n` +
      `### 제출 일자\n\n` +
      `${data.submissionTime}\n\n`;
    
    // 파일명 생성
    const extensions = {
      'Python': 'py',
      'JavaScript': 'js',
      'C++': 'cc',
      'Java': 'java'
    };
    const fileName = `${data.title}.${extensions[data.language]}`;
    
    // 커밋 메시지 생성
    const message = `[${data.level}] Title: ${data.title}, Time: ${data.runtime}, Memory: ${data.memory} -BaekjoonHub`;
    
    // 업로드 데이터 출력
    console.log(`플랫폼: ${data.platform}`);
    console.log(`디렉토리: ${directory}`);
    console.log(`파일명: ${fileName}`);
    console.log(`메시지: ${message}`);
    console.log('---');
    
    // 실제 환경에서는 UploadService.uploadProblem을 호출합니다.
    // 테스트 환경에서는 호출하지 않음
    // await UploadService.uploadProblem({
    //   code: data.code,
    //   readme,
    //   directory,
    //   fileName,
    //   message
    // }, mockCallback);
  }
  
  console.log('--- 업로드 시뮬레이션 완료 ---');
}

/**
 * 메인 테스트 실행
 */
async function runTests() {
  console.log('=== 백준허브 통합 테스트 시작 ===');
  
  // 1. 디렉토리 경로 생성 테스트
  await testDirectoryGeneration();
  
  // 2. 업로드 시뮬레이션
  await simulateUpload();
  
  console.log('=== 백준허브 통합 테스트 완료 ===');
}

// 테스트 실행
runTests().catch(error => {
  console.error('테스트 실행 중 오류가 발생했습니다:', error);
});
