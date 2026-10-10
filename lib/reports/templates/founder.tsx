import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  styles,
  ReportHeader,
  StatGrid,
  HighlightRow,
  Section,
  Disclaimer,
  ReportFooter,
} from "../primitives";
import {
  REPORT_SECTION_ORDER,
  type ReportJson,
  type ReportSectionKey,
} from "../schema";

/**
 * Founder report PDF — the user-submitted idea evaluation.
 * Same 10-section structure as discovery, but framed as feedback to the
 * founder rather than a memo to a partner.
 */

const SECTION_TITLES: Record<ReportSectionKey, string> = {
  executive_summary: "Executive Summary",
  startup_overview: "Your Idea",
  competitive_landscape: "Competitive Landscape",
  technology_analysis: "Technology",
  market_analysis: "Market Opportunity",
  financial_analysis: "Business Model",
  legal_analysis: "Legal & Compliance",
  founder_evaluation: "Your Team",
  debate_summary: "Committee Discussion",
  recommendation: "Recommendation",
};

export function FounderReportPdf({ report }: { report: ReportJson }) {
  return (
    <Document
      title={`${report.company} — Idea Evaluation`}
      author="DealFlow"
      subject="Investment committee evaluation of user-submitted idea"
      creator="DealFlow"
    >
      <Page size="A4" style={styles.page} wrap>
        <ReportHeader
          title={report.company}
          decision={report.decision}
          meta={[
            "Idea evaluation",
            report.generatedAt.slice(0, 10),
            report.weighted_score
              ? `Score: ${report.weighted_score.toFixed(2)}/10`
              : null,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        />

        <View style={styles.sourceBox}>
          <Text style={styles.sourceLabel}>Submission</Text>
          <Text style={styles.sourceValue}>
            Evaluated by a 5-specialist investment committee using the same
            rubric as discovered candidates.
          </Text>
        </View>

                <StatGrid
          stars={report.star_rating}
          probability={report.probability_of_success_pct}
          checkSize={report.recommended_check_size}
          stage={report.recommended_stage}
        />

        <HighlightRow
          advantage={report.biggest_advantage}
          risk={report.biggest_risk}
        />

        {REPORT_SECTION_ORDER.map((key) => {
          const body = report[key];
          if (typeof body !== "string" || !body.trim()) return null;
          return <Section key={key} title={SECTION_TITLES[key]} body={body} />;
        })}

        {report.committee?.disagreements &&
          report.committee.disagreements.length > 0 && (
            <View style={styles.committeeBox}>
              <Text style={styles.committeeLabel}>
                Where the Committee Disagreed
              </Text>
              {report.committee.disagreements.map((d, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 9,
                      fontFamily: "Helvetica-Bold",
                      marginBottom: 4,
                    }}
                  >
                    {d.topic}
                  </Text>
                  {d.positions.map((p, j) => (
                    <Text key={j} style={styles.committeeRow}>
                      <Text style={{ fontFamily: "Helvetica-Bold" }}>
                        {p.agentType}:{" "}
                      </Text>
                      {p.position}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}

        {report.unknowns && report.unknowns.length > 0 && (
          <View style={styles.committeeBox}>
            <Text style={styles.committeeLabel}>
              What the Committee Could Not Determine
            </Text>
            {report.unknowns.slice(0, 10).map((u, i) => (
              <Text key={i} style={styles.committeeRow}>
                • {u}
              </Text>
            ))}
          </View>
        )}

        <Disclaimer text={report.disclaimer} />

        <ReportFooter generatedAt={report.generatedAt} />
      </Page>
    </Document>
  );
}