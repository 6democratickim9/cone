# CONE

도예가를 위한 Local-first 유약 배합 계산·기록 PWA입니다. 계정이나 서버 없이 브라우저에서 완결되며, 네트워크가 없어도 계산과 기록을 사용할 수 있습니다.

## MVP 아키텍처

```text
React + Vite + Capacitor
├── 브라우저 계산 엔진
├── SQLite (iOS·Android) / IndexedDB (Web)
│   ├── 계산 히스토리
│   ├── 저장 레시피와 즐겨찾기
│   ├── 내 재료와 재료 스냅샷
│   └── 소성 기록과 로컬 사진
├── JSON Export / Import
├── Service Worker 오프라인 캐시
└── iOS·Android 네이티브 앱 컨테이너
```

서버, 로그인, AWS, AI 기능은 MVP 범위에서 제외합니다. 자동 백업·다기기 동기화·사진 원본 보관이 필요한 시점에 선택형 CONE Cloud로 확장합니다.

## 주요 기능

- Base g과 Additive %를 목표 최종 가루 중량으로 환산
- 계산 실행 시 IndexedDB 히스토리 자동 저장
- 날짜·재료명 검색, 즐겨찾기, 레시피 전환, 재계산, 삭제
- 공용 재료와 사용자 재료 구분 및 계산 당시 정보 스냅샷
- 레시피별 소성 조건·메모·기기 내 사진 기록
- 사진 원본을 포함한 전체 JSON 백업·복원
- 설치형 PWA와 오프라인 실행

## 실행

```bash
npm ci
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다.

## 검증

```bash
npm test
npm run lint
npm run build
```

## iOS·Android 실행

```bash
# 웹 빌드와 네이티브 프로젝트 동기화
npm run native:sync

# Xcode 또는 Android Studio 열기
npm run native:ios
npm run native:android
```

앱 식별자는 현재 `com.cone.glaze`입니다. 스토어 등록 전에 최종 번들 ID와 서명 팀을 확정해야 합니다. Capacitor 8 기준으로 iOS 빌드는 Xcode 26 이상과 Apple Developer 계정, Android 빌드는 Android Studio 2025.2.1 이상과 Android SDK가 필요합니다. Android 배포에는 별도의 서명 키도 필요합니다.

## 계산 규칙

1. Base 총량 `B` = 모든 Base 입력 g의 합
2. Additive 중량 = `B × Additive % ÷ 100`
3. 원본 최종 총량 `T` = Base + 모든 Additive
4. 스케일 배수 `S` = 목표 최종 총량 `M ÷ T`
5. 제작 중량 = 원본 재료 중량 `× S`

내부 계산은 반올림하지 않고 화면만 0.01g 단위로 표시합니다.

> Additive 허용 범위는 현재 명세 3.4의 `0.005%~40%`를 적용했습니다. 명세 3.1의 `0.01%~30%`와 상충하므로 최종 확정이 필요합니다.

## 데이터 안전

- 앱 데이터는 현재 브라우저 프로필의 IndexedDB에만 저장됩니다.
- 브라우저 데이터 삭제나 기기 분실에 대비해 재료 화면의 JSON 백업을 정기적으로 사용하세요.
- iOS·Android에서는 SQLite, 웹에서는 IndexedDB에 저장됩니다.
- 사진 원본은 데이터와 함께 기기에 저장되며 JSON 백업에도 포함됩니다. 사진이 많으면 백업 파일이 커질 수 있습니다.
