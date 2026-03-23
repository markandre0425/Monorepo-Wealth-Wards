import React from "react";

export type ButtonVariant = "primary" | "secondary" | "gradient-primary" | "gradient-accent" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "text-white hover:opacity-90 transition-opacity",
  secondary: "bg-[#2b2b2b] text-white hover:bg-[#363636] transition-colors",
  "gradient-primary": "text-white hover:opacity-90 transition-opacity",
  "gradient-accent": "text-white hover:opacity-90 transition-opacity",
  outline: "border border-white/20 text-white hover:border-white/40 transition-colors",
};

const getGradientStyle = () => ({
  backgroundImage: "linear-gradient(129.101deg, rgb(31, 142, 190) 5.3557%, rgb(68, 4, 149) 29.462%, rgb(68, 4, 149) 56.025%, rgb(177, 2, 205) 81.92%)",
});

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-[12px] py-[6px] text-[12px] rounded-[8px]",
  md: "px-[16px] py-[8px] text-[14px] rounded-[12px]",
  lg: "px-[32px] py-[12px] text-[16px] rounded-[12px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      className = "",
      loading = false,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const isGradient = ["primary", "gradient-primary", "gradient-accent"].includes(variant);
    const buttonStyle = isGradient ? { ...getGradientStyle(), ...style } : style;

    // Remove any conflicting size/padding classes from custom className
    const cleanedClassName = className
      .split(" ")
      .filter(cls => !cls.match(/^(px-|py-|text-|rounded-|w-|h-)/))
      .join(" ");

    return (
      <button
        ref={ref}
        disabled={loading || props.disabled}
        className={`font-['Inter',sans-serif] font-medium cursor-pointer flex items-center justify-center ${variantStyles[variant]} ${sizeStyles[size]} ${cleanedClassName} ${loading ? 'opacity-70 cursor-wait' : ''}`}
        style={buttonStyle}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {loading ? (size === "sm" ? "..." : "Processing...") : children}
      </button>
    );
  }
);

Button.displayName = "Button";

// Pre-styled buttons for global use cases
export const PrimaryButton = (props: Omit<ButtonProps, "variant">) => (
  <Button {...props} variant="primary" />
);

export const SecondaryButton = (props: Omit<ButtonProps, "variant">) => (
  <Button {...props} variant="secondary" />
);

export const GradientButton = (props: Omit<ButtonProps, "variant">) => (
  <Button {...props} variant="gradient-primary" />
);

export const AccentGradientButton = (props: Omit<ButtonProps, "variant">) => (
  <Button {...props} variant="gradient-accent" />
);

export const OutlineButton = (props: Omit<ButtonProps, "variant">) => (
  <Button {...props} variant="outline" />
);
