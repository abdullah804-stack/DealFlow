import React from "react";
import { StyleSheet, Text, View, Page, Font } from "@react-pdf/renderer";

/**
 * Shared styling and components for report PDFs.
 *
 * Uses only the built-in Helvetica family to avoid fetching Google fonts
 * at render time (which breaks in Vercel serverless). The visual identity
 * stays close to the web app's teal/coral palette via accent colors.
 */

// ─── Colors (mirror of app/globals.css) ────────────────────────────

export const COLORS = {
  bg: "#090b10",
  panel: "#12151d",
  border: "#232733",
  textHi: "#eef1f6",
  textMid: "#9aa3b5",
  textLow: "#5c6577",
  teal: "#3fe0c2",
  coral: "#f1667c",
  amber: "#f0ad5c",
  blue: "#5b9cf6",
  violet: "#9b8cf9",
  white: "#ffffff",
  black: "#000000",
};

// ─── Stylesheet ────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  page: {
    padding: 48,
    backgroundColor: COLORS.white,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    lineHeight: 1.5,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.teal,
  },
  brand: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.teal,
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 7,
    color: COLORS.textLow,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0a0a0a",
    marginBottom: 4,
  },
  meta: {
    fontSize: 8,
    color: "#666",
    marginTop: 4,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  badgeInvest: {
    backgroundColor: "#d1f5ed",
    color: "#0d7d68",
  },
  badgePass: {
    backgroundColor: "#fde2e6",
    color: "#b13a4d",
  },
  badgeNeutral: {
    backgroundColor: "#e8ebf0",
    color: "#4a5364",
  },

  // Stat grid
  statGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e5eb",
    borderRadius: 6,
    backgroundColor: "#fafbfc",
  },
  statLabel: {
    fontSize: 7,
    color: "#888",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#0a0a0a",
  },
  statSub: {
    fontSize: 7,
    color: "#888",
    marginTop: 4,
  },

  // Headline boxes (advantage/risk)
  highlightRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  highlightBox: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  highlightAdvantage: {
    backgroundColor: "#effaf7",
    borderColor: "#a7e4d6",
  },
  highlightRisk: {
    backgroundColor: "#fef1f3",
    borderColor: "#f5b8c4",
  },
  highlightLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  highlightBody: {
    fontSize: 9,
    lineHeight: 1.5,
    color: "#1a1a1a",
  },

  // Section
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0a0a0a",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e5eb",
  },
  sectionBody: {
    fontSize: 10,
    lineHeight: 1.55,
    color: "#2a2a2a",
  },

  // Committee
  committeeBox: {
    padding: 14,
    backgroundColor: "#f7f8fa",
    borderRadius: 6,
    marginBottom: 18,
  },
  committeeLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  committeeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 9,
  },

  // Source info
  sourceBox: {
    padding: 10,
    backgroundColor: "#f7f8fa",
    borderRadius: 4,
    marginBottom: 16,
  },
  sourceLabel: {
    fontSize: 8,
    color: "#888",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sourceValue: {
    fontSize: 9,
    color: "#2a2a2a",
    marginBottom: 2,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 48,
    right: 48,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e5eb",
    fontSize: 7,
    color: "#888",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerPage: {
    textAlign: "right",
  },

  // Disclaimer
  disclaimer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e5eb",
    fontSize: 8,
    color: "#888",
    fontStyle: "italic",
    lineHeight: 1.4,
  },
});

// ─── Components ────────────────────────────────────────────────────

export function ReportHeader({
  title,
  decision,
  meta,
}: {
  title: string;
  decision?: string;
  meta?: string;
}) {
  const badgeStyle =
    decision === "INVEST"
      ? styles.badgeInvest
      : decision === "PASS"
      ? styles.badgePass
      : styles.badgeNeutral;

  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>DEALFLOW</Text>
        <Text style={styles.brandSub}>DEAL INTELLIGENCE</Text>
      </View>
      <View style={{ flex: 3 }}>
        <Text style={styles.title}>{title}</Text>
        {meta && <Text style={styles.meta}>{meta}</Text>}
      </View>
      {decision && (
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[styles.badge, badgeStyle]}>{decision}</Text>
        </View>
      )}
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
        <Text style={styles.statSub}>{"★".repeat(stars) + "☆".repeat(5 - stars)}</Text>
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

  if (typeof weightedScore === "number") {
    cells.push(
      <View style={styles.statCard} key="score">
        <Text style={styles.statLabel}>Score</Text>
        <Text style={styles.statValue}>{weightedScore.toFixed(2)}</Text>
        <Text style={styles.statSub}>/10 weighted</Text>
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
          <Text style={[styles.highlightLabel, { color: "#0d7d68" }]}>
            Biggest advantage
          </Text>
          <Text style={styles.highlightBody}>{advantage}</Text>
        </View>
      )}
      {risk && (
        <View style={[styles.highlightBox, styles.highlightRisk]}>
          <Text style={[styles.highlightLabel, { color: "#b13a4d" }]}>
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

export function Disclaimer({ text }: { text?: string }) {
  if (!text) return null;
  return <Text style={styles.disclaimer}>{text}</Text>;
}

export function ReportFooter({
  generatedAt,
}: {
  generatedAt: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text>DealFlow — autonomous VC analyst</Text>
      <Text style={styles.footerPage} render={({ pageNumber, totalPages }) =>
        `Generated ${generatedAt.slice(0, 10)} · Page ${pageNumber} of ${totalPages}`
      } />
    </View>
  );
}