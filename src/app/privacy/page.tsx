import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — M.E.U.T.",
  description:
    "MEUT Privacy Policy — how Medical Equipment User Tracking handles account and equipment data.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <p className="text-sm text-slate-500">
        Last updated: September 20, 2026. This policy explains how MEUT handles
        information. It is a product notice, not legal advice.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. Controller</h2>
        <p>
          MEUT (Medical Equipment User Tracking) is operated by{" "}
          <strong>Travis Woods / MEUT</strong>. Contact:{" "}
          <a className="font-semibold text-brand-600 hover:underline" href="mailto:support@meut.app">
            support@meut.app
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          2. Information we collect
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account information</strong> — names, usernames, passwords
            (stored hashed), organization details, role, and contact details you
            provide
          </li>
          <li>
            <strong>Customer Data</strong> — equipment inventory, facilities,
            work orders, PM schedules, contracts, technicians, imports, and
            related records you enter or upload
          </li>
          <li>
            <strong>Billing information</strong> — plan, subscription status,
            and payment references handled by our payment processor (we do not
            store full card numbers on MEUT servers)
          </li>
          <li>
            <strong>Technical logs</strong> — IP address, browser/device type,
            timestamps, and similar diagnostics needed to secure and operate the
            service
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          3. How we use information
        </h2>
        <p>We use information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide, maintain, and support MEUT for your organization</li>
          <li>Authenticate users and enforce plan limits</li>
          <li>Process subscriptions and respond to support requests</li>
          <li>Protect against abuse, fraud, and security incidents</li>
          <li>Improve reliability and features of the product</li>
        </ul>
        <p>
          We do not sell your personal information or Customer Data.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          4. Your data ownership
        </h2>
        <p>
          Your organization owns Customer Data. MEUT processes it only to run
          the service for you, subject to our{" "}
          <a className="font-semibold text-brand-600 hover:underline" href="/terms">
            Terms of Service
          </a>
          . You are responsible for the lawfulness of data you upload (including
          any regulated or sensitive content).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          5. Sharing
        </h2>
        <p>We share information only as needed with:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Infrastructure and payment providers that help us host MEUT and bill
            subscriptions (under contractual obligations to protect data)
          </li>
          <li>
            Professional advisors or authorities when required by law or to
            protect rights, safety, or the service
          </li>
          <li>
            A successor if MEUT is transferred as part of a business sale or
            reorganization, with notice where required
          </li>
        </ul>
        <p>
          Organization admins control which users in their tenant can see
          Customer Data inside MEUT.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          6. Retention and deletion
        </h2>
        <p>
          We retain account and Customer Data while your organization is active
          and for a reasonable period afterward for backups, dispute
          resolution, and legal compliance. You may request account closure or
          data export/deletion via{" "}
          <a className="font-semibold text-brand-600 hover:underline" href="mailto:support@meut.app">
            support@meut.app
          </a>
          ; we will respond within a reasonable time, subject to legal holds and
          backup cycles.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">7. Security</h2>
        <p>
          We use industry-typical safeguards (encrypted transport, hashed
          passwords, tenant-scoped access controls). No method of transmission
          or storage is perfectly secure; please use strong passwords and
          protect your credentials.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          8. Cookies and sessions
        </h2>
        <p>
          MEUT uses cookies or similar session technology required to keep you
          signed in and operate the app. We do not use third-party advertising
          trackers as part of the core product.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          9. Children’s privacy
        </h2>
        <p>
          MEUT is a business tool for clinical engineering teams and is not
          directed at children under 16. We do not knowingly collect personal
          information from children.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          10. Changes
        </h2>
        <p>
          We may update this Privacy Policy by posting a new version on this
          page with a revised “Last updated” date. Continued use of MEUT after
          changes means you acknowledge the updated policy.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">11. Contact</h2>
        <p>
          Privacy questions or requests:{" "}
          <a className="font-semibold text-brand-600 hover:underline" href="mailto:support@meut.app">
            support@meut.app
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
