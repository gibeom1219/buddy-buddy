const { OAuth2Client } = require('google-auth-library');
const { startChat, sendMessage, generateJQL, analyzeJiraResults } = require('./vertexai');
const { searchIssues, issuesToText } = require('./jira');
const { initiateOAuth } = require('./jiraOAuth');
const { getAccessToken } = require('./oauthStore');

const authClient = new OAuth2Client();

const CHAT_ISSUER_DOMAIN = '@gcp-sa-gsuiteaddons.iam.gserviceaccount.com';

// 스페이스별 대화 세션 저장
const chatSessions = new Map();

async function verifyGoogleChatToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization 헤더 없음');
  }

  const token = authHeader.slice(7);
  const audience = process.env.SERVICE_URL;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[DEV] 토큰 검증 건너뜀');
    return;
  }

  const ticket = await authClient.verifyIdToken({ idToken: token, audience });
  const payload = ticket.getPayload();

  if (!payload.email?.endsWith(CHAT_ISSUER_DOMAIN) || !payload.email_verified) {
    throw new Error('유효하지 않은 Google Chat 토큰입니다.');
  }
}

function chatResponse(text) {
  return {
    hostAppDataAction: {
      chatDataAction: {
        createMessageAction: {
          message: { text },
        },
      },
    },
  };
}

async function handleEvent(req, res) {
  try {
    await verifyGoogleChatToken(req.headers.authorization);
  } catch (err) {
    console.error('토큰 검증 실패:', err.message);
    return res.status(401).json({ error: '인증 실패' });
  }

  const event = req.body;
  const chat = event.chat;

  // 봇이 스페이스에 추가되었을 때
  if (chat?.addedToSpacePayload) {
    console.log('이벤트: ADDED_TO_SPACE');
    return res.json(chatResponse(
      '안녕하세요! 저는 사내 AI 어시스턴트 버디버디입니다 👋\n궁금한 점이 있으면 편하게 질문해주세요!'
    ));
  }

  // 메시지를 받았을 때
  if (chat?.messagePayload?.message) {
    const messageData = chat.messagePayload.message;
    const question = (messageData.argumentText || messageData.text)?.trim();
    const spaceName = messageData.space?.name || 'default';
    const userId = chat.user?.name || 'unknown';

    console.log(`이벤트: MESSAGE | 스페이스: ${spaceName}`);
    console.log(`질문: ${question}`);

    if (!question) {
      return res.json(chatResponse('질문 내용을 입력해주세요.'));
    }

    try {
      // 1단계: Jira 검색 필요 여부 판단 및 JQL 생성
      const jql = await generateJQL(question);

      if (jql) {
        console.log(`[Jira 검색] JQL: ${jql}`);

        // 사용자 토큰 확인
        const tokenData = getAccessToken(userId);
        if (!tokenData) {
          const authUrl = await initiateOAuth(userId);
          return res.json(chatResponse(
            `Jira 검색을 위해 인증이 필요합니다.\n아래 링크를 클릭해서 Jira 계정으로 로그인해주세요:\n${authUrl}\n\n인증 완료 후 다시 질문해주세요.`
          ));
        }

        const issues = await searchIssues(jql, userId);
        const context = issuesToText(issues);
        console.log(`[Jira 검색] ${issues.length}개 이슈 검색됨`);
        const answer = await analyzeJiraResults(question, context);
        console.log(`답변 생성 완료 (${answer.length}자)`);
        return res.json(chatResponse(answer));
      }

      // 2단계: 일반 질문 → 대화 세션으로 처리
      if (!chatSessions.has(spaceName)) {
        chatSessions.set(spaceName, startChat());
        console.log(`[새 대화 시작] ${spaceName}`);
      } else {
        console.log(`[대화 이어서] ${spaceName}`);
      }

      const session = chatSessions.get(spaceName);
      const answer = await sendMessage(session, question);

      console.log(`답변 생성 완료 (${answer.length}자)`);
      return res.json(chatResponse(answer));
    } catch (err) {
      console.error('오류:', err.message);
      return res.json(chatResponse('죄송합니다, 답변 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    }
  }

  // 봇이 스페이스에서 제거되었을 때
  if (chat?.removedFromSpacePayload) {
    console.log('이벤트: REMOVED_FROM_SPACE');
    const spaceName = chat.removedFromSpacePayload.space?.name;
    if (spaceName) chatSessions.delete(spaceName);
    return res.json({});
  }

  return res.json({});
}

module.exports = { handleEvent };
