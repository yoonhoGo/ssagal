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
