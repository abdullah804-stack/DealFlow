import React from "react";
import { StyleSheet, Text, View, Image } from "@react-pdf/renderer";

/**
 * PDF primitives — matching the web theme's neon green + near-black
 * accent palette, but rendered as a light document (white background,
 * dark text) for printability.
 *
 * Uses @react-pdf/renderer's built-in Helvetica family. Do not import
 * CSS variables or Tailwind — this module runs outside the browser.
 */

// ─── Accent colors (hardcoded hex — mirrors app/globals.css) ──────

export const PDF_COLORS = {
  neon: "#39ff14",
  neonDim: "#c8f5b8",
  red: "#ff2d55",
  redDim: "#ffd6dd",
  amber: "#d68a26",
  textHi: "#0a0a0a",
  textMid: "#40444d",
  textLow: "#7a7f8a",
  border: "#e2e5eb",
  surface: "#f7f8fa",
  white: "#ffffff",
};

// ─── Typography scale (spacious, not congested) ───────────────────

export const PDF_TYPE = {
  h1: 26,
  h2: 15,
  h3: 11,
  body: 10.5,
  meta: 9,
  small: 8,
  lineHeight: 1.6,
};

// ─── Stylesheet ────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 60,
    paddingHorizontal: 56,
    backgroundColor: PDF_COLORS.white,
    fontFamily: "Helvetica",
    fontSize: PDF_TYPE.body,
    color: PDF_COLORS.textMid,
    lineHeight: PDF_TYPE.lineHeight,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.neon,
    gap: 14,
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandBlock: {
    flexDirection: "column",
    justifyContent: "center",
  },
  brand: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.textHi,
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: PDF_TYPE.small,
    color: PDF_COLORS.textLow,
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  badgeWrap: {
    marginLeft: "auto",
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    fontSize: PDF_TYPE.small,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  badgeInvest: {
    backgroundColor: PDF_COLORS.neonDim,
    color: "#1a5c00",
  },
  badgePass: {
    backgroundColor: PDF_COLORS.redDim,
    color: "#8c0d24",
  },
  badgeNeutral: {
    backgroundColor: "#e6e9ee",
    color: "#3a3f4a",
  },

  // Title
  title: {
    fontSize: PDF_TYPE.h1,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.textHi,
    marginBottom: 6,
    lineHeight: 1.15,
  },
  meta: {
    fontSize: PDF_TYPE.meta,
    color: PDF_COLORS.textLow,
    marginBottom: 24,
  },

  // Stat grid
  statGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 8,
    backgroundColor: PDF_COLORS.surface,
  },
  statLabel: {
    fontSize: PDF_TYPE.small,
    color: PDF_COLORS.textLow,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.textHi,
    lineHeight: 1.1,
  },
  statSub: {
    fontSize: PDF_TYPE.small,
    color: PDF_COLORS.textLow,
    marginTop: 6,
  },

  // Highlights (advantage / risk)
  highlightRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  highlightBox: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  highlightAdvantage: {
    backgroundColor: "#f3fef0",
    borderColor: "#b8e9a5",
  },
  highlightRisk: {
    backgroundColor: "#fff1f4",
    borderColor: "#f5b8c4",
  },
  highlightLabel: {
    fontSize: PDF_TYPE.small,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  highlightBody: {
    fontSize: PDF_TYPE.body,
    lineHeight: 1.55,
    color: PDF_COLORS.textHi,
  },

  // Sections
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: PDF_TYPE.h2,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.textHi,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  sectionBody: {
    fontSize: PDF_TYPE.body,
    lineHeight: 1.65,
    color: PDF_COLORS.textMid,
  },

  // Committee block
  committeeBox: {
    padding: 16,
    backgroundColor: PDF_COLORS.surface,
    borderRadius: 8,
    marginBottom: 22,
  },
  committeeLabel: {
    fontSize: PDF_TYPE.small,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    color: PDF_COLORS.textLow,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  committeeRow: {
    fontSize: PDF_TYPE.body,
    color: PDF_COLORS.textMid,
    marginBottom: 6,
    lineHeight: 1.5,
  },

  // Source info
  sourceBox: {
    padding: 14,
    backgroundColor: PDF_COLORS.surface,
    borderRadius: 6,
    marginBottom: 22,
  },
  sourceLabel: {
    fontSize: PDF_TYPE.small,
    color: PDF_COLORS.textLow,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sourceValue: {
    fontSize: PDF_TYPE.body,
    color: PDF_COLORS.textHi,
    marginBottom: 4,
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 56,
    right: 56,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    fontSize: PDF_TYPE.small,
    color: PDF_COLORS.textLow,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  // Disclaimer
  disclaimer: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    fontSize: PDF_TYPE.small,
    color: PDF_COLORS.textLow,
    fontStyle: "italic",
    lineHeight: 1.5,
  },
});

// ─── Components ────────────────────────────────────────────────────

const DECISION_LABELS: Record<string, string> = {
  INVEST: "INVEST",
  PASS: "PASS",
  INSUFFICIENT_EVIDENCE: "PARTIAL",
};

export function ReportHeader({
  logoDataUrl,
  decision,
}: {
  logoDataUrl: string;
  decision?: string;
}) {
  const badgeStyle =
    decision === "INVEST"
      ? styles.badgeInvest
      : decision === "PASS"
      ? styles.badgePass
      : styles.badgeNeutral;

  return (
    <View style={styles.headerRow}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={logoDataUrl} style={styles.logo} />
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>DealFlow</Text>
        <Text style={styles.brandSub}>Deal Intelligence</Text>
      </View>
      {decision && (
        <View style={styles.badgeWrap}>
          <Text style={[styles.badge, badgeStyle]}>
            {DECISION_LABELS[decision] ?? decision}
          </Text>
        </View>
      )}
    </View>
  );
}

export function TitleBlock({
  title,
  meta,
}: {
  title: string;
  meta: string;
}) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>{meta}</Text>
    </View>
  );
}

export function StatGrid({
  stars,
  probability,
  checkSize,
  stage,
  weightedScore,
}: {
  stars?: number;
  probability?: number;
  checkSize?: string;
  stage?: string;
  weightedScore?: number;
}) {
  const cells: React.ReactElement[] = [];

  if (typeof stars === "number") {
    cells.push(
      <View style={styles.statCard} key="stars">
        <Text style={styles.statLabel}>Rating</Text>
        <Text style={styles.statValue}>{stars}/5</Text>
        <Text style={styles.statSub}>
          {"★".repeat(stars) + "☆".repeat(5 - stars)}
        </Text>
      </View>
    );
  }

  if (typeof probability === "number") {
    cells.push(
      <View style={styles.statCard} key="prob">
        <Text style={styles.statLabel}>Est. success</Text>
        <Text style={styles.statValue}>{probability}%</Text>
        <Text style={styles.statSub}>LLM estimate</Text>
      </View>
    );
  }

  if (checkSize) {
    cells.push(
      <View style={styles.statCard} key="check">
        <Text style={styles.statLabel}>Check size</Text>
        <Text style={styles.statValue}>{checkSize}</Text>
        <Text style={styles.statSub}>{stage ?? "Stage TBD"}</Text>
      </View>
    );
  }

  if (typeof weightedScore === "number" && cells.length < 3) {
    cells.push(
      <View style={styles.statCard} key="score">
        <Text style={styles.statLabel}>Weighted</Text>
        <Text style={styles.statValue}>{weightedScore.toFixed(2)}</Text>
        <Text style={styles.statSub}>/10</Text>
      </View>
    );
  }

  if (cells.length === 0) return null;

  return <View style={styles.statGrid}>{cells}</View>;
}

export function HighlightRow({
  advantage,
  risk,
}: {
  advantage?: string;
  risk?: string;
}) {
  if (!advantage && !risk) return null;
  return (
    <View style={styles.highlightRow}>
      {advantage && (
        <View style={[styles.highlightBox, styles.highlightAdvantage]}>
          <Text style={[styles.highlightLabel, { color: "#1a5c00" }]}>
            Biggest advantage
          </Text>
          <Text style={styles.highlightBody}>{advantage}</Text>
        </View>
      )}
      {risk && (
        <View style={[styles.highlightBox, styles.highlightRisk]}>
          <Text style={[styles.highlightLabel, { color: "#8c0d24" }]}>
            Biggest risk
          </Text>
          <Text style={styles.highlightBody}>{risk}</Text>
        </View>
      )}
    </View>
  );
}

export function Section({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  if (!body || !body.trim()) return null;
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

export function Disclaimer({ text }: { text?: string }) {
  if (!text) return null;
  return <Text style={styles.disclaimer}>{text}</Text>;
}

export function ReportFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>DealFlow — autonomous VC analyst</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Generated ${generatedAt.slice(0, 10)}  ·  Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}