// ESLint v9 flat config — pilot-minimum.
//
// 현재 목표는 CI lint 통과 + 빌드·타입체크·테스트로 품질을 보장하는 것.
// 정식 ESLint 규칙은 파일럿 이후 typescript-eslint · @eslint/js · Next 플러그인을
// 추가하며 단계적으로 켠다. 지금은 파일 스캔 범위만 잡아두고 규칙 0개.

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/promptfoo-results/**",
      "**/.vercel/**",
      // TypeScript 소스는 tsc --noEmit (typecheck 태스크)가 검증한다.
      // ESLint 에 @typescript-eslint/parser 없이 TS 를 파싱시키면 "Unexpected
      // token" 이 쏟아지므로 lint 범위에서 제외. 규칙 정식화 시 parser 도입.
      "**/*.ts",
      "**/*.tsx",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    rules: {},
  },
];
