# Ssagal (쌰갈)

화면 위에 항상 떠 있는 작은 말풍선 버튼을 누르면 **"쌰~갈~!"** 소리가 나는 데스크톱 장난감 앱입니다. 연타하면 소리가 겹쳐 재생되고, 자동 반복·무한 재생도 됩니다. 신나게 누르다 보면 글자에 불이 붙습니다. 🔥

Tauri 2 + 순수 HTML/CSS/JS로 만들었습니다.

## 기능

- 🫧 **플로팅 말풍선 버튼** — 프레임 없는 투명 창, 항상 위(always-on-top), 빈 곳을 드래그해 이동
- 🔊 **누르면 "쌰~갈~!"** — 클릭마다 음원(`src/assets/ssyagal.m4a`) 재생, **연타 시 소리 중첩**
- ✨ **클릭 팝** — 누를 때마다 글씨가 두 배로 펑
- 🔁 **자동 반복** — `x3` / `x5` / `x10` 프리셋 (반복 사이 약간 겹쳐 재생, 기본 -200ms)
- ♾️ **계속** — 중지 전까지 무한 재생
- 🔥 **불타는 효과** — `x10` 이상 자동 반복·계속 모드이거나 10회 이상 연타하면 글자에 불
- ⏹ **중지** — 자동 반복 중단 + 재생 중인 모든 소리 정지
- 🧭 **메뉴바(트레이) 아이콘** — macOS 메뉴바에 상주하며, 클릭하면 **보이기/숨기기** 토글과 **종료** 메뉴 제공 (프레임 없는 창을 숨겼다가 다시 부를 수 있음)

## 설치 & 실행 (npm 전역)

> ⚠️ **macOS (Apple Silicon / arm64) 전용.** 빌드된 바이너리를 동봉해 배포하므로 해당 플랫폼에서만 설치·실행됩니다.

```bash
npm install -g ssagal
ssagal                 # 말풍선 창 실행
```

## 개발

사전 준비: [Node.js](https://nodejs.org), [Rust](https://rustup.rs) 툴체인.

```bash
npm install
npm run tauri dev      # 개발 실행 (최초엔 Rust 컴파일로 수 분 소요)
npm test               # 단위 테스트
```

빌드 / 배포 패키징:

```bash
npm run tauri build    # 배포용 설치 번들(.app/.dmg) 생성
npm run build:bin      # release 바이너리를 dist-bin/ 으로 복사 (npm 동봉용)
```

`npm publish` 시 `prepublishOnly` 훅이 `build:bin` 을 실행해 최신 바이너리를 동봉합니다.

## 테스트

재생/자동 반복 상태 머신(`src/player.js`)은 의존성 주입으로 브라우저 없이 단위 테스트합니다.

```bash
npm test               # node --test
```

## 구조

```
src/
  index.html     말풍선 버튼 + 프리셋/계속/중지 + 진행 표시 마크업
  styles.css     말풍선 디자인, 클릭 팝, 불타는 효과 (번들 Jua 폰트)
  player.js      음원 재생 + 자동 반복 상태 머신 (순수 로직, DOM 비의존)
  main.js        DOM 이벤트 → player 연결, 진행/불 효과 반영
  assets/        ssyagal.m4a(음원), Jua-Regular.ttf(폰트)
src-tauri/       Tauri(Rust) — 프레임리스·투명·always-on-top 윈도우 + 메뉴바(트레이) 아이콘·보이기/숨기기
tests/           player.js 단위 테스트
```

## 기술 스택

- **Tauri 2** (Rust) — 데스크톱 셸 / 윈도우
- **순수 Vanilla JS** (ES module, 빌드 단계 없음)
- 재생: 웹뷰 내장 `HTMLAudioElement`
- 폰트: [Jua](https://fonts.google.com/specimen/Jua) (OFL, 앱에 번들)
- 테스트: node test runner

> 개발·동작 확인은 macOS 기준입니다. (투명 창은 `macOSPrivateApi` 사용)
