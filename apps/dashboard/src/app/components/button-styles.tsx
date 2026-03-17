import React from "react";

export type ButtonVariant = "primary" | "secondary" | "gradient-primary" | "gradient-accent" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
        className={`font-['Inter',sans-serif] font-medium cursor-pointer flex items-center justify-center ${variantStyles[variant]} ${sizeStyles[size]} ${cleanedClassName}`}
        style={buttonStyle}
        {...props}
      >
        {children}
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
