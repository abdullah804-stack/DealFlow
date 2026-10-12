/**
 * Inline spinner for buttons and small loading states.
 * Uses a thin ring animation matching the neon theme.
 */
export function Spinner({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: "currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        verticalAlign: "middle",
      }}
      aria-hidden
    />
  );
}