// 테스트용 가짜 오디오 엔진. Web Audio 없이 player 상태 머신을 검증한다.
// 인터페이스는 src/audio-engine.js 와 동일.
//   engine.handles         — 지금까지 play() 로 만든 handle 목록(== 기존 makeAudio.created)
//   handle.src             — 재생 요청한 음원 경로
//   handle.stopped         — stop() 됐는지(== 기존 audio.paused)
//   handle.fireEnded(err)  — 재생 종료를 흉내낸다(== 기존 audio.fire("ended"))
// autoEnd=true 면 play() 시 즉시 fireEnded(null) 를 쳐 순차 체인을 동기화한다.
export function makeFakeEngine({ autoEnd = false, duration = NaN } = {}) {
  const handles = [];
  const loadBufferCalls = [];

  function play(src, onEnded) {
    const handle = {
      src,
      stopped: false,
      _onEnded: onEnded,
      duration: Number.isFinite(duration) ? duration : null,
      stop() {
        if (this.stopped) return;
        this.stopped = true;
        this._onEnded = null; // stop 시 onEnded 억제(실제 엔진과 동일)
      },
      // 테스트에선 clipMs 를 주입해 학습 경로를 건너뛰므로 즉시 호출한다.
      whenReady(cb) {
        cb();
      },
      fireEnded(err) {
        if (this.stopped) return;
        const cb = this._onEnded;
        this._onEnded = null;
        if (cb) cb(err);
      },
    };
    handles.push(handle);
    if (autoEnd) handle.fireEnded(null);
    return handle;
  }

  return {
    play,
    loadBuffer: (src) => {
      loadBufferCalls.push(src);
      return Promise.resolve();
    },
    resume: () => Promise.resolve(),
    close: () => {},
    handles,
    loadBufferCalls,
  };
}