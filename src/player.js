// 음원 재생 + 자동 반복 상태 머신.
// makeAudio(기본 (src) => new Audio(src))와 타이머를 주입받아 테스트 가능하게 한다.
// 연타 시 매번 새 Audio 인스턴스를 만들어 중첩 재생한다.
export function createPlayer(options = {}) {
  const src = options.src ?? "/assets/ssyagal.m4a";
  const gapMs = options.gapMs ?? 0; // 순차 반복 사이 기본 딜레이 없음
  const makeAudio = options.makeAudio ?? ((s) => new Audio(s));
  const setTimeoutFn = options.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
  const onChange = options.onChange ?? (() => {});

  const active = new Set(); // 현재 재생 중인 Audio (stop 시 일괄 정지용)
  let isAutoPlaying = false;
  let remaining = 0;
  let total = 0;
  let streak = 0; // 연속 연타 횟수 (재생 중인 소리가 모두 끝나면 0으로 리셋)

  function snapshot() {
    return { isAutoPlaying, remaining, total, activeCount: active.size, streak };
  }

  function emit() {
    onChange(snapshot());
  }

  function remove(audio) {
    if (active.delete(audio) && active.size === 0) {
      streak = 0; // 모든 소리가 꺼지면 연타 스트릭 리셋
    }
  }

  // 새 오디오 인스턴스를 만들어 재생한다. onEnded는 재생 종료 시 1회 호출.
  function spawn(onEnded) {
    const audio = makeAudio(src);
    active.add(audio);
    audio.addEventListener("ended", () => {
      remove(audio);
      if (onEnded) onEnded();
      else emit();
    });
    audio.addEventListener("error", () => {
      remove(audio);
      emit();
    });
    audio.play();
    return audio;
  }

  // 연타 대응: 다른 소리를 멈추지 않고 새 인스턴스를 띄워 중첩 재생.
  function playOnce() {
    streak += 1;
    spawn(null);
    emit();
  }

  function finish() {
    isAutoPlaying = false;
    remaining = 0;
    emit();
  }

  function playNext() {
    if (!isAutoPlaying || remaining <= 0) {
      finish();
      return;
    }
    spawn(() => {
      remaining -= 1;
      if (isAutoPlaying && remaining > 0) {
        emit();
        setTimeoutFn(playNext, gapMs);
      } else {
        finish();
      }
    });
    emit();
  }

  function startRepeat(n) {
    isAutoPlaying = true;
    total = n;
    remaining = n;
    playNext();
  }

  function stop() {
    isAutoPlaying = false;
    remaining = 0;
    total = 0;
    streak = 0;
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
    getState: snapshot,
  };
}
