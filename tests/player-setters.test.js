import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlayer } from "../src/player.js";

// 가짜 Audio 팩토리 (player.test.js 와 동일한 최소 구현).
function makeFakeAudioFactory() {
  const created = [];
  function factory(src) {
    const listeners = {};
    const audio = {
      src,
      played: false,
      paused: false,
      currentTime: 0,
      duration: NaN,
      addEventListener(ev, cb) {
        (listeners[ev] ||= []).push(cb);
      },
      play() {
        this.played = true;
      },
      pause() {
        this.paused = true;
      },
    };
    created.push(audio);
    return audio;
  }
  factory.created = created;
  return factory;
}

test("setSrc: 음원 경로를 교체하면 다음 재생부터 적용된다", () => {
  const makeAudio = makeFakeAudioFactory();
  const player = createPlayer({ makeAudio });
  player.setSrc("data:audio/mp3;base64,AAA");
  player.playOnce();
  assert.equal(makeAudio.created[0].src, "data:audio/mp3;base64,AAA");
});

test("setSrc(null): 기본 음원 경로로 되돌린다", () => {
  const makeAudio = makeFakeAudioFactory();
  const player = createPlayer({ src: "data:x", makeAudio });
  player.setSrc(null);
  player.playOnce();
  assert.equal(makeAudio.created[0].src, "/assets/ssyagal.m4a");
});

test("setGap: 변경한 간격이 다음 클립 예약 시점에 반영된다", () => {
  const makeAudio = makeFakeAudioFactory();
  const delays = [];
  const player = createPlayer({
    makeAudio,
    clipMs: 1000, // 클립 길이 주입
    setTimeout: (_cb, ms) => delays.push(ms), // 예약만 기록(실행 안 함)
  });
  player.setGap(-300);
  player.startRepeat(3);
  // 예약 지연 = max(0, clipMs + gapMs) = 1000 + (-300)
  assert.equal(delays[0], 700);
});

test("setGap: 유효하지 않은 값은 무시한다", () => {
  const makeAudio = makeFakeAudioFactory();
  const delays = [];
  const player = createPlayer({
    makeAudio,
    gapMs: -200,
    clipMs: 1000,
    setTimeout: (_cb, ms) => delays.push(ms),
  });
  player.setGap(NaN); // 무시 → 기존 -200 유지
  player.startRepeat(2);
  assert.equal(delays[0], 800); // 1000 + (-200)
});
