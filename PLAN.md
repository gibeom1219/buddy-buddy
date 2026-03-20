# buddy-buddy 개발 계획

## 1차 목표
Google Workspace의 Google Chat / Space에 사내 임직원이 설치해서 사용하는 AI 챗봇 앱.
사용자가 `@버디버디` 를 멘션해 질문하면, Vertex AI(Gemini 2.5 Pro)가 답변을 생성해 돌려줌.

## 기술 스택
- **런타임**: Node.js 24 (LTS)
- **서버**: Express.js
- **AI**: Vertex AI — Gemini 2.5 Pro (`gemini-2.5-pro`)
- **GCP 프로젝트**: `tst-gbseo-gcp`
- **리전**: `asia-northeast3` (서울)
- **배포**: Cloud Run

## 동작 흐름
```
사용자 "@버디버디 질문"
  → Google Chat이 POST / 로 이벤트 전송
    → Bearer 토큰 검증 (production 환경)
      → Vertex AI Gemini 호출
        → 답변 JSON 응답 → Google Chat에 메시지 표시
```

## 이벤트 처리
| 이벤트 타입 | 동작 |
|---|---|
| `ADDED_TO_SPACE` | 환영 메시지 전송 |
| `MESSAGE` | 질문 수신 → Gemini 답변 → 응답 |
| `REMOVED_FROM_SPACE` | 무시 |

## 파일 구조
```
buddy-buddy/
├── src/
│   ├── index.js        # Express 서버
│   ├── chatHandler.js  # Google Chat 이벤트 처리
│   └── vertexai.js     # Vertex AI 클라이언트
├── Dockerfile
├── .env.example
└── PLAN.md
```

## Cloud Run 배포 순서

### 사전 준비 (GCP 콘솔)
1. Vertex AI API 활성화
2. Google Chat API 활성화
3. Cloud Run 서비스 계정에 `Vertex AI User` 역할 부여

### 배포 명령어
```bash
# 1. 이미지 빌드 & 푸시
gcloud builds submit --tag gcr.io/tst-gbseo-gcp/buddy-buddy

# 2. Cloud Run 배포
gcloud run deploy buddy-buddy \
  --image gcr.io/tst-gbseo-gcp/buddy-buddy \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,GCP_PROJECT_ID=tst-gbseo-gcp,GCP_LOCATION=asia-northeast3

# 3. 배포된 URL 확인 후 → SERVICE_URL 환경변수 업데이트
gcloud run services update buddy-buddy \
  --region asia-northeast3 \
  --set-env-vars SERVICE_URL=https://<배포된-URL>
```

### Google Chat 앱 등록 (Google Cloud Console)
1. Google Cloud Console → API 및 서비스 → Google Chat API → 구성
2. 앱 이름: `버디버디`
3. 연결 설정: HTTP 엔드포인트 URL = Cloud Run 서비스 URL
4. 권한: 도메인 내 설치 허용
