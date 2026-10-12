import Link from "next/link";
import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "Privacy Policy — DealFlow",
  description:
    "How DealFlow collects, uses, and protects your data. What we store, who we share it with, and how to request deletion.",
};

const LAST_UPDATED = "October 12, 2026";
const CONTACT_EMAIL = "Muhammadabd778899@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="px-8 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <div className="eyebrow mb-4">Legal</div>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="text-4xl md:text-5xl font-semibold mb-4 leading-tight">
            Privacy Policy
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="text-[var(--color-text-low)] text-sm font-mono mb-12">
            Last updated: {LAST_UPDATED}
          </p>
        </Reveal>

        <div className="space-y-8">
          <Section title="Who we are">
            <p>
              DealFlow is a research tool that discovers startups from public
              sources and evaluates them through an autonomous investment
              committee. It is operated as a brand by an individual based in
              Pakistan. This policy explains what data we collect when you use
              DealFlow, how we use it, and what rights you have.
            </p>
            <p>
              For privacy questions or requests, contact{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[var(--color-neon)] hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="What we collect">
            <p>We collect only what you provide or what the service needs to function:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account information:</strong> email address, optional
                name, and a hashed password (if you sign up with credentials).
                If you sign in with Google, we receive your email address,
                name, and profile image from Google.
              </li>
              <li>
                <strong>Idea submissions:</strong> the title, one-liner,
                problem, solution, and any optional fields you fill in when
                submitting an idea for evaluation.
              </li>
              <li>
                <strong>Interview answers:</strong> your responses to the
                committee&apos;s questions during the interview phase.
              </li>
              <li>
                <strong>Generated reports:</strong> the evaluation output
                produced by the committee, stored as JSON and PDF.
              </li>
            </ul>
            <p>
              We do not collect analytics, tracking cookies, advertising
              identifiers, or device fingerprints. The only cookie we set is
              a session cookie required to keep you signed in.
            </p>
          </Section>

          <Section title="How we use your data">
            <p>We use your data only to run the service:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To authenticate you and keep you signed in.</li>
              <li>
                To run your idea through the committee and store the resulting
                report on your account.
              </li>
              <li>
                To display your past submissions and reports when you return.
              </li>
            </ul>
            <p>
              <strong>We do not</strong> sell your data, use it for
              advertising, train our own models on it, or share it with any
              third party except the infrastructure providers named below.
            </p>
          </Section>

          <Section title="Where your data is stored and processed">
            <p>
              DealFlow uses the following third-party services to operate.
              Each is a sub-processor of your data within the meaning of
              applicable privacy law:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Neon</strong> (neon.tech) — hosts the Postgres database
                that stores your account, submissions, interview answers, and
                reports.
              </li>
              <li>
                <strong>Vercel</strong> (vercel.com) — hosts the web application
                and stores generated report PDFs in private Blob storage.
              </li>
              <li>
                <strong>Groq</strong> (groq.com) — provides LLM inference used
                to evaluate your idea. Prompts and completions are transmitted
                to Groq during evaluation.
              </li>
              <li>
                <strong>OpenRouter</strong> (openrouter.ai) — fallback LLM
                provider, used only if Groq is unavailable. Same data transfer
                as above.
              </li>
              <li>
                <strong>GitHub</strong> (github.com) — hosts the source code and
                runs the daily discovery pipeline. No user-identifiable data is
                written to GitHub.
              </li>
              <li>
                <strong>Google</strong> (google.com) — only if you choose
                &quot;Sign in with Google.&quot; Google receives your email and
                profile picture at sign-in.
              </li>
            </ul>
            <p>
              These services process data in the United States and the
              European Union. By using DealFlow, you consent to this
              cross-border transfer.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              Your account data, submissions, and reports are retained for as
              long as your account is active. If you delete your account or
              request deletion, we remove your data from our live database
              within 30 days. Encrypted backups may retain your data for up to
              30 additional days before automatic purge.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              Regardless of where you live, we extend the following rights to
              every user:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Access:</strong> request a copy of all data we hold
                about you.
              </li>
              <li>
                <strong>Correction:</strong> request that we fix inaccurate
                information.
              </li>
              <li>
                <strong>Deletion:</strong> request that we delete your account
                and associated data.
              </li>
              <li>
                <strong>Portability:</strong> receive your data in a
                machine-readable format.
              </li>
              <li>
                <strong>Objection:</strong> object to specific processing
                activities.
              </li>
            </ul>
            <p>
              To exercise any of these, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[var(--color-neon)] hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              . We respond to all requests within 30 days.
            </p>
          </Section>

          <Section title="Security">
            <p>
              Passwords are hashed with bcrypt before storage and are never
              visible to us. All traffic is served over HTTPS. Session cookies
              are HTTP-only and not readable by client-side JavaScript.
              Access to the production database is restricted to the operator
              and the sub-processors listed above.
            </p>
            <p>
              No system is perfectly secure. If you believe your account has
              been compromised, contact us immediately.
            </p>
          </Section>

          <Section title="Children">
            <p>
              DealFlow is not intended for users under 16. We do not knowingly
              collect data from children. If you believe a child has created
              an account, contact us and we will delete it.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time. Material changes
              will be announced on the site before they take effect. The
              &quot;Last updated&quot; date at the top reflects the most recent
              revision.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For any privacy question, request, or concern, contact{" "}
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