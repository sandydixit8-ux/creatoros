import { LegalList, LegalPage, LegalSection, legalMetadata } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/components/legal/legal-info";

export const metadata = legalMetadata(
  "Terms of Service",
  "The terms that govern your use of CreatorOS (draft pending legal review).",
);

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms of Service (&quot;Terms&quot;) are a legal agreement between you and{" "}
        {LEGAL_INFO.entityName} ({LEGAL_INFO.companyNumber}, {LEGAL_INFO.address}) (&quot;CreatorOS&quot;,
        &quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account or using the service you
        agree to these Terms. If you do not agree, do not use the service.
      </p>

      <LegalSection heading="1. Who we are">
        <p>
          CreatorOS is a platform that lets creators build link-in-bio pages, sell digital products and
          courses, take bookings, run email lists, and view analytics. The service is operated by{" "}
          {LEGAL_INFO.entityName}.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility and accounts">
        <LegalList
          items={[
            "You must be old enough to form a binding contract in your jurisdiction and, where required, have permission from a parent or guardian.",
            "You must provide accurate information and keep it up to date.",
            "You are responsible for your account credentials and for all activity that happens under your account.",
            "Notify us promptly if you believe your account has been compromised.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Plans, payments and renewals">
        <LegalList
          items={[
            "Paid plans are billed through our payment processors: Cashfree for Indian rupee (INR) transactions, and Dodo Payments (as Merchant of Record) for US dollar and other international currencies. By subscribing you authorise recurring charges until you cancel.",
            "Subscriptions renew automatically at the end of each billing period. You can cancel at any time from the Billing page; access continues until the end of the period already paid for.",
            "Prices are shown in your chosen currency (US dollars and Indian rupees today) and may change. We will give notice of material price changes before they take effect.",
            "Taxes may apply depending on your location and are your responsibility unless collected by us.",
            "Where required by law, we may suspend or cancel a plan and issue a refund as described in our Refund Policy.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Acceptable use">
        <p>You agree not to use the service to:</p>
        <LegalList
          items={[
            "break any law or regulation, or infringe the rights of others (including intellectual-property and privacy rights);",
            "send spam or unsolicited communications, or upload content you do not have the rights to;",
            "distribute malware, phishing, or other harmful code;",
            "attempt to disrupt, overload, scan, or reverse-engineer the service; or",
            "misrepresent your identity or your relationship with any person or organisation.",
          ]}
        />
        <p>We may investigate and take action, including removing content or suspending accounts.</p>
      </LegalSection>

      <LegalSection heading="5. Your content and licence">
        <LegalList
          items={[
            "You keep ownership of the content you upload (your bio pages, media, products, courses, email lists and messages).",
            "You grant us a worldwide, non-exclusive licence to host, store, process, display and deliver that content solely as needed to operate and improve the service.",
            "You are responsible for having the rights to everything you upload and for the content being lawful.",
            "You are the controller of any personal data you collect from your own visitors and customers; we process it on your behalf as a processor. You must provide your own privacy notice to them.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. Third-party services">
        <p>
          The service relies on third parties such as Cashfree and Dodo Payments (payments) and Brevo
          (transactional email), and may rely on other providers for hosting and delivery. Their terms and
          privacy policies may also apply. We are not responsible for the acts or omissions of third-party services.
        </p>
      </LegalSection>

      <LegalSection heading="7. Availability and changes to the service">
        <p>
          We work to keep the service available but we do not guarantee uninterrupted or error-free
          operation. We may add, change or remove features, and may perform maintenance. Where a change
          materially affects a paid plan we will give reasonable notice.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers and liability">
        <p>
          The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of
          any kind to the maximum extent permitted by law. To the maximum extent permitted by law, our
          total liability arising out of or relating to the service is limited to the greater of the amount
          you paid us in the 12 months before the claim or USD 100. We are not liable for indirect,
          incidental, special or consequential loss, or for loss of profits, revenue, data or goodwill.
        </p>
        <p>
          Nothing in these Terms limits any liability that cannot lawfully be limited, including for
          fraud, or for death or personal injury caused by our negligence. Mandatory consumer rights in
          your country of residence are not affected.
        </p>
      </LegalSection>

      <LegalSection heading="9. Suspension and termination">
        <p>
          We may suspend or terminate your account if you violate these Terms, if required by law, or if
          your use poses a risk to us or others. You may stop using the service and delete your account at
          any time. On termination your right to use the service ends; sections that by their nature should
          survive (such as liability, ownership and governing law) will survive.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing law and disputes">
        <p>
          These Terms are governed by the laws of {LEGAL_INFO.governingLaw}, and the courts of that
          jurisdiction have exclusive jurisdiction, subject to any mandatory consumer-protection rules that
          give you the right to bring proceedings in your country of residence.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If a change is material we will notify you before it
          takes effect. Continuing to use the service after a change takes effect means you accept the
          updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact">
        <p>
          Questions about these Terms: {LEGAL_INFO.supportEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
