# Compass Crawler — Sensor Tower

Project Compass의 Bayesian Prior 데이터(장르 기대치)를 Sensor Tower에서 수집하는 로컬 CLI.

> **회사 내부 사용 한정.** ST 사내 구독 데이터를 가공한 결과물. 외부 배포·재판매 금지.

## 첫 실행 가이드

### 1. 의존성 설치

```bash
cd crawler
npm install
npx playwright install chromium
```

### 2. 환경 파일 준비

```bash
cp .env.example .env
# 필요시 .env 편집 (기본값으로 시작 권장)
```

> **주의**: 이메일/비밀번호는 의도적으로 받지 않습니다. 수동 로그인이 가장 안전합니다.

### 3. 로그인

```bash
npm run crawl:st:login
```

- 헤드 Chromium이 열림
- ST 로그인 페이지에서 직접 로그인 (2FA 포함 완료)
- 대시보드가 보이면 콘솔로 돌아와 Enter
- `crawler/storageState.json`에 세션 저장 (gitignore됨, chmod 600)

### 4. dry-run 검증

```bash
npm run crawl:st:dry
```

1개 게임만 수집해 stdout으로 출력. ST 웹 화면과 값 비교.

### 5. 풀 크롤

```bash
npm run crawl:st
```

Top 20 게임 수집 후 `src/shared/api/data/sensor-tower/merge-jp-snapshot.json` 갱신. 약 3-5분 소요.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|-------------|
| `세션이 유효하지 않습니다 (이유: missing)` | 첫 실행 — `npm run crawl:st:login` |
| `세션이 유효하지 않습니다 (이유: expired)` | 30일 경과 — 재로그인 |
| `XHR timeout for pattern: ...` | ST UI 변경 가능성. `crawler/docs/st-xhr-endpoints.md` 갱신 후 fetcher 패턴 수정 |
| `다른 크롤 인스턴스가 실행 중` | `crawler/.crawler.lock` 파일 수동 삭제 |
| `수집된 게임이 0개` | 모든 fetcher 실패. `crawler/debug-screenshots/` 확인 |

## 권장 운영

- 주 1회 (월요일 아침) 실행
- 결과 JSON git 커밋 → diff로 시장 변화 추적
- 14일 초과 시 Compass UI에 stale 배지 자동 노출

## ToS 및 보안 메모

- 이 도구는 **사내 ST 구독자**가 본인 계정으로 직접 로그인한 세션에서 동작
- 수집 결과는 사내 의사결정 용도로만 사용
- `storageState.json`, `.env`, `debug-screenshots/`는 `.gitignore`로 보호 — 절대 커밋 금지
- 비밀번호는 코드/환경변수에 저장하지 않음 (의도적 설계 결정)
