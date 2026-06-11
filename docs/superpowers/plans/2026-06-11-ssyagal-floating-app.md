# "싸갈!" 플로팅 앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면에 항상 떠 있는 말풍선 "싸갈!" 버튼을 누르면 "쌰~갈~!" 음성이 나오고, x3/x5/x10 프리셋으로 자동 반복하고 중지할 수 있는 Tauri 데스크톱 앱을 만든다.

**Architecture:** Tauri 2.x 단일 윈도우 앱. 프론트엔드는 순수 정적 HTML/CSS/JS(빌드 단계 없음). TTS와 자동 반복은 전적으로 프론트엔드 `speechSynthesis`로 처리하며, 상태 머신 로직(`speak.js`)은 DOM/Web Speech에 의존하지 않게 분리해 단위 테스트한다. Rust 백엔드는 윈도우 설정(프레임리스·투명·always-on-top)만 담당한다.

**Tech Stack:** Tauri 2.x, Rust(cargo 1.94), Node 22 / npm 10, 순수 vanilla JS(ES module), node test runner, Jua 폰트(번들).

**참고 환경 사실(검증 완료):**
- `create-tauri-app` vanilla 템플릿은 Vite 없이 순수 정적(`frontendDist: "../src"`), `withGlobalTauri: true`, `index.html`이 `main.js`를 `type="module"`로 로드 → ES module `import` 사용 가능.
- macOS 투명 윈도우는 `tauri.conf.json`의 `app.macOSPrivateApi: true`가 필요하다.
- `data-tauri-drag-region` 드래그는 `core:window:allow-start-dragging` 권한이 필요하다.
- Jua 폰트 TTF: `https://github.com/google/fonts/raw/main/ofl/jua/Jua-Regular.ttf` (HTTP 200, ~2.1MB, OFL 라이선스).

---

## File Structure

| 파일 | 책임 | 생성/수정 |
| --- | --- | --- |
| `package.json` | npm 스크립트(`tauri`, `test`) | 수정 |
| `src-tauri/tauri.conf.json` | 프레임리스·투명·always-on-top 윈도우 설정 | 수정 |
| `src-tauri/capabilities/default.json` | 드래그 권한 추가 | 수정 |
| `src/index.html` | 말풍선 버튼 + 프리셋 + 중지 + 진행 표시 마크업 | 수정 |
| `src/styles.css` | 말풍선/입체감/pill/누름 애니메이션 + Jua 폰트 | 수정 |
| `src/assets/Jua-Regular.ttf` | 번들 폰트 | 생성 |
| `src/speak.js` | TTS + 자동 반복 상태 머신(순수, 주입식) | 생성 |
| `src/main.js` | DOM 이벤트 → speak.js 연결, 진행 표시 | 수정 |
| `tests/speak.test.js` | speak.js 상태 머신 단위 테스트 | 생성 |

Rust `src-tauri/src/lib.rs`·`main.rs`는 **수정하지 않는다**(스캐폴드 기본값 유지; 데모 `greet` 커맨드는 미사용이어도 무해).

---

## Task 1: Tauri vanilla 앱 스캐폴드 + 저장소 루트로 이동

**Files:**
- Create: 저장소 루트에 `package.json`, `src/`, `src-tauri/`, `.vscode/`, `README.md`, `.gitignore`(스캐폴드 생성물)

- [ ] **Step 1: 임시 위치에 vanilla 템플릿 스캐폴드**

`create-tauri-app`은 대상 디렉터리가 비어있어야 하므로 임시 이름으로 만든 뒤 저장소 루트로 옮긴다.

Run:
```bash
cd ~/workspace && \
npm create tauri-app@latest ssyagalapp -- --template vanilla --manager npm --yes
```
Expected: `Template created!` 메시지. `~/workspace/ssyagalapp/` 생성.

- [ ] **Step 2: 생성물을 저장소 루트로 이동(.git 제외)**

Run:
```bash
cd ~/workspace && \
rsync -a --exclude='.git' ssyagalapp/ ssyagal/ && \
rm -rf ssyagalapp
```
Expected: `ssyagal/`에 `package.json`, `src/`, `src-tauri/`가 생기고 `ssyagalapp/`은 삭제됨. 기존 `docs/`는 그대로 유지.

- [ ] **Step 3: 의존성 설치**

Run:
```bash
cd ~/workspace/ssyagal && npm install
```
Expected: `node_modules/` 생성, 에러 없음.

- [ ] **Step 4: 스캐폴드 구조 확인**

Run:
```bash
cd ~/workspace/ssyagal && \
test -f src/index.html && test -f src-tauri/tauri.conf.json && \
test -f docs/superpowers/specs/2026-06-11-ssyagal-floating-app-design.md && echo OK
```
Expected: `OK` 출력(스캐폴드 + 기존 설계 문서 공존 확인).

- [ ] **Step 5: 커밋**

```bash
cd ~/workspace/ssyagal && \
git add -A && \
git commit -m "chore: scaffold Tauri vanilla app"
```

---

## Task 2: 플로팅 윈도우 설정(프레임리스·투명·always-on-top)

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: `tauri.conf.json` 전체 교체**

`src-tauri/tauri.conf.json` 전체를 아래로 교체한다(identifier는 스캐폴드가 생성한 값을 유지; 다를 경우 기존 값 사용).

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "ssyagal",
  "version": "0.1.0",
  "identifier": "com.yoonhogo.ssyagalapp",
  "build": {
    "frontendDist": "../src"
  },
  "app": {
    "withGlobalTauri": true,
    "macOSPrivateApi": true,
    "windows": [
      {
        "label": "main",
        "title": "싸갈",
        "width": 240,
        "height": 280,
        "resizable": false,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "shadow": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 2: 드래그 권한 추가 — `capabilities/default.json` 전체 교체**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "core:window:allow-start-dragging"
  ]
}
```

- [ ] **Step 3: 개발 실행으로 윈도우 확인**

Run:
```bash
cd ~/workspace/ssyagal && npm run tauri dev
```
Expected: 최초 1회는 Rust 컴파일로 수 분 소요. 이후 **타이틀바 없는 작은 창**이 뜨고, 배경이 투명하며(스캐폴드 기본 콘텐츠가 떠 보임), 다른 창 위에 항상 표시된다. 확인 후 `Ctrl+C`로 종료.

- [ ] **Step 4: 커밋**

```bash
cd ~/workspace/ssyagal && \
git add src-tauri/tauri.conf.json src-tauri/capabilities/default.json && \
git commit -m "feat: configure frameless transparent always-on-top window"
```

---

## Task 3: 말풍선 버튼 마크업 + 디자인(이미지 반영)

**Files:**
- Create: `src/assets/Jua-Regular.ttf`
- Modify: `src/index.html`
- Modify: `src/styles.css`

- [ ] **Step 1: Jua 폰트 다운로드(번들)**

Run:
```bash
cd ~/workspace/ssyagal && \
curl -fsSL -o src/assets/Jua-Regular.ttf \
  "https://github.com/google/fonts/raw/main/ofl/jua/Jua-Regular.ttf" && \
file src/assets/Jua-Regular.ttf
```
Expected: `TrueType Font data` 출력(다운로드 성공).

- [ ] **Step 2: `src/index.html` 전체 교체**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="styles.css" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>싸갈</title>
    <script type="module" src="/main.js" defer></script>
  </head>
  <body>
    <div class="stage" data-tauri-drag-region>
      <button class="bubble" id="ssyagal-btn" aria-label="싸갈">
        <span class="bubble__text">싸갈!</span>
      </button>
      <div class="controls">
        <button class="pill" data-times="3">x3</button>
        <button class="pill" data-times="5">x5</button>
        <button class="pill" data-times="10">x10</button>
        <button class="pill pill--stop" id="stop-btn">■ 중지</button>
      </div>
      <div class="progress" id="progress"></div>
    </div>
  </body>
</html>
```

- [ ] **Step 3: `src/styles.css` 전체 교체**

```css
@font-face {
  font-family: "Jua";
  src: url("/assets/Jua-Regular.ttf") format("truetype");
  font-display: swap;
}

:root {
  --ink: #1a1a1a;
  --paper: #ffffff;
  --stop: #c0392b;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  font-family: "Jua", system-ui, -apple-system, sans-serif;
  -webkit-user-select: none;
  user-select: none;
  cursor: default;
}

.stage {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 16px;
}

/* 말풍선 버튼 */
.bubble {
  position: relative;
  width: 180px;
  height: 128px;
  border: 7px solid var(--ink);
  border-radius: 50% / 46%;
  background: var(--paper);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  /* 키링 같은 입체 받침(검정 오프셋 그림자) */
  box-shadow: 6px 7px 0 0 var(--ink);
  transition: transform 0.06s ease, box-shadow 0.06s ease;
}

/* 좌하단 꼬리(tail) */
.bubble::after {
  content: "";
  position: absolute;
  left: 30px;
  bottom: -22px;
  width: 30px;
  height: 30px;
  background: var(--paper);
  border-left: 7px solid var(--ink);
  border-bottom: 7px solid var(--ink);
  border-bottom-left-radius: 10px;
  transform: skewX(-18deg) rotate(-6deg);
}

.bubble__text {
  font-size: 42px;
  line-height: 1;
  color: var(--ink);
  letter-spacing: 1px;
  /* 양각(엠보싱) 느낌 */
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18), 0 -1px 0 rgba(255, 255, 255, 0.7);
}

.bubble:active {
  transform: translate(3px, 3px);
  box-shadow: 2px 3px 0 0 var(--ink);
}

/* 프리셋 / 중지 pill */
.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.pill {
  font-family: "Jua", sans-serif;
  font-size: 15px;
  padding: 5px 12px;
  border: 3px solid var(--ink);
  border-radius: 999px;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
  box-shadow: 2px 3px 0 0 var(--ink);
  transition: transform 0.06s ease, box-shadow 0.06s ease;
}

.pill:active {
  transform: translate(2px, 2px);
  box-shadow: 0 1px 0 0 var(--ink);
}

.pill--stop {
  color: var(--stop);
  border-color: var(--stop);
  box-shadow: 2px 3px 0 0 var(--stop);
}

.progress {
  font-size: 14px;
  color: var(--ink);
  min-height: 18px;
  background: rgba(255, 255, 255, 0.85);
  padding: 1px 10px;
  border-radius: 999px;
}

.progress:empty {
  visibility: hidden;
}
```

- [ ] **Step 4: 디자인 시각 확인**

Run:
```bash
cd ~/workspace/ssyagal && npm run tauri dev
```
Expected: 투명 배경 위에 **흰 말풍선 + 굵은 검정 테두리 + 좌하단 꼬리 + 검정 그림자**가 뜨고, 안에 Jua 폰트로 "싸갈!"이 보인다. 아래에 `x3 x5 x10 ■ 중지` pill이 보인다. (이 시점엔 `main.js`가 아직 없어 콘솔에 404가 날 수 있고 소리는 나지 않음 — 정상.) 꼬리/그림자 위치가 어색하면 픽셀 값을 미세 조정. 확인 후 `Ctrl+C`.

- [ ] **Step 5: 커밋**

```bash
cd ~/workspace/ssyagal && \
git add src/index.html src/styles.css src/assets/Jua-Regular.ttf && \
git commit -m "feat: speech-bubble button UI with bundled Jua font"
```

---

## Task 4: TTS + 자동 반복 상태 머신 (`speak.js`) — TDD

**Files:**
- Create: `src/speak.js`
- Create: `tests/speak.test.js`
- Modify: `package.json` (test 스크립트 추가)

- [ ] **Step 1: 테스트 스크립트 추가 — `package.json` 전체 교체**

```json
{
  "name": "ssyagalapp",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "tauri": "tauri",
    "test": "node --test"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2"
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성 — `tests/speak.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpeaker } from "../src/speak.js";

// 동기적으로 onend 를 즉시 호출하는 가짜 synth
function makeFakeSynth(voices = [{ lang: "ko-KR", name: "Yuna" }]) {
  return {
    spoken: [],
    cancelCount: 0,
    speak(u) {
      this.spoken.push(u);
      if (typeof u.onend === "function") u.onend();
    },
    cancel() {
      this.cancelCount += 1;
    },
    getVoices() {
      return voices;
    },
  };
}

// 자동 반복의 발화 간격을 즉시 실행시켜 테스트를 동기화
const sync = {
  makeUtterance: () => ({}),
  setTimeout: (cb) => cb(),
};

test("speakOnce: cancel 후 1회 발화한다", () => {
  const synth = makeFakeSynth();
  const speaker = createSpeaker(synth, sync);
  speaker.speakOnce();
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.cancelCount, 1);
});

test("발화 텍스트 기본값은 '쌰~갈~!' 이다", () => {
  const synth = makeFakeSynth();
  const speaker = createSpeaker(synth, {
    setTimeout: (cb) => cb(),
    makeUtterance: (t) => ({ text: t }),
  });
  speaker.speakOnce();
  assert.equal(synth.spoken[0].text, "쌰~갈~!");
});

test("startRepeat(3): 정확히 3회 발화하고 종료 상태가 된다", () => {
  const synth = makeFakeSynth();
  const speaker = createSpeaker(synth, sync);
  speaker.startRepeat(3);
  assert.equal(synth.spoken.length, 3);
  const s = speaker.getState();
  assert.equal(s.remaining, 0);
  assert.equal(s.isAutoPlaying, false);
});

test("한국어 음성이 있으면 utterance.voice 로 선택한다", () => {
  const synth = makeFakeSynth([
    { lang: "en-US", name: "Alex" },
    { lang: "ko-KR", name: "Yuna" },
  ]);
  const speaker = createSpeaker(synth, sync);
  speaker.speakOnce();
  assert.equal(synth.spoken[0].voice.name, "Yuna");
});

test("한국어 음성이 없으면 voice 없이도 발화한다(fallback)", () => {
  const synth = makeFakeSynth([{ lang: "en-US", name: "Alex" }]);
  const speaker = createSpeaker(synth, sync);
  speaker.speakOnce();
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].voice, undefined);
});

test("stop(): 상태를 리셋하고 cancel 한다", () => {
  const synth = makeFakeSynth();
  const speaker = createSpeaker(synth, sync);
  speaker.stop();
  const s = speaker.getState();
  assert.equal(s.isAutoPlaying, false);
  assert.equal(s.remaining, 0);
  assert.equal(s.total, 0);
  assert.ok(synth.cancelCount >= 1);
});

test("onChange 는 startRepeat 진행에 따라 호출된다", () => {
  const synth = makeFakeSynth();
  const states = [];
  const speaker = createSpeaker(synth, {
    ...sync,
    onChange: (s) => states.push(s),
  });
  speaker.startRepeat(2);
  // 시작(0/2) + 각 발화 종료(1/2, 2/2) 최소 3회 이상 호출
  assert.ok(states.length >= 3);
  assert.equal(states[states.length - 1].remaining, 0);
});
```

- [ ] **Step 3: 테스트 실행으로 실패 확인**

Run:
```bash
cd ~/workspace/ssyagal && npm test
```
Expected: FAIL — `Cannot find module '../src/speak.js'` 또는 `createSpeaker is not a function`.

- [ ] **Step 4: 최소 구현 — `src/speak.js`**

```js
// TTS 발화 + 자동 반복 상태 머신.
// synth(기본 window.speechSynthesis)와 타이머/utterance 생성기를 주입받아 테스트 가능하게 한다.
export function createSpeaker(synth, options = {}) {
  const text = options.text ?? "쌰~갈~!";
  const gapMs = options.gapMs ?? 300;
  const makeUtterance =
    options.makeUtterance ?? ((t) => new SpeechSynthesisUtterance(t));
  const setTimeoutFn = options.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
  const onChange = options.onChange ?? (() => {});

  const state = { isAutoPlaying: false, remaining: 0, total: 0 };

  function emit() {
    onChange({ ...state });
  }

  function pickKoVoice() {
    const voices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
    return (
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ko")) || null
    );
  }

  function utter() {
    const u = makeUtterance(text);
    const voice = pickKoVoice();
    if (voice) u.voice = voice;
    u.lang = "ko-KR";
    return u;
  }

  function speakOnce() {
    synth.cancel();
    synth.speak(utter());
  }

  function finish() {
    state.isAutoPlaying = false;
    state.remaining = 0;
    emit();
  }

  function playNext() {
    if (!state.isAutoPlaying || state.remaining <= 0) {
      finish();
      return;
    }
    const u = utter();
    u.onend = () => {
      state.remaining -= 1;
      emit();
      if (state.isAutoPlaying && state.remaining > 0) {
        setTimeoutFn(playNext, gapMs);
      } else {
        finish();
      }
    };
    synth.speak(u);
  }

  function startRepeat(n) {
    synth.cancel();
    state.isAutoPlaying = true;
    state.total = n;
    state.remaining = n;
    emit();
    playNext();
  }

  function stop() {
    state.isAutoPlaying = false;
    state.remaining = 0;
    state.total = 0;
    synth.cancel();
    emit();
  }

  return {
    speakOnce,
    startRepeat,
    stop,
    getState: () => ({ ...state }),
  };
}
```

- [ ] **Step 5: 테스트 실행으로 통과 확인**

Run:
```bash
cd ~/workspace/ssyagal && npm test
```
Expected: PASS — 7개 테스트 모두 통과.

- [ ] **Step 6: 커밋**

```bash
cd ~/workspace/ssyagal && \
git add src/speak.js tests/speak.test.js package.json && \
git commit -m "feat: TTS auto-repeat state machine with unit tests"
```

---

## Task 5: DOM 이벤트 배선 (`main.js`)

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: `src/main.js` 전체 교체**

```js
import { createSpeaker } from "./speak.js";

const progressEl = document.getElementById("progress");

const speaker = createSpeaker(window.speechSynthesis, {
  onChange: (state) => {
    if (state.isAutoPlaying || state.remaining > 0) {
      const done = state.total - state.remaining;
      progressEl.textContent = `${done} / ${state.total}`;
    } else {
      progressEl.textContent = "";
    }
  },
});

// 일부 플랫폼은 음성 목록을 비동기로 로딩한다 — 미리 워밍업.
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

document.getElementById("ssyagal-btn").addEventListener("click", () => {
  speaker.speakOnce();
});

document.querySelectorAll(".pill[data-times]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const n = parseInt(btn.dataset.times, 10);
    speaker.startRepeat(n);
  });
});

document.getElementById("stop-btn").addEventListener("click", () => {
  speaker.stop();
});
```

- [ ] **Step 2: 테스트 재실행(회귀 확인)**

Run:
```bash
cd ~/workspace/ssyagal && npm test
```
Expected: PASS — 7개 테스트 모두 통과(상태 머신 회귀 없음).

- [ ] **Step 3: 커밋**

```bash
cd ~/workspace/ssyagal && \
git add src/main.js && \
git commit -m "feat: wire button, presets, stop and progress to speaker"
```

---

## Task 6: 통합 수동 검증

**Files:** 없음(실행 확인만)

- [ ] **Step 1: 앱 실행**

Run:
```bash
cd ~/workspace/ssyagal && npm run tauri dev
```

- [ ] **Step 2: 수동 검증 체크리스트**

다음을 직접 확인한다(스피커/음량 켜둘 것):
- [ ] 타이틀바 없는 투명 창에 말풍선 "싸갈!" 버튼이 떠 있고 항상 다른 창 위에 있다.
- [ ] 말풍선 버튼 클릭 → "쌰~갈~!" 음성이 1회 재생된다.
- [ ] 빠르게 연타 → 직전 발화를 끊고 매번 새로 재생된다.
- [ ] `x3` 클릭 → 3회 자동 반복, 진행 표시가 `0 / 3 → 1 / 3 → 2 / 3` 식으로 갱신된다.
- [ ] `x5`, `x10`도 각각 해당 횟수만큼 반복된다.
- [ ] 자동 반복 중 `■ 중지` 클릭 → 즉시 멈추고 진행 표시가 사라진다.
- [ ] 말풍선 바깥 여백을 드래그 → 창이 이동한다(버튼 클릭과 충돌 없음).

확인 후 `Ctrl+C`로 종료.

- [ ] **Step 3: 한국어 음성 확인(필요 시)**

음성이 영어로 들리면 macOS `시스템 설정 > 손쉬운 사용 > 음성 콘텐츠`에서 한국어 음성(예: Yuna)을 설치한 뒤 앱을 재실행한다. (설계상 한국어 음성이 없으면 기본 음성으로 fallback 하므로 동작 자체는 정상.)

- [ ] **Step 4: 최종 상태 커밋(변경 있을 경우) 및 태그**

```bash
cd ~/workspace/ssyagal && \
git add -A && \
git commit -m "chore: finalize ssyagal floating app" --allow-empty && \
git tag v0.1.0
```

---

## 비목표 (YAGNI — 이번 구현 범위 아님)

- 메뉴바 트레이 아이콘
- 음량/속도/음성 선택 설정 UI
- 커스텀 사운드 파일 업로드
- Windows/Linux 동작 검증(개발·확인은 macOS 기준)
