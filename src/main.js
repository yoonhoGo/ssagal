import { createPlayer } from "./player.js";

const progressEl = document.getElementById("progress");

const player = createPlayer({
  onChange: (state) => {
    if (state.isAutoPlaying || state.remaining > 0) {
      const done = state.total - state.remaining;
      progressEl.textContent = `${done} / ${state.total}`;
    } else {
      progressEl.textContent = "";
    }
  },
});

document.getElementById("ssyagal-btn").addEventListener("click", () => {
  player.playOnce();
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
