import { createPlayer } from "./player.js";
import { createSettings } from "./settings.js";

const progressEl = document.getElementById("progress");
const bubbleText = document.querySelector(".bubble__text");
const bubbleEl = document.querySelector(".bubble");
const bubbleImg = document.getElementById("bubble-img");

const store = createSettings();
let settings = store.load();

const player = createPlayer({
  src: settings.soundDataUrl ?? undefined, // null 이면 기본 음원 경로 사용
  gapMs: settings.gapMs,
  onPlay: () => popText(), // 연타·x10·계속 등 모든 재생 시점에 글씨 팝
  onChange: (state) => {
    if (state.isContinuous) {
      progressEl.textContent = "∞";
    } else if (state.isAutoPlaying || state.remaining > 0) {
      const done = state.total - state.remaining;
      progressEl.textContent = `${done} / ${state.total}`;
    } else {
      progressEl.textContent = "";
    }
    // 불타는 효과 여부는 player 가 판단(isHot). 단, 설정 효과가 '없음'이면 끈다.
    document.body.classList.toggle("burning", state.isHot && settings.effect !== "none");
  },
});

// 클릭마다 글씨를 두 배로 팝 (애니메이션 재시작).
function popText() {
  bubbleText.classList.remove("pop");
  void bubbleText.offsetWidth; // reflow 강제 → 연타 시에도 매번 재생
  bubbleText.classList.add("pop");
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

  // 효과 테마: 무지개일 때만 effect-rainbow 클래스 (없으면 기본 불꽃)
  document.body.classList.toggle("effect-rainbow", settings.effect === "rainbow");

  // 사운드/딜레이는 player 에 반영
  player.setSrc(settings.soundDataUrl ?? undefined);
  player.setGap(settings.gapMs);

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

// ===== 재생 컨트롤 =====
document.getElementById("ssyagal-btn").addEventListener("click", () => {
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
