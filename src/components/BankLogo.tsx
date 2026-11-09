import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import logoImg from "@/assets/logo.png";
import { getInstitutionName, INSTITUTION_CONFIG } from "@/config/institution";

export interface BankLogoProps {
  to?: string;
  onClick?: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  theme?: "light" | "dark" | "auto";
  asLink?: boolean;
  variant?: "full" | "icon";
  height?: number;
  tone?: "brand" | "white" | "dark";
}

export function BankLogo({
  to = "/",
  onClick,
  size = "md",
  className = "",
  theme = "light",
  asLink = true,
  variant = "full",
  height,
  tone,
}: BankLogoProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sizeMap = {
    sm: { img: "w-8 h-8", text: "text-xl", box: "h-8 min-w-[100px]" },
    md: { img: "w-10 h-10", text: "text-2xl", box: "h-10 min-w-[120px]" },
    lg: { img: "w-12 h-12", text: "text-3xl", box: "h-12 min-w-[150px]" },
    xl: { img: "w-16 h-16", text: "text-4xl", box: "h-16 min-w-[200px]" },
  }[size] || { img: "w-10 h-10", text: "text-2xl", box: "h-10 min-w-[120px]" };

  // Brand styling: Dark navy text on light backgrounds (#00395d), crisp white on dark backgrounds, or brand cyan-blue.
  let textColor = theme === "dark" ? "text-white" : "text-[#00395d]";
  if (tone === "brand") {
    textColor = "text-[#029efb]";
  } else if (tone === "white") {
    textColor = "text-white";
  } else if (tone === "dark") {
    textColor = "text-[#00395d]";
  }
  const brandName = getInstitutionName();

  if (!mounted) {
    return (
      <span
        className={`bancoteste-brand-logo inline-flex items-center select-none bg-transparent ${sizeMap.box} ${className}`}
        aria-hidden="true"
      />
    );
  }

  const innerContent = (
    <span className="inline-flex items-center gap-3 select-none bg-transparent">
      {INSTITUTION_CONFIG.showOriginalEmblem && (
        <img
          src={logoImg}
          alt={brandName}
          className={`${height ? "" : sizeMap.img} object-contain shrink-0 bg-transparent select-none pointer-events-none drop-shadow-sm`}
          style={height ? { height: `${height}px`, width: "auto" } : undefined}
          draggable={false}
        />
      )}
      {variant !== "icon" && (
        <span
          className={`${sizeMap.text} font-semibold tracking-tight ${textColor} select-none leading-none bg-transparent`}
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            backgroundColor: "transparent",
            background: "none",
            ...(tone === "brand" ? { color: "#029efb" } : {}),
            ...(height ? { fontSize: `${Math.round(height * 0.72)}px` } : {}),
          }}
        >
          {brandName}
        </span>
      )}
    </span>
  );

  const containerClasses = `bancoteste-brand-logo inline-flex items-center select-none bg-transparent border-0 p-0 m-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 transition hover:opacity-90 ${className}`;

  if (!asLink) {
    return (
      <div className={containerClasses} data-bancoteste-logo="true">
        {innerContent}
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${containerClasses} cursor-pointer`}
        data-bancoteste-logo="true"
        style={{
          backgroundColor: "transparent",
          background: "none",
          outline: "none",
          boxShadow: "none",
        }}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className={`${containerClasses} cursor-pointer`}
      data-bancoteste-logo="true"
      style={{
        backgroundColor: "transparent",
        background: "none",
        outline: "none",
        boxShadow: "none",
      }}
    >
      {innerContent}
    </Link>
  );
}

// Backward and alias compatibility
export { BankLogo as BancoTesteLogo, BankLogo as VelunorLogo };
export type { BankLogoProps as BancoTesteLogoProps, BankLogoProps as VelunorLogoProps };
export default BankLogo;
