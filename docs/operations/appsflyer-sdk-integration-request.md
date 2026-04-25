# [의뢰 템플릿] AppsFlyer SDK lifecycle event 통합 요청

> **용도**: 새 게임의 빌드팀에 AppsFlyer SDK 통합을 요청할 때 메일 본문 템플릿. 게임명·App ID만 바꿔서 사용.
> **첫 사용**: Poco Merge (2026-04-24).

---

**받는 사람**: ikhoon@treenod.com → 빌드팀 forward
**제목**: [요청] {GAME_NAME} — AppsFlyer SDK lifecycle event 통합

---

안녕하세요,

Project Compass 대시보드에서 **{GAME_NAME}**의 Bayesian 통계 분석을 시작하려면
AppsFlyer SDK가 lifecycle event(`af_session`, `af_app_opened`)를 보내고 있어야 합니다.

## 현재 상태 (검증 결과)

- AppsFlyer Pull API v5의 `installs_report` 엔드포인트는 정상 동작 (200 OK 확인)
- 그러나 `in_app_events_report`는 14일 윈도우에서 데이터 0건
- **원인 추정**: 클라이언트에 AppsFlyer SDK가 통합되어 있지 않거나, `startSDK()`가 호출되지 않은 상태

## 빌드팀 요청 사항 (Unity 기준)

빈 GameObject에 다음 스크립트를 붙여서 한 번만 호출하면 됩니다:

```csharp
using AppsFlyerSDK;

public class AppsFlyerObjectScript : MonoBehaviour
{
  void Start()
  {
    AppsFlyer.initSDK("YOUR_DEV_KEY", "{APP_ID}");
    AppsFlyer.startSDK();
  }
}
```

이 두 줄(`initSDK` + `startSDK`)이 호출되면 다음이 자동으로 발생합니다:

- `af_install` (최초 launch)
- `af_app_opened` (앱 launch마다)
- `af_session` (foreground 진입마다)

별도 custom event 호출은 필요하지 않습니다 (retention 측정에는 lifecycle event만으로 충분).

## iOS 빌드라면 추가

`Info.plist`에 `NSUserTrackingUsageDescription` 추가 + `startSDK()` 호출 전에 ATT 동의 다이얼로그.
프로토타입 단계에서 ATT 거부돼도 lifecycle event는 정상적으로 잡힙니다.

## AppsFlyer 대시보드 측 확인 사항

- App Settings → SDK Integration → Status가 "Active" 인지 확인
- App ID 매핑 확인: Android `{APP_ID}` (iOS bundle도 같이 매핑)
- Test Devices에 본인 디바이스 등록 + `setIsDebug(true)`로 SDK 로그 확인

## 검증 방법

빌드 → 실 디바이스에서 앱 launch → 1~2시간 후 (AppsFlyer raw data latency)
다음 명령으로 데이터 도달 확인:

```bash
./scripts/af-diagnose.sh
# → in_app_events_report rows > 1 이면 성공
```

## 통합 완료 후

데이터 축적 14~30일 후 대시보드에 {GAME_NAME}의 D1/D7/D30 retention이 같은 장르 시장 평균(Sensor Tower 데이터) 대비 어느 위치인지 Bayesian posterior로 자동 표시됩니다.

## 참고

- [AppsFlyer Unity SDK 통합 가이드](https://dev.appsflyer.com/hc/docs/unity-sdk-integration)
- App ID: `{APP_ID}`
- AppsFlyer dev_token은 별도 안전 채널로 전달 (Slack DM/이메일 ❌, 1Password 또는 Vercel env로 직접 등록)

감사합니다.

---

## 첫 사용 인스턴스 (참조용)

**게임**: Poco Merge
**App ID**: `com.makealive.PKMergeA`
**의뢰일**: 2026-04-24

위 템플릿의 `{GAME_NAME}` → `Poco Merge`, `{APP_ID}` → `com.makealive.PKMergeA`로 치환해 발송.
