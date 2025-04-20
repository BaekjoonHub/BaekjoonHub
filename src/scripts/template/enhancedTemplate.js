import { parseTemplateString } from 'safe-template-parser';
import { getObjectFromLocalStorage } from '../storage.js';

/**
 * 모든 플랫폼에서 공통으로 사용할 수 있는 향상된 템플릿 시스템
 * 각 플랫폼별 데이터를 표준화된 형식으로 변환하여 일관된 디렉토리 구조 생성
 */
export class EnhancedTemplateService {
  /**
   * 이미 표준화된 문제 데이터를 활용합니다.
   * 각 플랫폼의 uploadfunctions.js에서 platform과 problemInfo 필드가 전달됩니다.
   * 
   * @param {string} platform - 플랫폼 이름 ('백준', '프로그래머스', 'SWEA', 'goormlevel')
   * @param {Object} data - 플랫폼별 문제 데이터
   * @returns {Object} - 템플릿에 사용할 데이터
   */
  static prepareTemplateData(platform, data) {
    // 기본 데이터 준비
    const templateData = {
      platform,
      language: data.language || '',
      ...data.problemInfo || {}
    };
    
    return templateData;
  }
  
  /**
   * 커스텀 템플릿을 사용하여 디렉토리 이름을 생성합니다.
   * 
   * @param {string} platform - 플랫폼 이름 ('백준', '프로그래머스', 'SWEA', 'goormlevel')
   * @param {string} defaultDirName - 기본 디렉토리 이름
   * @param {string} language - 프로그래밍 언어
   * @param {Object} data - 문제 데이터 (플랫폼 및 문제 메타정보 포함)
   * @returns {Promise<string>} - 생성된 디렉토리 경로
   */
  static async getDirNameWithTemplate(platform, defaultDirName, language, data) {
    try {
      // 템플릿에 사용할 데이터 준비
      const templateData = this.prepareTemplateData(platform, data);
      templateData.language = language; // 언어 정보 보장
      
      // 로컬 스토리지에서 커스텀 템플릿 설정을 가져옵니다
      const useCustomTemplate = await getObjectFromLocalStorage('BaekjoonHub_UseCustomTemplate');
      const customTemplate = await getObjectFromLocalStorage('BaekjoonHub_DirTemplate');
      
      // 커스텀 템플릿이 설정되어 있고 활성화되어 있다면 사용
      if (useCustomTemplate === true && customTemplate && customTemplate.trim() !== '') {
        return this.parseDirectoryTemplate(customTemplate, templateData);
      }
      
      // 언어별 정리 옵션 확인
      const orgOption = await getObjectFromLocalStorage('BaekjoonHub_OrgOption');
      if (orgOption === "language") {
        return `${language}/${defaultDirName}`;
      }
      
      // 기본 디렉토리 반환
      return defaultDirName;
    } catch (error) {
      console.error('템플릿 적용 중 오류가 발생했습니다:', error);
      return defaultDirName; // 오류 발생 시 기본 디렉토리 반환
    }
  }
  
  /**
   * 템플릿 문자열을 파싱하여 디렉토리 경로를 생성합니다.
   * 
   * @param {string} templateString - 템플릿 문자열
   * @param {Object} data - 템플릿에 사용할 데이터
   * @returns {string} - 파싱된 디렉토리 경로
   */
  static parseDirectoryTemplate(templateString, data) {
    try {
      return parseTemplateString(templateString, data);
    } catch (error) {
      console.error('템플릿 파싱 중 오류가 발생했습니다:', error);
      
      // 플랫폼별 기본 템플릿으로 대체
      switch (data.platform) {
        case '백준':
          return `백준/${data.level?.replace?.(/ .*/, '') || 'Unrated'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
        case '프로그래머스':
          return `프로그래머스/${data.level || '0'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
        case 'SWEA':
          return `SWEA/${data.level || 'Unrated'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
        case 'goormlevel':
          return `goormlevel/${data.examSequence || '0'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
        default:
          return `${data.platform || 'Unknown'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
      }
    }
  }
}
