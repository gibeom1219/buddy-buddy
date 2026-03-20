require('dotenv').config();

const express = require('express');
const { handleEvent } = require('./chatHandler');
const { handleCallback } = require('./jiraOAuth');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// 헬스체크 (Cloud Run 상태 확인용)
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'buddy-buddy' });
});

// Jira OAuth 1.0a 콜백
app.get('/oauth/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;

  if (!oauth_token || !oauth_verifier) {
    return res.status(400).send('잘못된 요청입니다.');
  }

  try {
    await handleCallback(oauth_token, oauth_verifier);
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>✅ Jira 인증 완료!</h2>
        <p>Google Chat으로 돌아가서 다시 질문해주세요.</p>
      </body></html>
    `);
  } catch (err) {
    console.error('OAuth 콜백 오류:', err.message);
    res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>❌ 인증 실패</h2>
        <p>${err.message}</p>
      </body></html>
    `);
  }
});

// Google Chat 이벤트 수신 엔드포인트
app.post('/', handleEvent);

app.listen(PORT, () => {
  console.log(`버디버디 서버 실행 중: http://localhost:${PORT}`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
});
