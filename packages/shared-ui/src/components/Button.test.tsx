import { describe, expect, it } from "vitest";

import { buttonVariants } from "./Button";

describe("Button variants", () => {
  it("기본값은 primary + md", () => {
    const cls = buttonVariants({});
    expect(cls).toMatch(/bg-slate-900/);
    expect(cls).toMatch(/h-9/);
  });

  it("variant=danger 적용", () => {
    expect(buttonVariants({ variant: "danger" })).toMatch(/bg-rose-600/);
  });

  it("size=xs 적용", () => {
    expect(buttonVariants({ size: "xs" })).toMatch(/h-6/);
  });
});
