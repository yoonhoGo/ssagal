// Web Audio 기반 오디오 엔진.
// 음원을 최초 1회 decodeAudioData 로 디코딩해 AudioBuffer 를 캐싱하고,
// 매 재생은 초경량 AudioBufferSourceNode 로 중첩 재생한다(디코딩 비용 0 → 연타 jank 해소).
// player.js 가 주입받아 쓰도록 팩토리 형태로 export 한다.
//
// 모듈 top-level 에 부작용이 없다(AudioContext/fetch 참조는 모두 함수 본문 안).
// 따라서 Node 테스트 환경에서 player.js 가 정적 import 해도 평가 에러가 나지 않는다.

export function createAudioEngine({ AudioContextCtor } = {}) {
  // 캐시: src → AudioBuffer. 한 번 디코딩한 음원은 영구 재사용(토이 앱, 메모리 미미).
  const bufferCache = new Map();
  // in-flight: src → Promise<AudioBuffer>. 동일 src 동시 로드 중복 디코딩 방지(dedup).
  const inflight = new Map();
  let ctx = null;

  // AudioContext 는 사용자 제스처 컨텍스트에서 처음 필요할 때 지연 생성한다.
  // 생성자를 주입받지 않았으면 브라우저 전용 심볼을 함수 본문에서 찾는다(폴백 포함).
  function ensureContext() {
    if (ctx) return ctx;
    const Ctor =
      AudioContextCtor ??
      globalThis.AudioContext ??
      globalThis.webkitAudioContext ??
      null;
    ctx = Ctor ? new Ctor() : null;
    return ctx;
  }

  // src → Promise<AudioBuffer>. 캐시 히트/in-flight dedup/신규 로드.
  // data URL 도 fetch 로 처리 가능하며, 실패 시 캐시하지 않아 재시도를 허용한다.
  function loadBuffer(src) {
    const cached = bufferCache.get(src);
    if (cached) return Promise.resolve(cached);
    const pending = inflight.get(src);
    if (pending) return pending;

    const c = ensureContext();
    const p = fetch(src)
      .then((res) => res.arrayBuffer())
      .then((ab) => c.decodeAudioData(ab))
      .then((buffer) => {
        bufferCache.set(src, buffer);
        inflight.delete(src);
        return buffer;
      })
      .catch((err) => {
        inflight.delete(src); // 실패 시 in-flight 만 해제(캐시는 두지 않음 → 재시도 가능)
        throw err;
      });
    inflight.set(src, p);
    return p;
  }

  // suspended 상태(사용자 제스처 전)를 해소한다. running 이면 no-op.
  function resume() {
    const c = ensureContext();
    if (!c) return Promise.resolve();
    if (c.state === "suspended") return c.resume().catch(() => {});
    return Promise.resolve();
  }

  function close() {
    if (!ctx) return;
    try {
      ctx.close();
    } catch {
      /* 이미 닫힌 경우 무시 */
    }
    ctx = null;
  }

  // 단일 source 노드를 만들어 재생. onEnded 는 자연 종료 시 1회 호출.
  function startSource(buffer, onEnded) {
    const c = ensureContext();
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    let stopped = false;
    source.onended = () => {
      if (stopped) return; // stop() 으로 종료된 경우엔 onEnded 억제
      try {
        source.disconnect();
      } catch {
        /* 무시 */
      }
      if (onEnded) onEnded();
    };
    source.start(0);
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        source.onended = null; // 자연 onended 억제
        try {
          source.stop();
        } catch {
          /* 이미 끝난 경우 무시 */
        }
        try {
          source.disconnect();
        } catch {
          /* 무시 */
        }
      },
    };
  }

  // handle: 외부에서 stop 할 수 있고, 버퍼 준비 시점을 알 수 있다.
  // 캐시 히트면 즉시 재생해 duration 을 바로 채운다.
  // 캐시 미스면 handle 을 먼저 반환하고 비동기 로드 후 start 한다(첫 재생만 약간 딜레이).
  function play(src, onEnded) {
    const buffer = bufferCache.get(src);
    if (buffer) {
      const s = startSource(buffer, onEnded);
      return {
        src,
        duration: buffer.duration,
        stop: s.stop,
        whenReady(cb) {
          cb(); // 이미 준비됨 → 동기 호출
        },
      };
    }

    // 캐시 미스: 로드 완료 후 start. 그 전까지 stop 은 보류 start 를 억제한다.
    let stopped = false;
    let pendingStop = null;
    const readyCallbacks = [];
    let resolvedDuration = null;

    loadBuffer(src)
      .then((buf) => {
        if (stopped) return; // 로드 중 stop 된 경우 재생하지 않는다
        const s = startSource(buf, onEnded);
        pendingStop = s.stop;
        resolvedDuration = buf.duration;
        const cbs = readyCallbacks.splice(0);
        for (const cb of cbs) cb();
      })
      .catch(() => {
        if (stopped) return;
        // 디코딩/로드 실패 → 에러 경로로 onEnded 호출(player 는 emit 만 하고 진행)
        const cbs = readyCallbacks.splice(0);
        for (const cb of cbs) cb(null);
        if (onEnded) onEnded(new Error("decode"));
      });

    return {
      src,
      get duration() {
        return resolvedDuration;
      },
      stop() {
        if (stopped) return;
        stopped = true;
        if (pendingStop) pendingStop();
      },
      whenReady(cb) {
        // 이미 로드 완료했거나 실패했으면 바로, 아니면 대기열에 등록.
        // resolvedDuration 이 null 이고 아직 진행 중이면 큐잉.
        if (resolvedDuration != null || stopped) cb(resolvedDuration);
        else readyCallbacks.push(cb);
      },
    };
  }

  return { play, loadBuffer, resume, close };
}