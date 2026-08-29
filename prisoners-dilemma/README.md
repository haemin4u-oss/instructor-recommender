# 🤝 죄수의 딜레마 아이스브레이킹 게임

사내 워크샵/오프사이트용 실시간 멀티플레이 "죄수의 딜레마" 웹 게임입니다.
참가자는 모바일 브라우저로 방 코드만 입력하면 바로 참여할 수 있고(회원가입 없음),
진행자는 데스크톱/빔프로젝터 화면에서 방을 만들고 라운드를 진행합니다.

## 기술 스택 및 선택 이유

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 프론트엔드 | React + Vite + Tailwind CSS | 빠른 개발/HMR, 모바일 퍼스트 스타일링 |
| 실시간 통신 | **Socket.io** (Firebase Realtime DB 대신) | 별도 클라우드 프로젝트/API 키 발급 없이 `npm install` 만으로 즉시 로컬·사내망에서 동작. 1회성 사내 이벤트에 적합 |
| 백엔드 | Node.js + Express (Socket.io 서버 겸용) | 단일 프로세스로 정적 서빙 없이도 API+소켓 처리 |
| 데이터 저장 | 인메모리 (DB 없음) | 이벤트 종료 후 데이터 보관 불필요, 서버 재시작 시 초기화되어도 무방 |

> Firebase Realtime Database도 가능하지만, 프로젝트 생성/콘솔 설정/보안 규칙 작성 등 사전 준비가 필요해
> "지금 바로 실행" 요구사항에는 Socket.io가 더 간단합니다.

## 프로젝트 구조

```
prisoners-dilemma/
├── package.json          # npm workspaces 루트 (server + client 동시 실행)
├── server/                # Express + Socket.io 백엔드
│   └── src/
│       ├── index.js       # 소켓 이벤트 라우팅 & 라운드 진행 로직
│       ├── roomManager.js # 방/참가자 인메모리 상태 관리
│       ├── gameLogic.js   # 매칭(짝/3인조) & 점수 계산 & 재미 통계
│       └── constants.js   # 점수 규칙, 라운드 시간 등 상수
└── client/                # React + Vite + Tailwind 프론트엔드
    └── src/
        ├── pages/          # Home, HostSetup, HostDashboard, JoinRoom, PlayerGame
        ├── components/     # QRCodeBox, Leaderboard, ChoiceButtons, RoundResultCard, Timer, FunStats
        ├── socket.js        # socket.io-client 싱글턴
        └── storage.js       # 새로고침/재접속 대비 localStorage 세션 저장
```

## 게임 규칙

- 2인 1조 매칭, 참가자가 홀수면 한 라운드는 3인조로 진행되어 아무도 대기하지 않습니다
  (3인조는 상대 2명과의 페어 점수를 평균내어 배점합니다).
- 매 라운드 상대는 랜덤으로 재매칭됩니다.
- 선택 제한시간 15초, 시간 내 미선택 시 랜덤 자동 선택됩니다.
- 점수: 둘 다 협력 → 각 +3 / 둘 다 배신 → 각 +1 / 한쪽만 배신 → 배신자 +5, 협력자 +0
- 3~5라운드 종료 후 누적 점수 리더보드와 "가장 신뢰받은 사람(협력률 최고)",
  "가장 의외의 배신자(협력한 상대를 가장 많이 배신)"를 보여줍니다.

## 실행 방법

### 1. 설치

루트에서 한 번만 실행하면 `server`, `client` 워크스페이스가 함께 설치됩니다.

```bash
cd prisoners-dilemma
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

- 백엔드: `http://localhost:3001`
- 프론트엔드: `http://localhost:5173`

브라우저에서 `http://localhost:5173` 접속 → "진행자로 시작"으로 방을 만드세요.

> 서버/클라이언트를 따로 실행하려면 `npm run dev:server`, `npm run dev:client`를 각각 사용하세요.

### 3. 참가자가 사내망(같은 Wi-Fi)에서 접속하는 방법

1. 진행자 PC의 로컬 IP를 확인합니다.
   - macOS: `ipconfig getifaddr en0`
   - Windows: `ipconfig` (IPv4 주소 확인)
   - Linux: `hostname -I`
2. 참가자는 같은 Wi-Fi에서 휴대폰 브라우저로 `http://<진행자-IP>:5173` 접속
   (예: `http://192.168.0.15:5173`)
3. 방 코드를 입력하거나, 진행자 대시보드에 표시된 QR코드를 스캔하면 바로 입장 화면으로 이동합니다.

`vite --host` 옵션과 `/socket.io` 프록시 설정 덕분에 어떤 주소(localhost, LAN IP, ngrok)로 접속하든
소켓 연결이 자동으로 같은 origin을 사용해 별도 설정 없이 동작합니다.

### 4. 사내망이 아닌 외부/원격 참가자가 있는 경우 (ngrok)

같은 Wi-Fi가 아니거나 방화벽 등으로 접속이 안 될 때는 ngrok으로 터널을 열 수 있습니다.

```bash
# ngrok 설치 후
ngrok http 5173
```

발급된 `https://xxxx.ngrok-free.app` 주소를 참가자에게 공유하세요(QR코드로도 자동 생성됩니다).
Vite 개발 서버가 낯선 호스트를 막을 수 있으니, 필요 시 `client/vite.config.js`의
`server.allowedHosts`에 발급된 ngrok 도메인을 추가하세요.

```js
// client/vite.config.js
server: {
  host: true,
  allowedHosts: ['xxxx.ngrok-free.app'],
  // ...
}
```

## 진행 흐름 요약

1. 진행자: `/host` → 라운드 수(3~5) 선택 → "방 생성하기" → 6자리 방 코드 발급
2. 참가자: `/join` (또는 QR 스캔) → 방 코드 + 닉네임 입력 → 대기 화면
3. 진행자: 참가자가 2명 이상 모이면 "게임 시작"
4. 각 라운드: 15초 내 협력(파란색)/배신(빨간색) 선택 → 카드 뒤집기 애니메이션으로 결과 공개
5. 진행자가 "다음 라운드"를 눌러 다음 라운드 진행, 마지막 라운드 후 "최종 결과 보기"
6. 최종 리더보드 + "가장 신뢰받은 사람" / "가장 의외의 배신자" 표시

## 재접속 / 새로고침 대응

- 참가자는 닉네임+방코드 기준으로 서버가 동일 인물로 인식하여 재입장시키며,
  브라우저 `localStorage`에 `playerId`를 저장해 새로고침해도 같은 사람으로 복귀합니다.
- 진행자 대시보드도 `localStorage`에 저장된 `hostToken`으로 새로고침 후 동일 방에 자동 재연결됩니다.
- 연결이 끊긴 참가자는 목록에 "접속끊김"으로 표시되며, 라운드 중 응답이 없으면
  제한시간 종료 시 랜덤 선택으로 자동 처리되어 다른 참가자를 기다리게 하지 않습니다.

## 알려진 제한사항

- 모든 상태는 인메모리로 관리되므로 서버를 재시작하면 진행 중이던 방 정보가 초기화됩니다
  (1회성 이벤트용으로 설계됨).
- 홀수 인원일 때의 3인조 라운드는 페어 점수 규칙을 그대로 적용하되, 상대 2명과의 점수를
  평균내어 배점하는 방식으로 단순화했습니다(완벽한 이론적 대칭은 아니지만 아이스브레이킹
  목적에는 충분합니다).
