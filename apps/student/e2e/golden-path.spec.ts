import { expect, test } from "@playwright/test";

/**
 * Golden path — research.md §8.2 PR 체크 필수 시나리오.
 *
 * 학생이 과제를 열고 → 코드 수정 → 힌트 Level 1 요청 → 응답 수신.
 * ANTHROPIC_API_KEY 미설정 시 AIPanel이 mock 응답을 돌려주므로
 * CI 비밀키 없이도 통과 가능.
 */

test("학생이 과제를 선택하고 Level 1 힌트를 받는다", async ({ page }) => {
  await page.goto("/");

  // 상단 타이틀 확인
  await expect(page.getByText("CVibe — C 짝프로그래밍")).toBeVisible();

  // 과제 드롭다운이 렌더된다 (첫 과제 자동 선택)
  await expect(page.getByRole("combobox")).toBeVisible();

  // AI 패널의 힌트 탭으로 전환
  await page.getByRole("button", { name: "힌트" }).click();

  // 계단식 힌트 버튼이 4개 있고 L1을 누를 수 있다
  await expect(page.getByRole("button", { name: "L1" })).toBeVisible();
  // 힌트 탭 제거 후 — 채팅 입력으로 힌트 요청 (Supervisor가 hint_request로 분류)
  await page.getByPlaceholder(/질문 또는 힌트 요청/).fill("힌트 줘");
  await page.getByRole("button", { name: "보내기" }).click();

  // 응답이 도착할 때까지 대기 (mock 또는 실제 Claude 응답)
  await expect(page.getByText(/AI 튜터/)).toBeVisible({ timeout: 30_000 });
});

test("제출 버튼은 충분한 코드가 있어야 활성화된다", async ({ page }) => {
  await page.goto("/");

  // 첫 로드 시 starter_code는 TODO 주석 포함 20자 넘는 코드가 자동 주입됨
  const submitBtn = page.getByRole("button", { name: "제출" });
  await expect(submitBtn).toBeEnabled();
});
