import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
  {
    variants: {
      tone: {
        neutral: "bg-[#FAFAFA] text-[#6B6B6B] border border-[#E8E8EC]",
        primary: "bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20",
        success: "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20",
        warning: "bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20",
        danger: "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
