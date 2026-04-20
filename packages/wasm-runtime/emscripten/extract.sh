#!/usr/bin/env bash
# 빌드된 clang.wasm, lld.wasm 바이너리를 로컬 artifacts/ 로 복사.
set -euo pipefail

IMAGE_TAG="cvibe-clang-wasm:latest"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/artifacts"

mkdir -p "$OUT"

echo "[cvibe] 컨테이너에서 산출물 복사"
CID=$(docker create "$IMAGE_TAG")
trap 'docker rm -f "$CID" >/dev/null' EXIT

docker cp "$CID":/build/llvm-project/build/bin/clang "$OUT/clang.wasm"
docker cp "$CID":/build/llvm-project/build/bin/lld "$OUT/lld.wasm"

echo "[cvibe] 산출물:"
ls -lh "$OUT"
echo "[cvibe] 다음 단계: 학생 앱 public/wasm/clang/ 으로 복사 후 clang-wasm.ts 워커에서 fetch."
