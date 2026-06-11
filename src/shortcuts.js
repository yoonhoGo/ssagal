// 키보드 단축키 → 동작 매핑.
// resolveShortcut 은 순수 함수(테스트 가능)로 키 이벤트를 동작 기술자로 변환하고,
// bindShortcuts 는 그 결과를 player 메서드에 연결한다.

// 화면 버튼과 동일한 동작을 키보드로:
//   실행(1회 재생) : Space / Enter
//   반복(횟수)     : 3 → x3, 5 → x5, 0 → x10
//   반복(계속)     : R
//   정지           : Esc / S
export function resolveShortcut(e) {
  // OS·앱 단축키(Cmd+R 새로고침, Cmd+Q 종료 등)는 그대로 통과시킨다.
  if (e.metaKey || e.ctrlKey || e.altKey) return null;

  const key = e.key;
  switch (key) {
    case " ":
    case "Enter":
      return { type: "play" };
    case "3":
      return { type: "repeat", times: 3 };
    case "5":
      return { type: "repeat", times: 5 };
    case "0":
      return { type: "repeat", times: 10 };
    case "r":
    case "R":
      return { type: "continuous" };
    case "s":
    case "S":
    case "Escape":
      return { type: "stop" };
    default:
      return null;
  }
}

// player 에 키보드 단축키를 연결한다. target 기본값은 window.
// keydown 자동 반복(키 꾹 누르기)은 무시해 의도치 않은 연타를 막는다.
export function bindShortcuts(player, { target = window } = {}) {
  const handler = (e) => {
    if (e.repeat) return;
    const action = resolveShortcut(e);
    if (!action) return;
    e.preventDefault();
    switch (action.type) {
      case "play":
        player.playOnce();
        break;
      case "repeat":
        player.startRepeat(action.times);
        break;
      case "continuous":
        player.startContinuous();
        break;
      case "stop":
        player.stop();
        break;
    }
  };
  target.addEventListener("keydown", handler);
  return () => target.removeEventListener("keydown", handler);
}
