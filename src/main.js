import { createPlayer } from "./player.js";

const FIRE_THRESHOLD = 10; // 이만큼 연타하면 불타는 효과

const progressEl = document.getElementById("progress");
const bubbleText = document.querySelector(".bubble__text");

const player = createPlayer({
  onChange: (state) => {
    if (state.isAutoPlaying || state.remaining > 0) {
      const done = state.total - state.remaining;
      progressEl.textContent = `${done} / ${state.total}`;
    } else {
      progressEl.textContent = "";
    }
    // 10연타 이상 + 재생 중인 소리가 있을 때만 불타는 효과.
    // 모든 오디오가 꺼지면 streak 가 0으로 리셋되어 효과도 함께 꺼진다.
    const burning = state.streak >= FIRE_THRESHOLD && state.activeCount > 0;
    document.body.classList.toggle("burning", burning);
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
  popText();
});

document.querySelectorAll(".pill[data-times]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const n = parseInt(btn.dataset.times, 10);
    player.startRepeat(n);
  });
});

document.getElementById("stop-btn").addEventListener("click", () => {
  player.stop();
});
