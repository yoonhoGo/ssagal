// 설정 저장/로드 (순수 로직, DOM 비의존).
// storage(기본 localStorage)를 주입받아 브라우저 없이 단위 테스트할 수 있다.
// 이미지/사운드는 data URL 문자열로 저장해 새로고침 후에도 유지된다.

export const EFFECTS = ["fire", "rainbow", "heart", "scream", "scold", "none"];

// 효과별 기본 번들 음원. 커스텀 음원이 없을 때 이 경로를 사용한다.
export const DEFAULT_SOUND_BY_EFFECT = Object.freeze({
  fire: "/assets/ssyagal.m4a",
  rainbow: "/assets/ssyagal.m4a",
  heart: "/assets/ssyagal.m4a",
  scream: "/assets/ssyagal.m4a",
  scold: "/assets/gal.m4a",
  none: "/assets/ssyagal.m4a",
});

// 효과별 기본 말풍선 글씨. 커스텀 이미지가 없을 때 이 텍스트를 보여준다.
export const DEFAULT_TEXT_BY_EFFECT = Object.freeze({
  fire: "쌰갈!",
  rainbow: "쌰갈!",
  heart: "쌰갈!",
  scream: "쌰갈!",
  scold: "!!!갈!!!",
  none: "쌰갈!",
});

export function defaultSoundSrc(effect) {
  return DEFAULT_SOUND_BY_EFFECT[effect] ?? DEFAULT_SOUND_BY_EFFECT[DEFAULTS.effect];
}

export const DEFAULTS = Object.freeze({
  imageDataUrl: null, // null = 기본 말풍선 글씨
  soundDataUrl: null, // null = 기본 음원(/assets/ssyagal.m4a)
  gapMs: -200, // 순차 반복 간격(ms). 음수면 이전 클립이 끝나기 전에 겹쳐 재생
  effect: "fire", // 불타는 효과 테마
});

const KEY = "ssagal.settings";

export function createSettings(options = {}) {
  const storage = options.storage ?? globalThis.localStorage ?? null;
  const key = options.key ?? KEY;

  function load() {
    try {
      const raw = storage?.getItem(key);
      if (!raw) return { ...DEFAULTS };
      return sanitize(JSON.parse(raw));
    } catch {
      return { ...DEFAULTS };
    }
  }

  // 부분 갱신(patch)을 기존 설정에 병합해 저장하고, 최종 설정을 돌려준다.
  function save(patch) {
    const next = sanitize({ ...load(), ...patch });
    try {
      storage?.setItem(key, JSON.stringify(next));
    } catch {
      /* 저장 실패(용량 초과·비활성 등)는 무시한다 */
    }
    return next;
  }

  function reset() {
    try {
      storage?.removeItem(key);
    } catch {
      /* 무시 */
    }
    return { ...DEFAULTS };
  }

  return { load, save, reset };
}

// 알 수 없거나 잘못된 값은 기본값으로 보정한다.
export function sanitize(input) {
  const s = { ...DEFAULTS, ...(input ?? {}) };
  if (typeof s.imageDataUrl !== "string") s.imageDataUrl = DEFAULTS.imageDataUrl;
  if (typeof s.soundDataUrl !== "string") s.soundDataUrl = DEFAULTS.soundDataUrl;
  const gap = Number(s.gapMs);
  s.gapMs = Number.isFinite(gap) ? gap : DEFAULTS.gapMs;
  if (!EFFECTS.includes(s.effect)) s.effect = DEFAULTS.effect;
  return s;
}
