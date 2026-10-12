import Link from "next/link";
import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "Terms of Service — DealFlow",
  description:
    "The rules for using DealFlow. What the service is, what it is not, and what you agree to when you create an account.",
};

const LAST_UPDATED = "October 12, 2026";
const CONTACT_EMAIL = "Muhammadabd778899@gmail.com";
const GOVERNING_LAW = "Pakistan";

export default function TermsPage() {
  return (
    <main className="px-8 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <div className="eyebrow mb-4">Legal</div>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="text-4xl md:text-5xl font-semibold mb-4 leading-tight">
            Terms of Service
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="text-[var(--color-text-low)] text-sm font-mono mb-12">
            Last updated: {LAST_UPDATED}
          </p>
        </Reveal>

        <div className="space-y-8">
          <Section title="Acceptance">
            <p>
              By creating an account or using DealFlow, you agree to these
              Terms. If you do not agree, do not use the service. DealFlow is
              operated as a brand by an individual based in {GOVERNING_LAW}.
            </p>
          </Section>

          <Section title="What DealFlow is">
            <p>
              DealFlow is a research and analysis tool. It discovers startups
              from public sources, evaluates them through an autonomous
              investment committee powered by large language models, and
              produces written reports. It also lets you submit your own idea
              for the same committee to evaluate.
            </p>
          </Section>

          <Section title="What DealFlow is not">
            <p>
              <strong>
                DealFlow does not provide financial, investment, legal, or
                tax advice.
              </strong>{" "}
              Nothing produced by the service should be relied on to make any
              investment decision.
            </p>
            <p>
              DealFlow does not execute trades, place investments, integrate
              with any brokerage or payment system, or hold any funds. This
              is a permanent boundary, not a temporary limitation.
            </p>
            <p>
              DealFlow does not establish a fiduciary, advisory, or
              professional relationship with you. All output is LLM-generated
              and is not calibrated statistical prediction.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              You are responsible for keeping your password secure. One account
              per person. Do not share credentials. You are responsible for
              all activity that occurs under your account.
            </p>
            <p>
              You must be at least 16 years old to use DealFlow. You must
              provide accurate information when creating an account.
            </p>
          </Section>

          <Section title="Your submissions">
            <p>
              You retain all rights to the idea, content, and information you
              submit to DealFlow. We do not claim ownership of your idea.
            </p>
            <p>
              By submitting content, you grant us a limited license to store
              and process it for the sole purpose of running the evaluation
              and displaying the result back to you.
            </p>
            <p>
              You are responsible for ensuring you have the right to share
              whatever you submit. Do not submit confidential information
              belonging to a third party without permission.
            </p>
          </Section>

          <Section title="Generated reports">
            <p>
              The reports DealFlow produces from your submissions are licensed
              to you for personal and internal business use. You may share
              them, quote them, and use them to inform decisions. You may not
              resell the reports as a standalone product, or claim that
              DealFlow endorses any decision you make.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Attempt to manipulate the committee through prompt injection or similar.</li>
              <li>Scrape the service, its reports, or its underlying data at scale.</li>
              <li>Reverse engineer the evaluation logic beyond what is publicly documented on the methodology page.</li>
              <li>Use the service to harass, defame, or invade the privacy of any person or company.</li>
              <li>Attempt to access another user&apos;s data or the operator&apos;s infrastructure without authorization.</li>
              <li>Use the service in violation of any applicable law.</li>
            </ul>
            <p>
              We may suspend or terminate accounts that violate these rules.
            </p>
          </Section>

          <Section title="Third-party sources">
            <p>
              DealFlow discovers startups from public sources including
              Hacker News, Reddit, and public RSS feeds. We do not control
              those sources and cannot guarantee the accuracy of any
              information they provide. The committee evaluates what the
              source data contains; if a source is wrong, the evaluation may
              be wrong.
            </p>
          </Section>

          <Section title="Service availability">
            <p>
              DealFlow is provided as-is. We make no guarantee of uptime,
              accuracy, or fitness for a particular purpose. We may change,
              suspend, or discontinue any part of the service at any time.
            </p>
            <p>
              The daily discovery pipeline, the committee, and report
              generation are all dependent on third-party LLM providers. When
              those providers are degraded, the service is degraded.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, DealFlow and its
              operator are not liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              service.
            </p>
            <p>
              Our total liability to you for any claim arising from these
              Terms or the service is limited to the greater of (a) the total
              amount you have paid DealFlow in the 12 months preceding the
              claim, or (b) zero, if the service was provided to you free of
              charge.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              You may stop using DealFlow at any time, and you may request
              deletion of your account by email. We may suspend or terminate
              your access if you violate these Terms, if required by law, or
              if we discontinue the service.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These Terms are governed by the laws of {GOVERNING_LAW}. Any
              dispute arising from these Terms or your use of the service is
              subject to the exclusive jurisdiction of the courts of{" "}
              {GOVERNING_LAW}.
            </p>
          </Section>

          <Section title="Changes to these Terms">
            <p>
              We may update these Terms from time to time. Material changes
              will be announced on the site before they take effect. Your
              continued use of the service after a change indicates your
              acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For any question about these Terms, contact{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[var(--color-neon)] hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-[var(--color-border-soft)]">
          <Link
            href="/"
            className="text-sm text-[var(--color-text-low)] hover:text-[var(--color-neon)]"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section className="panel-lg">
<h2 className="section-heading text-xl font-semibold mb-4">{title}</h2>        <div className="space-y-4 text-sm text-[var(--color-text-mid)] leading-relaxed">
          {children}
        </div>
      </section>
    </Reveal>
  );
}