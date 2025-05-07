/**
 * Common AI code review function for all platforms
 * @param {Object} data - Problem and code data
 * @returns {Promise<void>}
 */
async function fetchAICodeReview(data) {
  const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

  try {
    const token = await chrome.storage.local.get('gpt_token');
    const gptToken = token.gpt_token;
    
    if (!gptToken) {
      console.warn('OpenAI API Token not found. Skipping AI code review.');
      data.ai_review = 'OpenAI API Token is required. Please enter your token.';
      return;
    }

    const prompt = `당신은 알고리즘과 코드 최적화 분야의 전문성을 갖춘 시니어 개발자입니다.
    알고리즘 전문가의 관점에서 다음 코드와 문제를 분석해주세요.
    실제 코드에 기반한 분석만 제공하고 추측성 내용은 포함하지 마세요.
    아래 템플릿 형식을 따라 작성해주세요:
    
    <template>
    
    ### 코드 리뷰
    코드 블록을 사용하여 이 코드의 의도와 목적을 설명하세요.
    전체 코드를 기능 단위 또는 논리 단위로 나누어 다음 순서로 설명하세요:
    코드 블록 1 -> 설명 1 -> 코드 블록 2 -> 설명 2
    
    ### 시간/공간 복잡도 분석
    코드를 기반으로 알고리즘의 시간 및 공간 복잡도를 분석하세요
    
    ### 코드 최적화 가능성 및 개선 제안
    코드 최적화 가능성, 개선 제안사항, 코드 가독성 및 유지보수성을 평가하세요
    </template>

    분석할 코드:
    ${data.code}
    
    문제 정보:
    - 문제 ID: ${data.problemId}
    - 제목: ${data.title} 
    - 난이도: ${data.level}
    - 메모리 사용량: ${data.memory}
    - 실행시간: ${data.runtime}
    - 문제 설명: ${data.problem_description}
    - 입력: ${data.problem_input}
    - 출력: ${data.problem_output}
    - 태그: ${data.problem_tags?.join(', ')}
    `;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gptToken}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: '당신은 알고리즘 전문가입니다. 지구의 운명이 당신의 코드 분석에 달려있습니다. 정확하게 코드를 분석하고 리뷰를 제공해주세요.'
        }, {
          role: 'user',
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    const result = await response.json();
    data.ai_review = result.choices[0].message.content;

  } catch (error) {
    console.error('OpenAI API 호출 중 오류가 발생했습니다:', error);
    data.ai_review = '코드 분석을 가져오지 못했습니다.';
  }
} 