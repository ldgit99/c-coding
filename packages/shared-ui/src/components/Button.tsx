import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-all disabled:pointer-events-none disabled:opacity-50 hover:-translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-[#6366F1] text-white hover:bg-[#4F46E5] hover:shadow-[0_4px_12px_rgba(99,102,241,0.35)]",
        secondary:
          "border border-[#E8E8EC] bg-white text-[#0A0A0A] hover:border-[#6366F1] hover:text-[#6366F1]",
        ghost: "text-[#0A0A0A] hover:bg-[#FAFAFA]",
        danger:
          "border border-[#EF4444]/40 bg-[#EF4444]/5 text-[#EF4444] hover:bg-[#EF4444]/10",
      },
      size: {
        xs: "h-7 px-2 text-[11px]",
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
