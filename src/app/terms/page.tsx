import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service — M.E.U.T.",
  description:
    "MEUT Terms of Service — proprietary SaaS terms for Medical Equipment User Tracking.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service">
      <p className="text-sm text-slate-500">
        Last updated: September 20, 2026. These notices are product terms for
        MEUT, not legal advice.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. Who we are</h2>
        <p>
          MEUT (also styled M.E.U.T.), short for Medical Equipment User
          Tracking, is a proprietary software-as-a-service product owned by{" "}
          <strong>Travis Woods / MEUT</strong> (“we,” “us,” or “MEUT”). Contact:{" "}
          <a className="font-semibold text-brand-600 hover:underline" href="mailto:support@meut.app">
            support@meut.app
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">2. Acceptance</h2>
        <p>
          By creating an account, signing in, or using MEUT, you agree to these
          Terms. If you use MEUT for an organization, you represent that you
          have authority to bind that organization. If you do not agree, do not
          use the service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          3. Proprietary software license (SaaS)
        </h2>
        <p>
          MEUT software, source code, documentation, UI, workflows, branding,
          logos, and related materials are proprietary. We grant you a limited,
          non-exclusive, non-transferable, revocable right to access and use
          MEUT over the internet solely for your organization’s internal
          biomedical / clinical equipment tracking and maintenance operations,
          subject to your subscription plan and these Terms.
        </p>
        <p>
          This is a hosted SaaS license only. You do not receive ownership of
          MEUT, a copy of the source code, or any right to sublicense, sell,
          rent, or redistribute the application.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          4. What you may not do
        </h2>
        <p>Except as expressly allowed by us in writing, you may not:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Copy, clone, mirror, or redistribute MEUT software, branding, or
            substantial portions of the product for others’ use
          </li>
          <li>
            Reverse engineer, decompile, or attempt to derive source code from
            the service beyond what applicable law non-waivably permits
          </li>
          <li>
            Scrape, crawl, bulk-export, or systematically harvest MEUT
            interfaces, APIs, or content in ways that bypass normal product use
            or rate limits we set
          </li>
          <li>
            Resell, white-label, or offer MEUT as your own product or shared
            service without a separate written agreement
          </li>
          <li>
            Circumvent access controls, license caps, billing, or security
            features
          </li>
          <li>
            Use MEUT to violate law, infringe others’ rights, or interfere with
            the service
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          5. Accounts, plans, and billing
        </h2>
        <p>
          You are responsible for account credentials and for activity under
          your organization. Facility and seat limits follow your plan. Paid
          subscriptions are billed through our payment processor as presented at
          checkout or in-app. Fees are generally non-refundable except where we
          state otherwise or law requires.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          6. Your data ownership
        </h2>
        <p>
          You (or your organization) retain ownership of the equipment records,
          work orders, and other business data you enter into MEUT (“Customer
          Data”). We process Customer Data to provide and improve the service,
          as described in our{" "}
          <a className="font-semibold text-brand-600 hover:underline" href="/privacy">
            Privacy Policy
          </a>
          . You grant us a limited license to host, backup, display, and
          process Customer Data solely to operate MEUT for you.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          7. Service availability and changes
        </h2>
        <p>
          We aim for reliable uptime but do not guarantee uninterrupted access.
          We may update features, plans, or these Terms. Material changes will
          be posted on this page (and where practical, noted in-product).
          Continued use after changes become effective constitutes acceptance.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          8. Disclaimer of warranties
        </h2>
        <p>
          MEUT is provided “as is” and “as available.” To the fullest extent
          permitted by law, we disclaim warranties of merchantability, fitness
          for a particular purpose, and non-infringement. MEUT helps manage
          maintenance workflows; it does not replace professional clinical
          engineering judgment, regulatory compliance programs, or device
          manufacturer instructions.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          9. Limitation of liability
        </h2>
        <p>
          To the fullest extent permitted by law, Travis Woods / MEUT and our
          suppliers will not be liable for indirect, incidental, special,
          consequential, or punitive damages, or for lost profits, lost data, or
          business interruption, arising from your use of (or inability to use)
          MEUT. Our total liability for any claim relating to the service is
          limited to the fees you paid us for MEUT in the twelve (12) months
          before the claim arose (or USD $100 if you paid nothing). Some
          jurisdictions do not allow certain limits; in those cases, our
          liability is limited to the maximum extent allowed.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">10. Termination</h2>
        <p>
          You may stop using MEUT at any time. We may suspend or terminate
          access for breach of these Terms, non-payment, or risk to the service
          or others. Upon termination, your license ends; we may delete or
          retain Customer Data as described in the Privacy Policy and applicable
          law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          11. General
        </h2>
        <p>
          These Terms are the agreement between you and Travis Woods / MEUT
          regarding MEUT (plus any order form or plan details). If a court finds
          a provision unenforceable, the rest remains in effect. Failure to
          enforce a provision is not a waiver. You may not assign these Terms
          without our consent; we may assign them in connection with a
          reorganization or sale of the product.
        </p>
        <p>
          Questions:{" "}
          <a className="font-semibold text-brand-600 hover:underline" href="mailto:support@meut.app">
            support@meut.app
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
