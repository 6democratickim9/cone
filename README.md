# CONE Web

도예가를 위한 유약 배합 계산·기록 서비스입니다. React 프론트엔드와 Go API로 구성됩니다.

## 구조

```text
src/                         React + Vite 프론트엔드
backend/cmd/api/             Go API 진입점
backend/internal/calculation 계산 규칙, HTTP 핸들러, 저장소
backend/data/                로컬 JSON 데이터(자동 생성, Git 제외)
```

## 로컬 실행

Go 1.23 이상이 필요합니다. 터미널 두 개에서 실행합니다.

```bash
# terminal 1
cd backend
go run ./cmd/api

# terminal 2
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다. API는 `http://127.0.0.1:8080`에서 실행됩니다.

Go가 설치되어 있지 않으면 Docker Desktop 실행 후 다음 명령으로 API만 실행할 수 있습니다.

```bash
docker compose up --build api
```

## API

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/health` | 헬스 체크 |
| GET | `/api/calculations` | 계산 히스토리 조회 |
| POST | `/api/calculations` | 계산·검증 후 히스토리 생성 |
| PATCH | `/api/calculations/{id}` | 즐겨찾기·레시피 저장 상태 변경 |
| DELETE | `/api/calculations/{id}` | 히스토리 삭제 |

로컬 MVP는 JSON 파일에 원자적으로 저장합니다. `Repository` 인터페이스를 분리해 다음 단계에서 PostgreSQL 구현으로 교체할 수 있습니다.

> Additive 허용 범위는 명세 3.4의 `0.005%~40%`를 임시 기준으로 적용했습니다. 상충하는 3.1의 `0.01%~30%`와 최종 조율이 필요합니다.

## 검증

```bash
npm run lint
npm run build

cd backend
go test ./...
go vet ./...
```
