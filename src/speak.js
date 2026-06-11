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
