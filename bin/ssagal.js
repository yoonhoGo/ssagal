#!/usr/bin/env node
// 동봉된 Ssagal 데스크톱 바이너리를 실행하는 런처.
// (macOS arm64 전용 — package.json os/cpu 로 설치 시 플랫폼 검증됨)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "dist-bin", "ssagal");

if (!existsSync(bin)) {
  console.error("[ssagal] 실행 바이너리를 찾을 수 없습니다:", bin);
  process.exit(1);
}

// 데스크톱 앱이므로 분리 실행 후 터미널은 즉시 반환.
const child = spawn(bin, process.argv.slice(2), {
  detached: true,
  stdio: "ignore",
});
child.unref();
