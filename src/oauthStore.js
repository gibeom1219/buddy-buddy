/**
 * 메모리 기반 OAuth 토큰 저장소
 * Cloud Run 재시작 시 초기화됨 → 추후 Firestore로 교체 예정
 */

// requestToken → { userId, secret } 임시 저장 (OAuth 인증 진행 중)
const requestTokenMap = new Map();

// userId → { token, secret } 영구 저장 (인증 완료된 사용자)
const accessTokenMap = new Map();

function saveRequestToken(requestToken, secret, userId) {
  requestTokenMap.set(requestToken, { userId, secret });
}

function getRequestTokenData(requestToken) {
  return requestTokenMap.get(requestToken);
}

function deleteRequestToken(requestToken) {
  requestTokenMap.delete(requestToken);
}

function saveAccessToken(userId, token, secret) {
  accessTokenMap.set(userId, { token, secret });
}

function getAccessToken(userId) {
  return accessTokenMap.get(userId);
}

function deleteAccessToken(userId) {
  accessTokenMap.delete(userId);
}

module.exports = {
  saveRequestToken,
  getRequestTokenData,
  deleteRequestToken,
  saveAccessToken,
  getAccessToken,
  deleteAccessToken,
};
