/**
 * Thin wrapper that adds a subtle fade-in animation to any page content.
 * Purely presentational — no logic, no state.
 *
 * Usage:
 *   <PageFade><div>...</div></PageFade>
 */
export function PageFade({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}