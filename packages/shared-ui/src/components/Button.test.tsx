import { describe, expect, it } from "vitest";

import { buttonVariants } from "./Button";

describe("Button variants", () => {
  it("기본값은 primary + md", () => {
    const cls = buttonVariants({});
    expect(cls).toMatch(/bg-\[#6366F1\]/);
    expect(cls).toMatch(/h-9/);
  });

  it("variant=danger 적용", () => {
    expect(buttonVariants({ variant: "danger" })).toMatch(/text-\[#EF4444\]/);
  });

  it("size=xs 적용", () => {
    expect(buttonVariants({ size: "xs" })).toMatch(/h-7/);
  });
});
