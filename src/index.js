require('dotenv').config();

const express = require('express');
const { handleEvent } = require('./chatHandler');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// 헬스체크 (Cloud Run 상태 확인용)
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'buddy-buddy' });
});

// Google Chat 이벤트 수신 엔드포인트
app.post('/', handleEvent);

app.listen(PORT, () => {
  console.log(`버디버디 서버 실행 중: http://localhost:${PORT}`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
});
