import { createPlayer } from "./player.js";
import { createAudioEngine } from "./audio-engine.js";
import { createSettings, defaultSoundSrc, DEFAULT_TEXT_BY_EFFECT } from "./settings.js";
import { bindShortcuts } from "./shortcuts.js";

const progressEl = document.getElementById("progress");
const bubbleText = document.querySelector(".bubble__text");
const bubbleEl = document.querySelector(".bubble");
const bubbleImg = document.getElementById("bubble-img");

const store = createSettings();
let settings = store.load();

// Web Audio 엔진. 음원을 1회 디코딩해 캐싱하고 연타 시 가벼운 source 노드로 중첩 재생한다.
const engine = createAudioEngine();

function resolvePlayerSrc() {
  // 커스텀 음원이 지정돼 있으면 그것을, 아니면 현재 효과의 기본 음원을 쓴다.
  return settings.soundDataUrl ?? defaultSoundSrc(settings.effect);
}

// 연타 시 한 프레임에 여러 번 onChange 가 와도 DOM 반영은 1회만 한다(rAF 코알레스싱).
let pendingState = null;
let rafScheduled = false;

function applyState(state) {
  if (state.isContinuous) {
    progressEl.textContent = "∞";
  } else if (state.isAutoPlaying || state.remaining > 0) {
    const done = state.total - state.remaining;
    progressEl.textContent = `${done} / ${state.total}`;
  } else {
    progressEl.textContent = "";
  }
  // 불타는 효과 여부는 player 가 판단(isHot). 단, 설정 효과가 '없음'이면 끈다.
  const shouldBurn = state.isHot && settings.effect !== "none";
  document.body.classList.toggle("burning", shouldBurn);
  document.body.dataset.effectLevel = String(shouldBurn ? getEffectLevel(state) : 0);
  syncBubbleText();
  syncFeverWindow();
}

function flushState() {
  rafScheduled = false;
  if (pendingState == null) return;
  const s = pendingState;
  pendingState = null;
  applyState(s);
}

const player = createPlayer({
  engine,
  src: resolvePlayerSrc(),
  gapMs: settings.gapMs,
  onPlay: () => popText(), // 연타·x10·계속 등 모든 재생 시점에 글씨 팝
  onChange: (state) => {
    pendingState = state;
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(flushState);
    }
  },
});

// ===== 쌰갈 효과 피버타임: 창 2배 확대 =====
// 말풍선이 transform 으로 2배가 되면 240x280 창에서 잘리므로 창 자체를 키운다 (중심 유지).
const BASE_WIN = { width: 240, height: 280 }; // tauri.conf.json 의 창 크기와 같아야 함
let feverWindowOn = false;

async function setFeverWindow(on) {
  const tauri = window.__TAURI__;
  if (!tauri || on === feverWindowOn) return;
  feverWindowOn = on;
  const win = tauri.window.getCurrentWindow();
  const { LogicalSize, LogicalPosition } = tauri.dpi;
  const pos = (await win.outerPosition()).toLogical(await win.scaleFactor());
  const dx = BASE_WIN.width / 2;
  const dy = BASE_WIN.height / 2;
  if (on) {
    await win.setSize(new LogicalSize(BASE_WIN.width * 2, BASE_WIN.height * 2));
    await win.setPosition(new LogicalPosition(pos.x - dx, pos.y - dy));
  } else {
    await win.setSize(new LogicalSize(BASE_WIN.width, BASE_WIN.height));
    await win.setPosition(new LogicalPosition(pos.x + dx, pos.y + dy));
  }
}

// 쌰갈 피버 중 말풍선 무작위 기울기(-30°~+30°). 피버 진입 후 팝마다 새 각도를 뽑는다.
let screamTiltOn = false;

function setRandomTilt() {
  const deg = (Math.random() * 60 - 30).toFixed(1);
  bubbleEl.style.setProperty("--bubble-rotate", `${deg}deg`);
}

function syncScreamTilt(on) {
  if (on === screamTiltOn) return;
  screamTiltOn = on;
  if (on) {
    setRandomTilt();
  } else {
    bubbleEl.style.removeProperty("--bubble-rotate");
  }
}

// 피버 상태·효과 설정에 맞춰 창 크기와 기울기를 동기화한다 (브라우저 단독 실행 등 실패는 무시).
function syncFeverWindow() {
  const on = document.body.classList.contains("burning") && settings.effect === "scream";
  syncScreamTilt(on);
  setFeverWindow(on).catch(() => {});
}

function getEffectLevel(state) {
  if (state.isContinuous) return 3;
  const total = Number.isFinite(state.total) ? state.total : 0;
  const pressure = Math.max(state.streak, total, state.activeCount);
  if (pressure >= 30) return 3;
  if (pressure >= 20) return 2;
  if (pressure >= 10) return 1;
  return 0;
}

// 갈(scold) 효과는 이펙트 발동(burning) 중엔 한자 喝!!! 로 바꾼다. 평소엔 기본 "갈!!!".
function syncBubbleText() {
  if (settings.imageDataUrl) return; // 커스텀 이미지가 우선이면 글씨는 건드리지 않는다
  const burning = document.body.classList.contains("burning");
  bubbleText.textContent =
    burning && settings.effect === "scold"
      ? "!!!喝!!!"
      : DEFAULT_TEXT_BY_EFFECT[settings.effect] ?? DEFAULT_TEXT_BY_EFFECT.fire;
}

// 클릭마다 글씨를 두 배로 팝 (애니메이션 재시작).
// 말풍선에도 pop 클래스를 붙인다 — 쌰갈 효과일 때만 CSS 가 말풍선을 키운다.
// effects.css 의 pop 계열 애니메이션만 getAnimations() 로 cancel()+play() 해 reflow 없이 재시작.
// infinite 효과 애니메이션(text-fire, text-rainbow, scold-bubble 등)은 건드리지 않는다.
const POP_ANIM_NAMES = new Set(["pop", "bubble-pop", "scold-pop"]);

function restartPopAnimations(el) {
  // pop 클래스가 없으면 처음 한 번 붙여 애니메이션을 활성화한다.
  if (!el.classList.contains("pop")) {
    el.classList.add("pop");
    return;
  }
  let restarted = false;
  for (const a of el.getAnimations()) {
    if (POP_ANIM_NAMES.has(a.animationName)) {
      a.cancel();
      a.play();
      restarted = true;
    }
  }
  // 매칭 애니메이션이 없는 희귀 경로(구형 WebKit 등)는 클래스 토글로 폴백.
  if (!restarted) {
    el.classList.remove("pop");
    el.classList.add("pop");
  }
}

function popText() {
  if (screamTiltOn) setRandomTilt(); // 쌰갈 피버 중엔 팝마다 기울기를 새로 뽑는다
  restartPopAnimations(bubbleText);
  restartPopAnimations(bubbleEl);
}

// ===== 설정 입력 컨트롤 =====
const panel = document.getElementById("settings-panel");
const imageInput = document.getElementById("set-image");
const soundInput = document.getElementById("set-sound");
const gapInput = document.getElementById("set-gap");
const gapOut = document.getElementById("set-gap-out");
const effectSelect = document.getElementById("set-effect");

// 현재 settings 를 DOM/player 에 반영한다.
function applySettings() {
  // 이미지: 있으면 말풍선 글씨 대신 이미지 표시
  if (settings.imageDataUrl) {
    bubbleImg.src = settings.imageDataUrl;
    bubbleImg.hidden = false;
    bubbleEl.classList.add("has-image");
  } else {
    bubbleImg.removeAttribute("src");
    bubbleImg.hidden = true;
    bubbleEl.classList.remove("has-image");
  }

  // 커스텀 이미지가 없을 때는 효과에 맞는 기본 글씨를 넣는다 (갈 효과는 "!!!갈!!!").
  // 이펙트 발동 중엔 syncBubbleText 가 한자 "!!!喝!!!" 로 바꾼다.
  syncBubbleText();

  document.body.classList.toggle("effect-rainbow", settings.effect === "rainbow");
  document.body.classList.toggle("effect-heart", settings.effect === "heart");
  document.body.classList.toggle("effect-scream", settings.effect === "scream");
  document.body.classList.toggle("effect-scold", settings.effect === "scold");

  // 사운드/딜레이는 player 에 반영
  player.setSrc(resolvePlayerSrc());
  player.setGap(settings.gapMs);

  syncFeverWindow(); // 피버 중 효과를 바꿔도 창 크기가 맞도록
  syncControls();
}

// 설정 입력 컨트롤을 현재 값으로 동기화한다.
function syncControls() {
  gapInput.value = String(settings.gapMs);
  gapOut.textContent = `${settings.gapMs}ms`;
  effectSelect.value = settings.effect;
}

// File → data URL 로 읽는다.
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ===== 말풍선 드래그로 창 이동 =====
// 누른 채 4px 이상 움직이면 드래그로 판단해 창을 옮기고, 이어지는 click 은 무시한다.
const DRAG_THRESHOLD = 4;
let pressPos = null;
let draggedWindow = false;

bubbleEl.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  draggedWindow = false;
  pressPos = { x: e.clientX, y: e.clientY };
});

bubbleEl.addEventListener("mousemove", (e) => {
  if (!pressPos || draggedWindow) return;
  if (Math.hypot(e.clientX - pressPos.x, e.clientY - pressPos.y) < DRAG_THRESHOLD) return;
  draggedWindow = true;
  window.__TAURI__?.window.getCurrentWindow().startDragging().catch(() => {});
});

window.addEventListener("mouseup", () => {
  pressPos = null;
});

// ===== 재생 컨트롤 =====
document.getElementById("ssyagal-btn").addEventListener("click", () => {
  if (draggedWindow) {
    draggedWindow = false; // 드래그 직후의 click 은 재생하지 않는다
    return;
  }
  player.playOnce();
});

document.querySelectorAll(".pill[data-times]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const n = parseInt(btn.dataset.times, 10);
    player.startRepeat(n);
  });
});

document.getElementById("loop-btn").addEventListener("click", () => {
  player.startContinuous();
});

document.getElementById("stop-btn").addEventListener("click", () => {
  player.stop();
});

// ===== 설정 패널 열기/닫기 =====
document.getElementById("settings-btn").addEventListener("click", () => {
  syncControls();
  panel.hidden = false;
});

document.getElementById("settings-close").addEventListener("click", () => {
  panel.hidden = true;
});

// 배경(카드 바깥) 클릭 시 닫기
panel.addEventListener("click", (e) => {
  if (e.target === panel) panel.hidden = true;
});

// ===== 설정 변경 핸들러 =====
imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  settings = store.save({ imageDataUrl: await readAsDataUrl(file) });
  applySettings();
});

document.getElementById("set-image-clear").addEventListener("click", () => {
  settings = store.save({ imageDataUrl: null });
  imageInput.value = "";
  applySettings();
});

soundInput.addEventListener("change", async () => {
  const file = soundInput.files?.[0];
  if (!file) return;
  settings = store.save({ soundDataUrl: await readAsDataUrl(file) });
  applySettings();
});

document.getElementById("set-sound-clear").addEventListener("click", () => {
  settings = store.save({ soundDataUrl: null });
  soundInput.value = "";
  applySettings();
});

gapInput.addEventListener("input", () => {
  const gapMs = parseInt(gapInput.value, 10);
  gapOut.textContent = `${gapMs}ms`;
  settings = store.save({ gapMs });
  player.setGap(gapMs);
});

effectSelect.addEventListener("change", () => {
  settings = store.save({ effect: effectSelect.value });
  applySettings();
});

// 시작 시 저장된 설정 반영
applySettings();

// 키보드 단축키: Space/Enter=실행, 3/5/0=x3/x5/x10, R=계속, Esc/S=정지.
bindShortcuts(player);
