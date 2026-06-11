// 음원 재생 + 자동 반복 상태 머신.
// makeAudio(기본 (src) => new Audio(src))와 타이머를 주입받아 테스트 가능하게 한다.
// 연타 시 매번 새 Audio 인스턴스를 만들어 중첩 재생한다.
export function createPlayer(options = {}) {
  const src = options.src ?? "/assets/ssyagal.m4a";
  // 순차 반복 사이 간격(ms). 음수면 클립이 끝나기 전에 다음 클립이 겹쳐 시작한다.
  const gapMs = options.gapMs ?? -100;
  const makeAudio = options.makeAudio ?? ((s) => new Audio(s));
  const setTimeoutFn = options.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
  const onChange = options.onChange ?? (() => {});

  const active = new Set(); // 현재 재생 중인 Audio (stop 시 일괄 정지용)
  let isAutoPlaying = false;
  let remaining = 0;
  let total = 0;
  let streak = 0; // 연속 연타 횟수 (재생 중인 소리가 모두 끝나면 0으로 리셋)
  let isContinuous = false; // '계속' 무한 재생 모드
  let knownClipMs = options.clipMs ?? null; // 클립 길이 캐시(런타임에 audio.duration으로 학습)

  function snapshot() {
    return {
      isAutoPlaying,
      remaining,
      total,
      activeCount: active.size,
      streak,
      isContinuous,
    };
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
    isContinuous = false;
    remaining = 0;
    emit();
  }

  // 다음 클립을 "현재 클립 시작 + (클립길이 + gapMs)" 시점에 예약한다.
  // gapMs 가 음수면 이전 클립이 끝나기 전에 겹쳐 시작된다.
  function scheduleNext(audio, launch) {
    const fire = () => {
      const durMs = knownClipMs ?? 0;
      setTimeoutFn(() => {
        if (isAutoPlaying) launch();
      }, Math.max(0, durMs + gapMs));
    };
    if (knownClipMs != null) {
      fire();
      return;
    }
    // 클립 길이를 아직 모르면 메타데이터에서 학습 후 예약.
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      knownClipMs = audio.duration * 1000;
      fire();
    } else {
      audio.addEventListener(
        "loadedmetadata",
        () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            knownClipMs = audio.duration * 1000;
          }
          fire();
        },
        { once: true },
      );
    }
  }

  // n 이 Infinity 면 '계속' 모드로 중지 전까지 무한 재생한다.
  function startRepeat(n) {
    isAutoPlaying = true;
    isContinuous = !Number.isFinite(n);
    total = n;
    remaining = n;
    let launched = 0;

    const launch = () => {
      if (!isAutoPlaying || launched >= n) return;
      launched += 1;
      const audio = spawn(() => {
        remaining -= 1;
        if (remaining <= 0 || !isAutoPlaying) {
          finish();
        } else {
          emit();
        }
      });
      emit();
      if (launched < n) {
        scheduleNext(audio, launch);
      }
    };

    launch();
  }

  function startContinuous() {
    startRepeat(Infinity);
  }

  function stop() {
    isAutoPlaying = false;
    isContinuous = false;
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
    startContinuous,
    stop,
    getState: snapshot,
  };
}
