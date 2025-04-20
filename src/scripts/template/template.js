// Import safe-template-parser
import { parseTemplateString } from 'safe-template-parser';

/**
 * Template parser for custom organization method
 * 
 * 사용 가능한 변수:
 * - problemId: 문제 번호
 * - title: 문제 제목
 * - level: 문제 난이도
 * - language: 프로그래밍 언어
 * - problem_tags: 문제 태그 배열
 * - submissionTime: 제출 시간
 * - memory: 메모리 사용량
 * - runtime: 실행 시간
 * 
 * 사용 가능한 함수:
 * - round: 반올림 함수
 * - abs: 절대값 함수
 * - max: 최대값 함수
 * - min: 최소값 함수
 * 
 * @param {string} templateString - 템플릿 문자열 (예: "백준/{{level.replace(/ .*/, '')}}/{{problemId}}. {{title}}")
 * @param {Object} data - 템플릿에서 사용할 데이터
 * @returns {string} - 파싱된 디렉토리 경로
 */
export function parseDirectoryTemplate(templateString, data) {
  try {
    return parseTemplateString(templateString, data);
  } catch (error) {
    console.error('템플릿 파싱 중 오류가 발생했습니다:', error);
    // 오류 발생 시 기본 템플릿 형식으로 반환
    return `백준/${data.level.replace(/ .*/, '')}/${data.problemId}. ${data.title}`;
  }
}

/**
 * 사용자 정의 템플릿을 사용하여 디렉토리 이름을 생성합니다.
 * 
 * @param {string} defaultDirName - 기본 디렉토리 이름
 * @param {string} language - 프로그래밍 언어
 * @param {Object} data - 문제 데이터
 * @returns {Promise<string>} - 생성된 디렉토리 경로
 */
export async function getDirNameByTemplate(defaultDirName, language, data) {
  try {
    // 로컬 스토리지에서 커스텀 템플릿 설정을 가져옵니다
    const customTemplate = await getObjectFromLocalStorage('BaekjoonHub_DirTemplate');
    
    // 커스텀 템플릿이 설정되어 있다면 사용하고, 아니면 기본값 사용
    if (customTemplate && customTemplate.trim() !== '') {
      const templateData = {
        problemId: data.problemId,
        title: data.title,
        level: data.level,
        language: language,
        problem_tags: data.problem_tags,
        submissionTime: data.submissionTime,
        memory: data.memory,
        runtime: data.runtime
      };
      
      return parseDirectoryTemplate(customTemplate, templateData);
    }
    
    // 설정된 템플릿이 없으면 기존 organization method 사용
    return defaultDirName;
  } catch (error) {
    console.error('템플릿 적용 중 오류가 발생했습니다:', error);
    return defaultDirName;
  }
}
