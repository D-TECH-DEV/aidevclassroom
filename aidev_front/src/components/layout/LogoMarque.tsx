type ThemeLogo = "dark" | "light" | "auto";

export function LogoMarque({
  theme = "dark",
  compact = false,
  className = "h-7 w-auto",
}: {
  theme?: ThemeLogo;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <img
        src="/logo/aidevclassroom-icon.svg"
        alt="AIDevClassroom"
        className={className}
      />
    );
  }

  if (theme === "auto") {
    return (
      <picture>
        <source
          srcSet="/logo/aidevclassroom-logo-light.svg"
          media="(prefers-color-scheme: light)"
        />
        <img
          src="/logo/aidevclassroom-logo-dark.svg"
          alt="AIDevClassroom"
          className={className}
        />
      </picture>
    );
  }

  const src =
    theme === "light"
      ? "/logo/aidevclassroom-logo-light.svg"
      : "/logo/aidevclassroom-logo-dark.svg";

  return <img src={src} alt="AIDevClassroom" className={className} />;
}
