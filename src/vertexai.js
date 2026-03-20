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

module.exports = { startChat, sendMessage };
