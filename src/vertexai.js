const { GoogleGenAI } = require('@google/genai');

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'tst-gbseo-gcp';
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const MODEL = 'gemini-2.5-pro';

const SYSTEM_INSTRUCTION = '당신은 사내 AI 어시스턴트 버디버디입니다. 임직원들의 질문에 친절하고 정확하게 답변해주세요. 답변은 간결하고 명확하게 작성해주세요.';

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

/**
 * 새 대화 세션을 시작합니다.
 */
function startChat() {
  return ai.chats.create({
    model: MODEL,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
    },
  });
}

/**
 * 대화 세션에 메시지를 보내고 답변을 반환합니다.
 * @param {object} session - startChat()으로 생성한 세션
 * @param {string} question - 사용자 질문
 * @returns {Promise<string>} - AI 답변
 */
async function sendMessage(session, question) {
  const response = await session.sendMessage({ message: question });
  const text = response.text;

  if (!text) {
    throw new Error('Vertex AI로부터 응답을 받지 못했습니다.');
  }

  return text;
}

/**
 * 사용자 질문이 Jira 검색이 필요한지 판단하고, 필요하면 JQL을 반환합니다.
 * Jira 검색이 불필요하면 null을 반환합니다.
 * @param {string} question - 사용자 질문
 * @returns {Promise<string|null>} - JQL 문자열 또는 null
 */
async function generateJQL(question) {
  const prompt = `사용자 질문을 분석해서 Jira 이슈 검색이 필요한지 판단하세요.

사용자 질문: "${question}"

Jira 검색이 필요하다면 적절한 JQL 쿼리만 반환하세요.
Jira 검색이 필요하지 않다면 "null"만 반환하세요.

규칙:
- 이슈, 버그, 작업, 티켓, jira, 스프린트, 이력 등과 관련된 질문이면 JQL을 반환
- 프로젝트 필터는 사용하지 말 것 (사용자 접근 가능한 프로젝트 전체 검색)
- 텍스트 검색은 text ~ "키워드" 형식 사용
- 최신순 정렬: ORDER BY updated DESC
- JQL 외 다른 텍스트는 절대 포함하지 말 것

예시:
- "로그인 오류 관련 이슈 찾아줘" → text ~ "로그인 오류" ORDER BY updated DESC
- "최근 해결된 버그 보여줘" → status = Done AND type = Bug ORDER BY updated DESC
- "오늘 날씨 어때?" → null`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const result = response.text?.trim();
  if (!result || result === 'null') return null;
  return result;
}

/**
 * Jira 이슈 데이터를 바탕으로 질문에 답변합니다.
 * @param {string} question - 사용자 질문
 * @param {string} jiraContext - issuesToText()로 변환된 이슈 텍스트
 * @returns {Promise<string>} - AI 답변
 */
async function analyzeJiraResults(question, jiraContext) {
  const prompt = `다음은 Jira에서 검색된 이슈 목록입니다:

${jiraContext}

위 Jira 이슈들을 바탕으로 다음 질문에 답변해주세요:
"${question}"

답변 시 이슈 키(예: ABC-123)를 함께 언급해주세요.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });

  const text = response.text;
  if (!text) throw new Error('Vertex AI로부터 응답을 받지 못했습니다.');
  return text;
}

module.exports = { startChat, sendMessage, generateJQL, analyzeJiraResults };
