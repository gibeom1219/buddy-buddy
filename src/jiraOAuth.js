const { OAuth } = require('oauth');
const { saveRequestToken, getRequestTokenData, deleteRequestToken, saveAccessToken } = require('./oauthStore');

const BASE_URL = process.env.JIRA_BASE_URL || 'https://pim.cyberlogitec.com/jira';
const CONSUMER_KEY = process.env.JIRA_CONSUMER_KEY || 'buddy-buddy';
const CALLBACK_URL = `${process.env.SERVICE_URL}/oauth/callback`;

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
    CALLBACK_URL,
    'RSA-SHA1'
  );
}

/**
 * OAuth 인증 시작 - 사용자에게 전달할 Jira 인증 URL 반환
 * @param {string} userId - Google Chat 사용자 ID
 * @returns {Promise<string>} - Jira 인증 URL
 */
async function initiateOAuth(userId) {
  const oa = createOAuthClient();

  return new Promise((resolve, reject) => {
    oa.getOAuthRequestToken((err, token, secret) => {
      if (err) return reject(new Error(`Request Token 발급 실패: ${JSON.stringify(err)}`));
      saveRequestToken(token, secret, userId);
      const authUrl = `${BASE_URL}/plugins/servlet/oauth/authorize?oauth_token=${token}`;
      resolve(authUrl);
    });
  });
}

/**
 * OAuth 콜백 처리 - Access Token 발급 및 저장
 * @param {string} requestToken
 * @param {string} verifier
 * @returns {Promise<string>} - 인증 완료된 userId
 */
async function handleCallback(requestToken, verifier) {
  const data = getRequestTokenData(requestToken);
  if (!data) throw new Error('만료되었거나 유효하지 않은 요청입니다. 다시 인증을 시도해주세요.');

  const oa = createOAuthClient();

  return new Promise((resolve, reject) => {
    oa.getOAuthAccessToken(requestToken, data.secret, verifier, (err, accessToken, accessSecret) => {
      if (err) return reject(new Error(`Access Token 발급 실패: ${JSON.stringify(err)}`));
      saveAccessToken(data.userId, accessToken, accessSecret);
      deleteRequestToken(requestToken);
      resolve(data.userId);
    });
  });
}

module.exports = { initiateOAuth, handleCallback };
