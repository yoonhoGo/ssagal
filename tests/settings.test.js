import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSettings,
  sanitize,
  DEFAULTS,
  defaultSoundSrc,
  DEFAULT_SOUND_BY_EFFECT,
} from "../src/settings.js";

// 인메모리 가짜 storage (localStorage 인터페이스).
function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test("load: 저장된 값이 없으면 기본값을 돌려준다", () => {
  const s = createSettings({ storage: makeStorage() });
  assert.deepEqual(s.load(), DEFAULTS);
});

test("save: 부분 갱신을 기존 설정에 병합해 저장한다", () => {
  const s = createSettings({ storage: makeStorage() });
  s.save({ gapMs: 100 });
  const after = s.save({ effect: "rainbow" });
  assert.equal(after.gapMs, 100); // 이전 저장값 유지
  assert.equal(after.effect, "rainbow");
});

test("save: 공주 효과를 저장한다", () => {
  const s = createSettings({ storage: makeStorage() });
  const after = s.save({ effect: "heart" });
  assert.equal(after.effect, "heart");
});

test("save: 쌰갈 효과를 저장한다", () => {
  const s = createSettings({ storage: makeStorage() });
  const after = s.save({ effect: "scream" });
  assert.equal(after.effect, "scream");
});

test("save: 갈 효과를 저장한다", () => {
  const s = createSettings({ storage: makeStorage() });
  const after = s.save({ effect: "scold" });
  assert.equal(after.effect, "scold");
});

test("defaultSoundSrc: 효과별 기본 번들 음원을 돌려준다", () => {
  assert.equal(defaultSoundSrc("scold"), "/assets/gal.m4a");
  assert.equal(defaultSoundSrc("scream"), "/assets/ssyagal.m4a");
  assert.equal(defaultSoundSrc("heart"), "/assets/ssyagal.m4a");
});

test("defaultSoundSrc: 알 수 없는 효과는 기본값(fire) 음원으로 폴백한다", () => {
  assert.equal(defaultSoundSrc("unknown"), DEFAULT_SOUND_BY_EFFECT.fire);
});

test("save: 저장 후 load 하면 같은 값이 나온다(영속)", () => {
  const storage = makeStorage();
  createSettings({ storage }).save({ gapMs: -50, effect: "none" });
  const reloaded = createSettings({ storage }).load();
  assert.equal(reloaded.gapMs, -50);
  assert.equal(reloaded.effect, "none");
});

test("sanitize: 알 수 없는 효과는 기본값(fire)으로 보정한다", () => {
  assert.equal(sanitize({ effect: "explode" }).effect, "fire");
});

test("sanitize: 숫자가 아닌 gapMs 는 기본값으로 보정한다", () => {
  assert.equal(sanitize({ gapMs: "abc" }).gapMs, DEFAULTS.gapMs);
  assert.equal(sanitize({ gapMs: "150" }).gapMs, 150); // 숫자 문자열은 변환
});

test("sanitize: 문자열이 아닌 이미지/사운드는 null 로 보정한다", () => {
  const r = sanitize({ imageDataUrl: 123, soundDataUrl: {} });
  assert.equal(r.imageDataUrl, null);
  assert.equal(r.soundDataUrl, null);
});

test("load: 손상된 JSON 이면 기본값으로 폴백한다", () => {
  const s = createSettings({ storage: makeStorage({ "ssagal.settings": "{not json" }) });
  assert.deepEqual(s.load(), DEFAULTS);
});

test("reset: 저장값을 지우고 기본값을 돌려준다", () => {
  const storage = makeStorage();
  const s = createSettings({ storage });
  s.save({ gapMs: 999 });
  assert.deepEqual(s.reset(), DEFAULTS);
  assert.deepEqual(s.load(), DEFAULTS);
});
