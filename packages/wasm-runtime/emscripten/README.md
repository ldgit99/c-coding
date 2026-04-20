# clang.wasm 빌드 파이프라인

research.md §7.3의 **주 경로** — Emscripten으로 clang + lld를 WebAssembly로 빌드해 학생 브라우저에서 직접 C 코드를 컴파일·실행한다.

## 왜 별도 디렉토리인가

- 빌드 환경이 Node/TS 워크스페이스와 격리돼야 한다 (Docker, CMake, ninja).
- 산출물 크기가 80~100MB → 저장소에 커밋하지 않고 CI가 GitHub Releases/Vercel Blob에 업로드하고, 런타임은 URL로 fetch한다.
- 빌드는 초기 수 시간 소요 → 개발 루프에 매번 돌 필요 없음.

## 요구 사항

| 항목 | 최소 |
|------|------|
| Docker | 24+ (BuildKit 활성화) |
| 디스크 | 15GB 여유 |
| RAM | 8GB (이상 권장 16GB) |
| CPU | 8코어 이상 권장 |

Apple Silicon에서는 Dockerfile `FROM` 라인 바로 아래에 `--platform=linux/amd64`를 명시하거나 `docker buildx build --platform=linux/amd64`로 실행한다.

## 사용법

```bash
cd packages/wasm-runtime/emscripten
./build.sh     # Dockerfile 이미지 빌드 (초기 수 시간)
./extract.sh   # artifacts/ 로 clang.wasm, lld.wasm 복사
cp -r artifacts/* ../../../apps/student/public/wasm/clang/
```

## CI 연동 (TODO)

`.github/workflows/clang-wasm.yml`을 추가해 다음 트리거로 실행:
- 수동 (`workflow_dispatch`)
- Emscripten SDK 버전 bump PR
- 분기별 재빌드

빌드 후 `gh release upload` 또는 Vercel Blob API로 업로드, 그 URL을 `NEXT_PUBLIC_CLANG_WASM_URL` 환경변수로 학생 앱에 주입.

## 런타임 통합

`packages/wasm-runtime/src/clang-wasm.ts`의 `ClangWasmBackend`가 이 번들을 로드한다. Web Worker 스크립트 `apps/student/public/workers/clang.worker.js`에서:

1. `WebAssembly.instantiateStreaming(fetch(wasmUrl))`
2. 학생 코드를 `/tmp/main.c`에 가상 FS에 쓰기
3. `clang -cc1 -emit-obj main.c -o main.o`
4. `lld --entry=main main.o -o main.wasm`
5. 컴파일된 WASM을 재귀적으로 실행
6. stdout/stderr 캡처 후 메인 스레드에 postMessage

## 현재 상태

- Dockerfile·빌드 스크립트 스켈레톤만 준비됨
- 실제 빌드는 사용자 환경(Docker + 디스크 여유)에서 수동 실행 필요
- 빌드가 성공할 때까지 학생 앱은 **Judge0 API**로 폴백 실행 (`apps/student/app/api/run/route.ts`)

빌드 완료 후 학생 앱 API 라우트에서 `preferredBackend: "clang-wasm"`로 전환하면 된다.
