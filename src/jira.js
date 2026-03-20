const { OAuth } = require('oauth');
const { getAccessToken } = require('./oauthStore');

const BASE_URL = process.env.JIRA_BASE_URL || 'https://pim.cyberlogitec.com/jira';
const CONSUMER_KEY = process.env.JIRA_CONSUMER_KEY || 'buddy-buddy';

function getPrivateKey() {
  const b64 = process.env.JIRA_PRIVATE_KEY_BASE64;
  if (!b64) throw new Error('JIRA_PRIVATE_KEY_BASE64 환경변수가 설정되지 않았습니다.');
  return Buffer.from(b64, 'base64').toString('utf8');
}

function createOAuthClient() {
  return new OAuth(
    `${BASE_URL}/plugins/servlet/oauth/request-token`,
    `${BASE_URL}/plugins/servlet/oauth/access-token`,
    CONSUMER_KEY,
    getPrivateKey(),
    '1.0',
    null,
    'RSA-SHA1'
  );
}

/**
 * 사용자 토큰으로 JQL 검색을 수행합니다.
 * @param {string} jql - JQL 쿼리
 * @param {string} userId - Google Chat 사용자 ID
 * @param {number} maxResults - 최대 결과 수
 */
async function searchIssues(jql, userId, maxResults = 15) {
  const tokenData = getAccessToken(userId);
  if (!tokenData) {
    const err = new Error('NO_TOKEN');
    err.code = 'NO_TOKEN';
    throw err;
  }

  const oa = createOAuthClient();
  const url = `${BASE_URL}/rest/api/2/search`;
  const body = JSON.stringify({
    jql,
    maxResults,
    fields: [
      'summary', 'description', 'status', 'assignee', 'reporter',
      'priority', 'created', 'updated', 'project', 'comment', 'resolution',
    ],
  });

  return new Promise((resolve, reject) => {
    oa.post(url, tokenData.token, tokenData.secret, body, 'application/json', (err, data) => {
      if (err) return reject(new Error(`Jira API 오류: ${JSON.stringify(err)}`));
      try {
        const parsed = JSON.parse(data);
        resolve(parsed.issues || []);
      } catch (e) {
        reject(new Error('Jira 응답 파싱 실패'));
      }
    });
  });
}

/**
 * 이슈 목록을 Vertex AI에 전달하기 좋은 텍스트로 변환합니다.
 */
function issuesToText(issues) {
  if (!issues.length) return '검색된 이슈가 없습니다.';

  return issues.map((issue) => {
    const f = issue.fields;
    const comments = f.comment?.comments?.slice(-3)
      .map((c) => `  - ${c.author?.displayName}: ${c.body?.slice(0, 200)}`)
      .join('\n') || '';

    return [
      `[${issue.key}] ${f.summary}`,
      `  상태: ${f.status?.name} | 우선순위: ${f.priority?.name} | 프로젝트: ${f.project?.name}`,
      `  담당자: ${f.assignee?.displayName || '미지정'} | 보고자: ${f.reporter?.displayName}`,
      `  생성: ${f.created?.slice(0, 10)} | 수정: ${f.updated?.slice(0, 10)}`,
      f.description ? `  설명: ${f.description.slice(0, 300)}` : '',
      comments ? `  최근 댓글:\n${comments}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

module.exports = { searchIssues, issuesToText };
