"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#090b10",
          color: "#eef1f6",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "500px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", color: "#f1667c", marginBottom: "1rem" }}>
            ◌
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            DealFlow hit an unexpected error
          </h1>
          <p style={{ color: "#9aa3b5", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              background: "#3fe0c2",
              color: "#06110d",
              border: "none",
              borderRadius: "6px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}