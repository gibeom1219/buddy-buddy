# 버디버디 (buddy-buddy)

Google Chat에서 `@버디버디`를 멘션하면 Vertex AI(Gemini 2.5 Pro)가 답변하는 사내 AI 어시스턴트입니다.

## 주요 기능

- Google Chat DM 및 Space에서 멘션으로 질문
- Gemini 2.5 Pro 기반 AI 답변
- Google Search 그라운딩으로 실시간 정보 검색
- 스페이스별 대화 히스토리 유지 (세션 메모리)
- Google Workspace Add-on 토큰 검증

## 기술 스택

| 항목 | 내용 |
|---|---|
| 런타임 | Node.js 24 |
| 서버 | Express.js |
| AI | Vertex AI — Gemini 2.5 Pro |
| GCP 프로젝트 | `tst-gbseo-gcp` |
| Vertex AI 리전 | `us-central1` |
| 배포 | Cloud Run (`asia-northeast3` 서울) |

## 동작 흐름

```
사용자 "@버디버디 질문"
  → Google Chat → POST /
    → Bearer 토큰 검증 (gcp-sa-gsuiteaddons)
      → Vertex AI Gemini 2.5 Pro + Google Search
        → 답변 반환 → Google Chat에 메시지 표시
```

## 이벤트 처리

| 이벤트 | payload 필드 | 동작 |
|---|---|---|
| 봇 추가 | `chat.addedToSpacePayload` | 환영 메시지 전송 |
| 메시지 | `chat.messagePayload.message` | Gemini 답변 생성 후 응답 |
| 봇 제거 | `chat.removedFromSpacePayload` | 세션 삭제 |

## 파일 구조

```
buddy-buddy/
├── src/
│   ├── index.js        # Express 서버 (포트 8080)
│   ├── chatHandler.js  # Google Chat 이벤트 처리 및 토큰 검증
│   └── vertexai.js     # Vertex AI Gemini 클라이언트
├── Dockerfile
├── .env.example
└── README.md
```

## 환경 변수

`.env.example`을 복사해 `.env`로 만들어 사용합니다.

```bash
cp .env.example .env
```

| 변수 | 설명 |
|---|---|
| `GCP_PROJECT_ID` | GCP 프로젝트 ID |
| `GCP_LOCATION` | Vertex AI 리전 |
| `SERVICE_URL` | Cloud Run 서비스 URL (토큰 검증 audience) |
| `NODE_ENV` | `development` / `production` |
| `PORT` | 서버 포트 (기본값 8080) |

## 로컬 개발

```bash
# 의존성 설치
npm install

# 서비스 계정 키 발급 후 .env에 경로 설정
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

# 개발 서버 실행 (파일 변경 감지)
npm run dev
```

> 로컬에서 Google Chat 이벤트를 수신하려면 cloudflared 등 터널링 도구가 필요합니다.

## Cloud Run 배포

### 사전 준비 (GCP 콘솔)

1. Vertex AI API 활성화
2. Google Chat API 활성화
3. Cloud Run 서비스 계정에 `Vertex AI User` IAM 역할 부여

### 배포 명령어

```bash
# 1. 이미지 빌드 & Cloud Run 배포 (한번에)
gcloud builds submit --tag gcr.io/tst-gbseo-gcp/buddy-buddy && \
gcloud run deploy buddy-buddy \
  --image gcr.io/tst-gbseo-gcp/buddy-buddy \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production,GCP_PROJECT_ID=tst-gbseo-gcp,GCP_LOCATION=us-central1,SERVICE_URL=https://buddy-buddy-64458639607.asia-northeast3.run.app
```

### Google Chat 앱 등록

1. Google Cloud Console → **Google Chat API** → **구성** 탭
2. 앱 이름: `버디버디`
3. 연결 설정: **HTTP 엔드포인트 URL** → Cloud Run 서비스 URL
4. 가시성: 도메인 내 허용 후 저장
