# 버디버디 (buddy-buddy)

사내 Google Chat AI 어시스턴트. Google Chat에서 `@버디버디`를 멘션하면 Vertex AI(Gemini)가 답변하고, Jira 이슈 검색/분석도 지원한다.

---

## 기술 스택

- **런타임**: Node.js v24 (nvm 사용)
- **프레임워크**: Express.js
- **AI**: Google Vertex AI — Gemini 2.5 Pro (`@google/genai` SDK)
- **배포**: Google Cloud Run (`asia-northeast3` 서울 리전)
- **GCP 프로젝트**: `tst-gbseo-gcp`
- **Jira**: 사내 Jira Server v8.20.1 (`https://pim.cyberlogitec.com/jira`) — OAuth 1.0a

---

## 소스 구조

```
src/
  index.js        Express 서버 진입점, /oauth/callback 라우트 포함
  chatHandler.js  Google Chat 이벤트 처리 (ADDED_TO_SPACE, MESSAGE)
  vertexai.js     Vertex AI 클라이언트 (채팅 세션, JQL 생성, Jira 분석)
  jira.js         Jira REST API 호출 (OAuth 서명 기반)
  jiraOAuth.js    Jira OAuth 1.0a 플로우 (인증 시작, 콜백 처리)
  oauthStore.js   사용자별 토큰 인메모리 저장소
```

---

## 환경변수 (.env.example 참고)

| 변수 | 설명 |
|---|---|
| `GCP_PROJECT_ID` | `tst-gbseo-gcp` |
| `GCP_LOCATION` | `us-central1` (Vertex AI 리전) |
| `SERVICE_URL` | `https://buddy-buddy-64458639607.asia-northeast3.run.app` |
| `NODE_ENV` | `production` / `development` |
| `PORT` | `8080` (Cloud Run 기본값) |
| `JIRA_BASE_URL` | `https://pim.cyberlogitec.com/jira` |
| `JIRA_CONSUMER_KEY` | `buddy-buddy` |
| `JIRA_PRIVATE_KEY_BASE64` | RSA 개인키를 base64로 인코딩한 값 |

**로컬 개발 시**: `.env` 파일 생성 후 위 값 입력 (git 제외됨)
**RSA 개인키 위치**: `~/workspaces/.info/jira_private.pem`
**base64 변환**: `cat ~/workspaces/.info/jira_private.pem | base64 -w 0`

---

## Cloud Run 배포

```bash
# 이미지 빌드 & 배포
cd ~/workspaces/buddy-buddy
gcloud builds submit --tag gcr.io/tst-gbseo-gcp/buddy-buddy
gcloud run deploy buddy-buddy \
  --image gcr.io/tst-gbseo-gcp/buddy-buddy \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production,GCP_PROJECT_ID=tst-gbseo-gcp,GCP_LOCATION=us-central1,SERVICE_URL=https://buddy-buddy-64458639607.asia-northeast3.run.app,JIRA_BASE_URL=https://pim.cyberlogitec.com/jira,JIRA_CONSUMER_KEY=buddy-buddy,JIRA_PRIVATE_KEY_BASE64=여기에_값_입력
```

---

## Google Chat 앱 등록 정보

- **등록 위치**: Google Cloud Console → `tst-gbseo-gcp` → Google Chat API → 구성
- **HTTP 엔드포인트**: `https://buddy-buddy-64458639607.asia-northeast3.run.app`
- **토큰 검증**: `@gcp-sa-gsuiteaddons.iam.gserviceaccount.com` 도메인 확인

---

## Jira OAuth 1.0a 설정 (사내 Jira 관리자에게 요청 필요)

- **설정 위치**: Jira 관리자 콘솔 → 설정 → 애플리케이션 → Application Links
- **Consumer Key**: `buddy-buddy`
- **Callback URL**: `https://buddy-buddy-64458639607.asia-northeast3.run.app/oauth/callback`
- **Public Key**: `~/workspaces/.info/jira_public.pem` 내용 전달

---

## 동작 흐름

### 일반 질문
```
사용자 메시지 → Google Chat 이벤트 → chatHandler
  → generateJQL() → null 반환 → Gemini 채팅 세션으로 답변
```

### Jira 질문
```
사용자 메시지 → chatHandler
  → generateJQL() → JQL 반환
    → 토큰 없음 → 인증 링크 전송
    → 토큰 있음 → Jira 검색 → Gemini 분석 → 답변
```

### Jira 인증 플로우
```
인증 링크 클릭 → Jira 로그인/승인
  → /oauth/callback → 토큰 저장 (인메모리)
    → "인증 완료" 페이지 표시 → 재질문 유도
```

---

## 브랜치 현황

| 브랜치 | 내용 |
|---|---|
| `main` | 1차 완료 — Google Chat + Vertex AI 기본 연동 |
| `feature/jira-oauth` | 진행 중 — Jira OAuth 1.0a 연동 (Jira 관리자 설정 대기 중) |

---

## 이슈 / 대기 중인 작업

- [ ] Jira 관리자에게 Application Link 등록 요청 전달 완료, **응답 대기 중**
- [ ] Jira OAuth 연동 테스트
- [ ] 토큰 저장소 인메모리 → Firestore 마이그레이션 (추후)
- [ ] Google Workspace 연동 (Gmail, Drive, Chat) — Workspace 관리자 도메인 위임 설정 필요
