/**
 * Full-page loading indicator.
 * Renders an animated pulsing hexagon + optional label.
 */
export function Loading({
  label = "Loading…",
  sublabel,
  fullPage = false,
}: {
  label?: string;
  sublabel?: string;
  fullPage?: boolean;
}) {
  return (
    <div
      className={fullPage ? "min-h-[60vh] flex items-center justify-center" : "py-16 flex items-center justify-center"}
    >
      <div className="flex flex-col items-center">
        <HexPulse />
        <div className="mt-6 font-mono text-xs tracking-wider text-[var(--color-text-low)] uppercase">
          {label}
        </div>
        {sublabel && (
          <div className="mt-2 text-xs text-[var(--color-text-low)] font-mono">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

function HexPulse() {
  return (
    <div className="relative w-12 h-12">
      {/* Outer pulsing ring */}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          border: "1px solid var(--color-neon)",
          opacity: 0.35,
          animation: "hex-pulse 1.8s ease-in-out infinite",
        }}
      />
      {/* Inner glowing hexagon */}
      <span
        className="absolute inset-2 flex items-center justify-center text-[var(--color-neon)]"
        style={{
          fontSize: "20px",
          animation: "hex-spin 3s linear infinite",
          filter: "drop-shadow(0 0 6px var(--color-neon-glow))",
        }}
      >
        ⬡
      </span>
      <style>{`
        @keyframes hex-pulse {
          0%, 100% { transform: scale(0.9); opacity: 0.2; }
          50% { transform: scale(1.15); opacity: 0.5; }
        }
        @keyframes hex-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Skeleton block for stat cards, list rows, etc.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`shimmer rounded ${className}`}
      style={{
        width,
        height,
        borderRadius: "var(--radius-sm)",
      }}
    />
  );
}

/**
 * Skeleton for a stat card.
 */
export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <Skeleton width="30%" height={10} className="mb-3" />
      <Skeleton width="50%" height={28} className="mb-2" />
      <Skeleton width="70%" height={12} />
    </div>
  );
}

/**
 * Skeleton for a list row.
 */
export function ListRowSkeleton() {
  return (
    <div className="panel mb-2">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton width="40%" height={14} className="mb-2" />
          <Skeleton width="60%" height={10} />
        </div>
        <Skeleton width={60} height={20} />
      </div>
    </div>
  );
}