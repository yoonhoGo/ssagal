// 음원 재생 + 자동 반복 상태 머신.
// makeAudio(기본 (src) => new Audio(src))와 타이머를 주입받아 테스트 가능하게 한다.
// 연타 시 매번 새 Audio 인스턴스를 만들어 중첩 재생한다.
export function createPlayer(options = {}) {
  const src = options.src ?? "/assets/ssyagal.m4a";
  const gapMs = options.gapMs ?? 300;
  const makeAudio = options.makeAudio ?? ((s) => new Audio(s));
  const setTimeoutFn = options.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
  const onChange = options.onChange ?? (() => {});

  const state = { isAutoPlaying: false, remaining: 0, total: 0 };
  const active = new Set(); // 현재 재생 중인 Audio (stop 시 일괄 정지용)

  function emit() {
    onChange({ ...state });
  }

  // 새 오디오 인스턴스를 만들어 재생한다. onEnded는 재생 종료 시 1회 호출.
  function spawn(onEnded) {
    const audio = makeAudio(src);
    active.add(audio);
    const cleanup = () => active.delete(audio);
    audio.addEventListener("ended", () => {
      cleanup();
      if (onEnded) onEnded();
    });
    audio.addEventListener("error", cleanup);
    audio.play();
    return audio;
  }

  // 연타 대응: 다른 소리를 멈추지 않고 새 인스턴스를 띄워 중첩 재생.
  function playOnce() {
    spawn(null);
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
    spawn(() => {
      state.remaining -= 1;
      emit();
      if (state.isAutoPlaying && state.remaining > 0) {
        setTimeoutFn(playNext, gapMs);
      } else {
        finish();
      }
    });
  }

  function startRepeat(n) {
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
    for (const audio of active) {
      audio.pause();
      audio.currentTime = 0;
    }
    active.clear();
    emit();
  }

  return {
    playOnce,
    startRepeat,
    stop,
    getState: () => ({ ...state }),
  };
}
