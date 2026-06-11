import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveShortcut, bindShortcuts } from "../src/shortcuts.js";

// 키 이벤트 흉내. 필요한 필드만 채운다.
function keyEvent(key, mods = {}) {
  return {
    key,
    metaKey: mods.metaKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    altKey: mods.altKey ?? false,
  };
}

test("resolveShortcut: Space/Enter 는 실행(play)", () => {
  assert.deepEqual(resolveShortcut(keyEvent(" ")), { type: "play" });
  assert.deepEqual(resolveShortcut(keyEvent("Enter")), { type: "play" });
});

test("resolveShortcut: 3/5/0 은 각각 x3/x5/x10 반복", () => {
  assert.deepEqual(resolveShortcut(keyEvent("3")), { type: "repeat", times: 3 });
  assert.deepEqual(resolveShortcut(keyEvent("5")), { type: "repeat", times: 5 });
  assert.deepEqual(resolveShortcut(keyEvent("0")), { type: "repeat", times: 10 });
});

test("resolveShortcut: R 은 계속(continuous), 대소문자 모두", () => {
  assert.deepEqual(resolveShortcut(keyEvent("r")), { type: "continuous" });
  assert.deepEqual(resolveShortcut(keyEvent("R")), { type: "continuous" });
});

test("resolveShortcut: Esc/S 는 정지(stop)", () => {
  assert.deepEqual(resolveShortcut(keyEvent("Escape")), { type: "stop" });
  assert.deepEqual(resolveShortcut(keyEvent("s")), { type: "stop" });
  assert.deepEqual(resolveShortcut(keyEvent("S")), { type: "stop" });
});

test("resolveShortcut: 수식키(Cmd/Ctrl/Alt) 조합은 무시(null)", () => {
  assert.equal(resolveShortcut(keyEvent("r", { metaKey: true })), null);
  assert.equal(resolveShortcut(keyEvent(" ", { ctrlKey: true })), null);
  assert.equal(resolveShortcut(keyEvent("s", { altKey: true })), null);
});

test("resolveShortcut: 매핑 없는 키는 null", () => {
  assert.equal(resolveShortcut(keyEvent("a")), null);
  assert.equal(resolveShortcut(keyEvent("1")), null);
});

// 가짜 이벤트 타겟. keydown 리스너를 모아 dispatch 로 호출한다.
function makeTarget() {
  const listeners = [];
  return {
    addEventListener(ev, cb) {
      if (ev === "keydown") listeners.push(cb);
    },
    removeEventListener(ev, cb) {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatch(e) {
      listeners.forEach((cb) => cb(e));
    },
    get count() {
      return listeners.length;
    },
  };
}

function makeFakePlayer() {
  const calls = [];
  return {
    calls,
    playOnce: () => calls.push(["playOnce"]),
    startRepeat: (n) => calls.push(["startRepeat", n]),
    startContinuous: () => calls.push(["startContinuous"]),
    stop: () => calls.push(["stop"]),
  };
}

test("bindShortcuts: 키 입력을 player 메서드로 연결한다", () => {
  const target = makeTarget();
  const player = makeFakePlayer();
  bindShortcuts(player, { target });

  const dispatch = (key) => {
    let prevented = false;
    target.dispatch({
      key,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      repeat: false,
      preventDefault: () => {
        prevented = true;
      },
    });
    return prevented;
  };

  assert.equal(dispatch(" "), true);
  assert.equal(dispatch("3"), true);
  assert.equal(dispatch("R"), true);
  assert.equal(dispatch("Escape"), true);

  assert.deepEqual(player.calls, [
    ["playOnce"],
    ["startRepeat", 3],
    ["startContinuous"],
    ["stop"],
  ]);
});

test("bindShortcuts: 자동 반복(repeat) 키 이벤트는 무시한다", () => {
  const target = makeTarget();
  const player = makeFakePlayer();
  bindShortcuts(player, { target });

  target.dispatch({
    key: " ",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    repeat: true,
    preventDefault: () => {},
  });

  assert.deepEqual(player.calls, []);
});

test("bindShortcuts: 반환된 해제 함수는 리스너를 제거한다", () => {
  const target = makeTarget();
  const player = makeFakePlayer();
  const off = bindShortcuts(player, { target });
  assert.equal(target.count, 1);
  off();
  assert.equal(target.count, 0);
});
