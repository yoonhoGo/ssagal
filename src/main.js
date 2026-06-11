import { createPlayer } from "./player.js";

const progressEl = document.getElementById("progress");
const bubbleText = document.querySelector(".bubble__text");

const player = createPlayer({
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
    // 불타는 효과 여부는 player 가 판단(isHot) — UI 는 그대로 반영만.
    document.body.classList.toggle("burning", state.isHot);
  },
});

// 클릭마다 글씨를 두 배로 팝 (애니메이션 재시작).
function popText() {
  bubbleText.classList.remove("pop");
  void bubbleText.offsetWidth; // reflow 강제 → 연타 시에도 매번 재생
  bubbleText.classList.add("pop");
}

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
