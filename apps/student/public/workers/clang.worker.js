// clang.wasm Web Worker — Week 3 후반에 실제 번들 로딩 로직 채움.
//
// 동작 흐름 (예정):
//   1. onmessage(ev): 메인 스레드에서 { id, code, stdin, timeoutMs, memLimitMb } 수신
//   2. WebAssembly.instantiateStreaming(fetch(SELF.origin + '/wasm/clang/clang.wasm'))
//   3. 가상 FS에 student code 마운트
//   4. clang -cc1 -emit-obj → lld → wasm 실행
//   5. postMessage({ id, result })
//
// 현재는 "clang.wasm 번들이 아직 배포되지 않았다"는 에러만 반환하는 placeholder.

self.addEventListener("message", (ev) => {
  const { id } = ev.data ?? {};
  self.postMessage({
    id,
    result: {
      executed: false,
      exitCode: null,
      stdout: "",
      stderr:
        "clang.wasm 번들이 아직 빌드/배포되지 않았다 — packages/wasm-runtime/emscripten/README.md 참조.",
      durationMs: 0,
      errorType: "environment",
    },
  });
});
