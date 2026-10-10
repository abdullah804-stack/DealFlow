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
 * Discovery report PDF — the 11-section VC memo format.
 * Renders from stored ReportJson, never from a fresh AI call.
 */

const SECTION_TITLES: Record<ReportSectionKey, string> = {
  executive_summary: "Executive Summary",
  startup_overview: "Startup Overview",
  competitive_landscape: "Competitive Landscape",
  technology_analysis: "Technology Analysis",
  market_analysis: "Market Analysis",
  financial_analysis: "Financial Analysis",
  legal_analysis: "Legal Analysis",
  founder_evaluation: "Founder Evaluation",
  debate_summary: "Committee Debate",
  recommendation: "Recommendation",
};

export function DiscoveryReportPdf({ report }: { report: ReportJson }) {
  const sourceInfo = report.source_info;

  return (
    <Document
      title={`${report.company} — Investment Report`}
      author="DealFlow"
      subject="Investment committee report"
      creator="DealFlow"
    >
      <Page size="A4" style={styles.page} wrap>
        <ReportHeader
          title={report.company}
          decision={report.decision}
          meta={[
            report.generatedAt.slice(0, 10),
            report.weighted_score
              ? `Weighted score: ${report.weighted_score.toFixed(2)}/10`
              : null,
            report.committee?.rubricVersion
              ? `Rubric v${report.committee.rubricVersion}`
              : null,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        />

        {sourceInfo && (
          <View style={styles.sourceBox}>
            <Text style={styles.sourceLabel}>Source</Text>
            {sourceInfo.platform_display && (
              <Text style={styles.sourceValue}>
                Platform: {sourceInfo.platform_display}
              </Text>
            )}
            {sourceInfo.username && (
              <Text style={styles.sourceValue}>
                Author: {sourceInfo.username}
              </Text>
            )}
            {sourceInfo.url && (
              <Text style={styles.sourceValue}>URL: {sourceInfo.url}</Text>
            )}
          </View>
        )}

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
                Committee Disagreements
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

        <Disclaimer text={report.disclaimer} />

        <ReportFooter generatedAt={report.generatedAt} />
      </Page>
    </Document>
  );
}