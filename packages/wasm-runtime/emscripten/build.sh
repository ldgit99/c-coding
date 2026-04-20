#!/usr/bin/env bash
# clang.wasm 빌드 구동 스크립트.
#
# 사용법:
#   1. Docker 필요: docker --version
#   2. 빌드 (초기 수 시간 소요, 캐시 후 수십 분):
#        ./build.sh
#   3. 결과물 추출:
#        ./extract.sh
#   4. 학생 앱에 배포:
#        cp -r artifacts/ ../../../apps/student/public/wasm/clang/
#
# 주의:
#   - Apple Silicon: --platform=linux/amd64 플래그 필요할 수 있음.
#   - 15GB 이상 디스크 여유 필요.

set -euo pipefail

IMAGE_TAG="cvibe-clang-wasm:latest"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[cvibe] Emscripten/clang WASM 빌드 이미지 생성 — 첫 실행은 수 시간 걸릴 수 있다."
docker build -t "$IMAGE_TAG" "$HERE"

echo "[cvibe] 빌드 완료. 결과물 추출은 extract.sh 사용."
