import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpeaker } from "../src/speak.js";

// 동기적으로 onend 를 즉시 호출하는 가짜 synth
function makeFakeSynth(voices = [{ lang: "ko-KR", name: "Yuna" }]) {
  return {
    spoken: [],
    cancelCount: 0,
    speak(u) {
      this.spoken.push(u);
      if (typeof u.onend === "function") u.onend();
    },
    cancel() {
      this.cancelCount += 1;
    },
    getVoices() {
      return voices;
    },
  };
}

// 자동 반복의 발화 간격을 즉시 실행시켜 테스트를 동기화
const sync = {
  makeUtterance: () => ({}),
  setTimeout: (cb) => cb(),
};

test("speakOnce: cancel 후 1회 발화한다", () => {
  const synth = makeFakeSynth();
  const speaker = createSpeaker(synth, sync);
  speaker.speakOnce();
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.cancelCount, 1);
});

test("발화 텍스트 기본값은 '쌰~갈~!' 이다", () => {
  const synth = makeFakeSynth();
  const speaker = createSpeaker(synth, {
    setTimeout: (cb) => cb(),
    makeUtterance: (t) => ({ text: t }),
  });
  speaker.speakOnce();
  assert.equal(synth.spoken[0].text, "쌰~갈~!");
});

test("startRepeat(3): 정확히 3회 발화하고 종료 상태가 된다", () => {
  const synth = makeFakeSynth();
  const speaker = createSpeaker(synth, sync);
  speaker.startRepeat(3);
  assert.equal(synth.spoken.length, 3);
  const s = speaker.getState();
  assert.equal(s.remaining, 0);
  assert.equal(s.isAutoPlaying, false);
});

test("한국어 음성이 있으면 utterance.voice 로 선택한다", () => {
  const synth = makeFakeSynth([
    { lang: "en-US", name: "Alex" },
    { lang: "ko-KR", name: "Yuna" },
  ]);
  const speaker = createSpeaker(synth, sync);
  speaker.speakOnce();
  assert.equal(synth.spoken[0].voice.name, "Yuna");
});

test("한국어 음성이 없으면 voice 없이도 발화한다(fallback)", () => {
  const synth = makeFakeSynth([{ lang: "en-US", name: "Alex" }]);
  const speaker = createSpeaker(synth, sync);
  speaker.speakOnce();
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].voice, undefined);
});

test("stop(): 상태를 리셋하고 cancel 한다", () => {
  const synth = makeFakeSynth();
  const speaker = createSpeaker(synth, sync);
  speaker.stop();
  const s = speaker.getState();
  assert.equal(s.isAutoPlaying, false);
  assert.equal(s.remaining, 0);
  assert.equal(s.total, 0);
  assert.ok(synth.cancelCount >= 1);
});

test("onChange 는 startRepeat 진행에 따라 호출된다", () => {
  const synth = makeFakeSynth();
  const states = [];
  const speaker = createSpeaker(synth, {
    ...sync,
    onChange: (s) => states.push(s),
  });
  speaker.startRepeat(2);
  // 시작(0/2) + 각 발화 종료(1/2, 2/2) 최소 3회 이상 호출
  assert.ok(states.length >= 3);
  assert.equal(states[states.length - 1].remaining, 0);
});
