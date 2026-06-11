import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlayer } from "../src/player.js";

// 가짜 Audio 팩토리. autoEnd=true면 play() 시 즉시 'ended' 발생(순차 체인 동기화용).
function makeFakeAudioFactory({ autoEnd = false } = {}) {
  const created = [];
  function factory(src) {
    const listeners = {};
    const audio = {
      src,
      played: false,
      paused: false,
      currentTime: 0,
      addEventListener(ev, cb) {
        (listeners[ev] ||= []).push(cb);
      },
      play() {
        this.played = true;
        if (autoEnd) this.fire("ended");
      },
      pause() {
        this.paused = true;
      },
      fire(ev) {
        (listeners[ev] || []).forEach((cb) => cb());
      },
    };
    created.push(audio);
    return audio;
  }
  factory.created = created;
  return factory;
}

const immediate = { setTimeout: (cb) => cb() };

test("playOnce: 오디오 1개를 만들어 재생한다", () => {
  const makeAudio = makeFakeAudioFactory();
  const player = createPlayer({ makeAudio });
  player.playOnce();
  assert.equal(makeAudio.created.length, 1);
  assert.equal(makeAudio.created[0].played, true);
});

test("기본 음원 경로는 /assets/ssyagal.m4a 이다", () => {
  const makeAudio = makeFakeAudioFactory();
  const player = createPlayer({ makeAudio });
  player.playOnce();
  assert.equal(makeAudio.created[0].src, "/assets/ssyagal.m4a");
});

test("연타: playOnce 를 두 번 호출하면 중첩 재생한다(이전 소리를 멈추지 않음)", () => {
  const makeAudio = makeFakeAudioFactory(); // autoEnd=false → 둘 다 재생 중 유지
  const player = createPlayer({ makeAudio });
  player.playOnce();
  player.playOnce();
  assert.equal(makeAudio.created.length, 2);
  assert.equal(makeAudio.created[0].played, true);
  assert.equal(makeAudio.created[1].played, true);
  // 첫 번째 소리가 멈추지 않아야 한다(중첩)
  assert.equal(makeAudio.created[0].paused, false);
});

test("startRepeat(3): 순차로 정확히 3회 재생하고 종료 상태가 된다", () => {
  const makeAudio = makeFakeAudioFactory({ autoEnd: true });
  const player = createPlayer({ makeAudio, ...immediate });
  player.startRepeat(3);
  assert.equal(makeAudio.created.length, 3);
  const s = player.getState();
  assert.equal(s.remaining, 0);
  assert.equal(s.isAutoPlaying, false);
});

test("stop(): 재생 중인 모든 소리를 멈추고 상태를 리셋한다", () => {
  const makeAudio = makeFakeAudioFactory(); // 재생 유지
  const player = createPlayer({ makeAudio });
  player.playOnce();
  player.playOnce();
  player.stop();
  assert.ok(makeAudio.created.every((a) => a.paused === true));
  const s = player.getState();
  assert.equal(s.isAutoPlaying, false);
  assert.equal(s.remaining, 0);
  assert.equal(s.total, 0);
});

test("onChange 는 startRepeat 진행에 따라 호출된다", () => {
  const makeAudio = makeFakeAudioFactory({ autoEnd: true });
  const states = [];
  const player = createPlayer({
    makeAudio,
    ...immediate,
    onChange: (s) => states.push(s),
  });
  player.startRepeat(2);
  // 시작(0/2) + 각 재생 종료(1/2, 2/2) 최소 3회 이상 호출
  assert.ok(states.length >= 3);
  assert.equal(states[states.length - 1].remaining, 0);
});
