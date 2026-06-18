// 음원 재생 + 자동 반복 상태 머신.
// engine(Web Audio 엔진, 기본 createAudioEngine())과 타이머를 주입받아 테스트 가능하게 한다.
// 연타 시 매번 가벼운 AudioBufferSourceNode 를 띄워 중첩 재생한다(디코딩은 엔진이 1회 캐싱).
import { createAudioEngine } from "./audio-engine.js";

export function createPlayer(options = {}) {
  const defaultSrc = "/assets/ssyagal.m4a";
  let src = options.src ?? defaultSrc;
  // 순차 반복 사이 간격(ms). 음수면 클립이 끝나기 전에 다음 클립이 겹쳐 시작한다.
  let gapMs = options.gapMs ?? -200;
  const engine = options.engine ?? createAudioEngine();
  const setTimeoutFn = options.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
  const onChange = options.onChange ?? (() => {});
  const onPlay = options.onPlay ?? (() => {}); // 재생을 시작할 때마다 호출(연타·자동반복 공통)
  const hotThreshold = options.hotThreshold ?? 10; // 불타는 효과 임계값

  const active = new Set(); // 현재 재생 중인 오디오 handle (stop 시 일괄 정지용)
  let isAutoPlaying = false;
  let remaining = 0;
  let total = 0;
  let streak = 0; // 연속 연타 횟수 (재생 중인 소리가 모두 끝나면 0으로 리셋)
  let isContinuous = false; // '계속' 무한 재생 모드
  let knownClipMs = options.clipMs ?? null; // 클립 길이 캐시(런타임에 버퍼 duration 으로 학습)

  function snapshot() {
    const activeCount = active.size;
    // "불타는" 상태: 계속 모드 || hotThreshold 이상 자동 반복 중 || hotThreshold 이상 연타하고 재생 중
    const isHot =
      isContinuous ||
      (isAutoPlaying && total >= hotThreshold) ||
      (streak >= hotThreshold && activeCount > 0);
    return {
      isAutoPlaying,
      remaining,
      total,
      activeCount,
      streak,
      isContinuous,
      isHot,
    };
  }

  function emit() {
    onChange(snapshot());
  }

  function remove(handle) {
    if (active.delete(handle) && active.size === 0) {
      streak = 0; // 모든 소리가 꺼지면 연타 스트릭 리셋
    }
  }

  // 새 오디오를 재생한다. onEnded는 재생 종료 시 1회 호출.
  // 사용자 제스처(click/keydown) 컨텍스트 안에서 호출되므로 resume() 으로 자동재생 정책을 해소한다.
  // handle 을 미리 선언(초기 undefined)하는 이유: 실제 엔진은 onended 가 비동기라 항상
  // 할당 후에 호출되지만, 테스트용 가짜 엔진은 동기적으로 onEnded 를 칠 수 있어 그 시점엔
  // handle 이 할당 전이다. 선언만 분리해 두면 undefined 참조로 no-op 처리되고(아래 remove),
  // 동기 종료 경로(순차 반복)의 streak 리셋은 의미 없으므로 안전하다.
  function spawn(onEnded) {
    engine.resume().catch(() => {});
    let handle;
    handle = engine.play(src, (err) => {
      remove(handle);
      if (err) {
        emit(); // 디코딩/로드 실패 → 상태만 반영
        return;
      }
      if (onEnded) onEnded();
      else emit();
    });
    active.add(handle);
    onPlay();
    return handle;
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

  // 아직 모르면 버퍼 duration 으로 클립 길이를 학습(캐시)한다.
  function learnClip(handle) {
    if (knownClipMs == null && handle.duration != null && handle.duration > 0) {
      knownClipMs = handle.duration * 1000;
    }
  }

  // 다음 클립을 "현재 클립 시작 + (클립길이 + gapMs)" 시점에 예약한다.
  // gapMs 가 음수면 이전 클립이 끝나기 전에 겹쳐 시작된다.
  function scheduleNext(handle, launch) {
    const fire = () => {
      learnClip(handle);
      setTimeoutFn(() => {
        if (isAutoPlaying) launch();
      }, Math.max(0, (knownClipMs ?? 0) + gapMs));
    };
    // 클립 길이를 이미 알거나 지금 알 수 있으면 즉시 예약, 아니면 버퍼 준비 후 예약.
    if (knownClipMs != null || (handle.duration != null && handle.duration > 0)) {
      fire();
    } else {
      handle.whenReady(fire);
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
      const handle = spawn(() => {
        remaining -= 1;
        if (remaining <= 0 || !isAutoPlaying) {
          finish();
        } else {
          emit();
        }
      });
      emit();
      if (launched < n) {
        scheduleNext(handle, launch);
      }
    };

    launch();
  }

  function startContinuous() {
    startRepeat(Infinity);
  }

  // 음원 경로를 런타임에 교체한다(설정에서 사운드 변경). 다음 spawn 부터 적용된다.
  // 클립 길이는 음원마다 다르므로 캐시를 비워 새로 학습하게 하고, 엔진에 prefetch 를 건다.
  function setSrc(newSrc) {
    src = newSrc ?? defaultSrc;
    knownClipMs = null;
    engine.loadBuffer(src).catch(() => {});
  }

  // 순차 반복 간격(ms)을 런타임에 바꾼다. 유효하지 않은 값은 무시한다.
  function setGap(ms) {
    if (Number.isFinite(ms)) gapMs = ms;
  }

  function stop() {
    isAutoPlaying = false;
    isContinuous = false;
    remaining = 0;
    total = 0;
    streak = 0;
    for (const handle of active) {
      handle.stop(); // onEnded 억제 → stop 후 잔여 emit 방지
    }
    active.clear();
    emit();
  }

  return {
    playOnce,
    startRepeat,
    startContinuous,
    stop,
    setSrc,
    setGap,
    getState: snapshot,
  };
}