import { LegalList, LegalPage, LegalSection, legalMetadata } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/components/legal/legal-info";
import { ConsentPreferences } from "@/components/consent/consent-preferences";

export const metadata = legalMetadata(
  "Cookie Policy",
  "How CreatorOS uses cookies and similar technologies (draft pending legal review).",
);

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        This Cookie Policy explains how {LEGAL_INFO.entityName} uses cookies and similar technologies on
        the CreatorOS website and platform, and how you can manage them.
      </p>

      <LegalSection heading="What cookies are">
        <p>
          Cookies are small text files stored on your device. They help a website work, remember your
          preferences, and understand how it is used. Some similar technologies (such as local storage)
          work in comparable ways.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies we use">
        <LegalList
          items={[
            <>
              <strong>Strictly necessary:</strong> a session cookie required to log you in and
              keep the service secure, plus a consent receipt cookie that records the choice you
              made and the time you made it. Both cannot be switched off through our site. We
              also keep a copy of your choice in your browser&apos;s local storage, which is
              strictly necessary because it is how we remember to stop asking.
            </>,
            <>
              <strong>Analytics:</strong> first-party tracking of page views and link clicks on
              public bio pages, stored in our own database and shown to the page owner as
              analytics. We do not use third-party advertising cookies.
            </>,
          ]}
        />
        <p>
          The consent receipt is what we check before recording anything. It is set only when you
          actively choose, and clearing it or withdrawing your choice means the analytics endpoint
          refuses to record, even if a request is sent to it directly.
        </p>
      </LegalSection>

      <LegalSection heading="Third parties">
        <p>
          Cloudflare (hosting/CDN and security) may set cookies needed to deliver and protect the site.
          Cashfree is involved only during checkout and may set its own cookies there. Their handling of
          data is governed by their own policies.
        </p>
      </LegalSection>

      <LegalSection heading="Managing cookies">
        <p>
          You can block, delete or manage cookies in your browser settings. If you disable strictly
          necessary cookies, parts of the service (such as staying logged in) may stop working. You can
          also change your analytics choice at any time using the controls below.
        </p>
      </LegalSection>

      <LegalSection heading="Consent">
        <p>
          Where required by law (for example in the UK/EU), we ask for your consent before recording
          any non-essential measurement, and you can withdraw that consent at any time. If you do not
          choose, we record nothing beyond what is strictly necessary. Analytics are only collected
          after you opt in, and declining does not reduce any feature of the service.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <ConsentPreferences />
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about cookies: {LEGAL_INFO.privacyEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
