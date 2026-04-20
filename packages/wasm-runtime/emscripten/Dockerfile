# CVibe — clang.wasm 빌드 환경
# Emscripten SDK (emsdk)로 clang + lld를 WebAssembly로 컴파일한다.
#
# research.md §7.3: "Emscripten으로 clang·lld를 WASM으로 빌드 → Web Worker에서 실행"
#
# 빌드 결과물(대략 80~100MB)은 apps/student/public/wasm/clang/ 에 배포되며,
# packages/wasm-runtime/src/clang-wasm.ts의 Worker가 이 번들을 fetch 한다.
#
# 주의: emsdk 첫 설치에 수 GB 디스크, 수 시간 빌드 시간이 소요된다.
# CI에서는 별도 잡으로 분리하고, 빌드 결과물을 GitHub Releases 또는
# Vercel Blob Storage에 보관한 뒤 런타임에 fetch하는 것을 권장.

FROM emscripten/emsdk:3.1.73

WORKDIR /build

# LLVM 소스 체크아웃 — 버전은 emsdk와 일치해야 한다.
ARG LLVM_VERSION=19.1.4
RUN git clone --depth=1 --branch llvmorg-${LLVM_VERSION} \
    https://github.com/llvm/llvm-project.git

WORKDIR /build/llvm-project

# Emscripten 툴체인으로 clang + lld를 WASM으로 빌드.
# -DLLVM_TARGETS_TO_BUILD=WebAssembly — WASM만 타겟 (크기 최소화)
# -DLLVM_ENABLE_PROJECTS="clang;lld" — 컴파일러 + 링커
# -DCMAKE_BUILD_TYPE=MinSizeRel — 크기 최적화 (학생 브라우저 로딩 시간)
RUN emcmake cmake -S llvm -B build \
    -DCMAKE_BUILD_TYPE=MinSizeRel \
    -DLLVM_ENABLE_PROJECTS="clang;lld" \
    -DLLVM_TARGETS_TO_BUILD=WebAssembly \
    -DLLVM_ENABLE_ASSERTIONS=OFF \
    -DLLVM_ENABLE_TERMINFO=OFF \
    -DLLVM_BUILD_TOOLS=ON \
    -DLLVM_INCLUDE_TESTS=OFF \
    -DLLVM_INCLUDE_BENCHMARKS=OFF \
    -DCLANG_ENABLE_STATIC_ANALYZER=OFF \
    -DCLANG_ENABLE_ARCMT=OFF

RUN emmake cmake --build build --target clang -j "$(nproc)"
RUN emmake cmake --build build --target lld -j "$(nproc)"

# 결과물:
#   /build/llvm-project/build/bin/clang   (WASM)
#   /build/llvm-project/build/bin/lld     (WASM)
# 이후 wasm-strip / wasm-opt 로 크기 축소하는 단계 추가 권장.

CMD ["bash"]
