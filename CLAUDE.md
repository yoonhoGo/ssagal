# Project: Ssagal (쌰갈)

누르면 소리나는 플로팅 데스크톱 토이 앱. macOS arm64 전용.

## Tech Stack

- App: Tauri 2 (macos-private-api, tray-icon)
- Backend: Rust 2021 edition (`src-tauri/`)
- Frontend: Vanilla JS (ES modules), 번들러 없음 — `frontendDist`가 `src/`를 직접 가리킴
- Testing: Node.js 내장 test runner (`node --test`)
- 배포: npm 패키지 (bin 런처 + 동봉 바이너리), Node >= 18

## Project Structure

- `src/`: 프론트엔드 (HTML/CSS/JS, 빌드 단계 없음)
  - `main.js`: 엔트리, 모듈 조립
  - `player.js`: 오디오 재생 상태 머신 (Audio 팩토리 주입 가능)
  - `settings.js`: 설정 저장/로드
  - `shortcuts.js`: 키보드 단축키 바인딩
- `src-tauri/`: Rust 백엔드, 윈도우/트레이 설정 (`tauri.conf.json`)
- `bin/ssagal.js`: npm 전역 설치용 런처 (동봉 바이너리 spawn)
- `tests/`: 단위 테스트 (가짜 Audio 팩토리로 DOM 없이 테스트)
- `dist-bin/`: 빌드 산출물 (gitignore, npm 패키지에만 포함)

## Commands

- `npm test`: 단위 테스트 실행
- `npm run tauri dev`: 개발 모드 실행
- `npm run build:bin`: release 바이너리 빌드 → `dist-bin/`
- `cd src-tauri && cargo check`: Rust 컴파일 검증

## Code Style

- ES 모듈, 의존성 주입 패턴 (테스트 가능성: `player.js`의 Audio 팩토리 참조)
- 주석은 한국어로 작성
- 외부 런타임 의존성 추가 금지 — 프론트엔드는 순수 vanilla 유지

## Release

- 버전은 **3곳 동기화 필수**: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- `v*` 태그 푸시 → GitHub Actions가 테스트·빌드·npm publish·GitHub Release 자동 수행 (`.github/workflows/release.yml`)
- npm 인증은 access token — 저장소 시크릿 `NPM_TOKEN`(npmjs.com Automation 토큰) 필요
- 태그는 annotated: `git tag -a v0.3.0 -m "Release 0.3.0"`

## ⛔ Do Not

- `npm publish` 수동 실행 금지 — 태그 푸시로 자동화됨
- `dist-bin/` 직접 수정 금지 (빌드 산출물)
- 번들러/프레임워크 도입 금지 — 빌드 단계 없는 구조가 의도임
- macOS arm64 외 플랫폼 지원 코드 추가 금지 (package.json `os`/`cpu` 제약)
