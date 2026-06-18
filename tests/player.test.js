import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlayer } from "../src/player.js";
import { makeFakeEngine } from "./fake-engine.js";

const immediate = { setTimeout: (cb) => cb() };

test("playOnce: 오디오 1개를 만들어 재생한다", () => {
  const engine = makeFakeEngine();
  const player = createPlayer({ engine });
  player.playOnce();
  assert.equal(engine.handles.length, 1);
  assert.ok(engine.handles[0]);
});

test("기본 음원 경로는 /assets/ssyagal.m4a 이다", () => {
  const engine = makeFakeEngine();
  const player = createPlayer({ engine });
  player.playOnce();
  assert.equal(engine.handles[0].src, "/assets/ssyagal.m4a");
});

test("연타: playOnce 를 두 번 호출하면 중첩 재생한다(이전 소리를 멈추지 않음)", () => {
  const engine = makeFakeEngine(); // autoEnd=false → 둘 다 재생 중 유지
  const player = createPlayer({ engine });
  player.playOnce();
  player.playOnce();
  assert.equal(engine.handles.length, 2);
  // 첫 번째 소리가 멈추지 않아야 한다(중첩)
  assert.equal(engine.handles[0].stopped, false);
  assert.equal(engine.handles[1].stopped, false);
});

test("연타 스트릭과 activeCount 를 추적한다", () => {
  const engine = makeFakeEngine(); // 재생 유지
  const player = createPlayer({ engine });
  player.playOnce();
  player.playOnce();
  const s = player.getState();
  assert.equal(s.streak, 2);
  assert.equal(s.activeCount, 2);
});

test("재생 중인 오디오가 모두 끝나면 연타 스트릭이 0으로 리셋된다", () => {
  const engine = makeFakeEngine();
  const player = createPlayer({ engine });
  player.playOnce();
  player.playOnce();
  engine.handles.forEach((h) => h.fireEnded());
  const s = player.getState();
  assert.equal(s.activeCount, 0);
  assert.equal(s.streak, 0);
});

test("startRepeat(3): 순차로 정확히 3회 재생하고 종료 상태가 된다", () => {
  const engine = makeFakeEngine({ autoEnd: true });
  const player = createPlayer({ engine, clipMs: 1000, ...immediate });
  player.startRepeat(3);
  assert.equal(engine.handles.length, 3);
  const s = player.getState();
  assert.equal(s.remaining, 0);
  assert.equal(s.isAutoPlaying, false);
});

test("순차 반복 기본 간격은 -200ms (다음 클립이 이전 클립 끝나기 200ms 전 시작)", () => {
  const engine = makeFakeEngine({ autoEnd: true });
  const gaps = [];
  const player = createPlayer({
    engine,
    clipMs: 1000, // 클립 길이 1000ms 가정
    setTimeout: (cb, ms) => {
      gaps.push(ms);
      cb();
    },
  });
  player.startRepeat(3);
  // 다음 클립 시작 간격 = max(0, 1000 + (-200)) = 800ms
  assert.ok(gaps.length >= 1);
  assert.ok(gaps.every((ms) => ms === 800));
});

test("onPlay 는 재생할 때마다 호출된다(연타·자동반복 공통)", () => {
  const engine = makeFakeEngine({ autoEnd: true });
  let plays = 0;
  const player = createPlayer({
    engine,
    clipMs: 1000,
    ...immediate,
    onPlay: () => {
      plays += 1;
    },
  });
  player.playOnce();
  assert.equal(plays, 1);
  player.startRepeat(3);
  assert.equal(plays, 4); // 1 + 3
});

test("isHot: x10 자동 반복은 true, x3 은 false", () => {
  const noTimer = { setTimeout: () => {} }; // 다음 클립 예약을 진행하지 않음
  const p3 = createPlayer({
    engine: makeFakeEngine(),
    clipMs: 1000,
    ...noTimer,
  });
  p3.startRepeat(3);
  assert.equal(p3.getState().isHot, false);

  const p10 = createPlayer({
    engine: makeFakeEngine(),
    clipMs: 1000,
    ...noTimer,
  });
  p10.startRepeat(10);
  assert.equal(p10.getState().isHot, true);
});

test("isHot: 계속 모드는 true", () => {
  const p = createPlayer({
    engine: makeFakeEngine(),
    clipMs: 1000,
    setTimeout: () => {},
  });
  p.startContinuous();
  assert.equal(p.getState().isHot, true);
});

test("isHot: 10회 이상 연타하고 재생 중이면 true", () => {
  const engine = makeFakeEngine(); // 재생 유지
  const player = createPlayer({ engine });
  for (let i = 0; i < 10; i += 1) player.playOnce();
  assert.equal(player.getState().isHot, true);
});

test("stop(): 재생 중인 모든 소리를 멈추고 상태를 리셋한다", () => {
  const engine = makeFakeEngine(); // 재생 유지
  const player = createPlayer({ engine });
  player.playOnce();
  player.playOnce();
  player.stop();
  assert.ok(engine.handles.every((h) => h.stopped === true));
  const s = player.getState();
  assert.equal(s.isAutoPlaying, false);
  assert.equal(s.remaining, 0);
  assert.equal(s.total, 0);
  assert.equal(s.activeCount, 0);
  assert.equal(s.streak, 0);
});

test("startContinuous: 중지 전까지 계속 재생하며 isContinuous=true", () => {
  const engine = makeFakeEngine(); // autoEnd=false → ended 안 됨
  const timers = []; // 예약된 다음-클립 타이머를 수동으로 진행
  const player = createPlayer({
    engine,
    clipMs: 1000,
    setTimeout: (cb) => timers.push(cb),
  });
  player.startContinuous();
  assert.equal(engine.handles.length, 1);
  let s = player.getState();
  assert.equal(s.isContinuous, true);
  assert.equal(s.isAutoPlaying, true);

  // 예약 타이머를 진행시키면 다음 클립이 계속 재생된다
  timers.shift()();
  assert.equal(engine.handles.length, 2);
  timers.shift()();
  assert.equal(engine.handles.length, 3);

  // 중지하면 더 이상 늘지 않는다
  player.stop();
  const count = engine.handles.length;
  while (timers.length) timers.shift()();
  assert.equal(engine.handles.length, count);
  s = player.getState();
  assert.equal(s.isContinuous, false);
  assert.equal(s.isAutoPlaying, false);
});

test("onChange 는 startRepeat 진행에 따라 호출된다", () => {
  const engine = makeFakeEngine({ autoEnd: true });
  const states = [];
  const player = createPlayer({
    engine,
    clipMs: 1000,
    ...immediate,
    onChange: (s) => states.push(s),
  });
  player.startRepeat(2);
  // 시작 + 각 재생 종료 등 여러 번 호출
  assert.ok(states.length >= 3);
  assert.equal(states[states.length - 1].remaining, 0);
});