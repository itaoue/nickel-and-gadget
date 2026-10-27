/*
 * Privacy Policy Page — Nickel And Gadget
 * Design: Clinical Clarity — Swiss editorial, Fraunces serif + Plus Jakarta Sans
 */

import LegalPage, { type LegalSection } from "@/components/site/LegalPage";

const LAST_UPDATED = "March 1, 2026";

const sections: LegalSection[] = [
  {
    id: "introduction",
    title: "1. Introduction",
    content: `Nickel And Gadget ("we," "our," or "us") is committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website nickelandgadget.com (the "Site") and subscribe to our newsletter or otherwise interact with our services.

Please read this policy carefully. If you disagree with its terms, please discontinue use of our Site. This policy applies to all information collected through our Site and any related services, sales, marketing, or events.`,
  },
  {
    id: "information-collected",
    title: "2. Information We Collect",
    content: `We collect information you voluntarily provide to us when you subscribe to our newsletter, fill out a contact form, or otherwise communicate with us. The personal information we may collect includes:`,
    list: [
      "Email address (when you subscribe to our newsletter or contact us)",
      "First and last name (optional, when provided in contact forms)",
      "Message content (when you submit a contact inquiry)",
      "Any other information you choose to provide",
    ],
    extra: `We also automatically collect certain information when you visit our Site. This information does not reveal your specific identity but may include device and usage information such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, and information about how and when you use our Site. This information is primarily needed to maintain the security and operation of our Site and for our internal analytics and reporting purposes.`,
  },
  {
    id: "use-of-information",
    title: "3. How We Use Your Information",
    content: `We use the information we collect or receive for the following purposes:`,
    list: [
      "To send you our newsletter, product guides, deals and sponsored offers you have subscribed to",
      "To respond to your inquiries and contact form submissions",
      "To send administrative information such as changes to our terms, conditions, and policies",
      "To analyze usage patterns and improve our Site and content",
      "To protect our Site from fraudulent, illegal, or unauthorized activity",
      "To comply with our legal obligations",
    ],
  },
  {
    id: "sharing",
    title: "4. Sharing Your Information",
    content: `We do not sell, trade, rent, or otherwise transfer your personal information to outside parties for their marketing purposes. We may share your information in the following limited circumstances:`,
    list: [
      "Service Providers: We may share your information with third-party vendors and service providers that perform services on our behalf, such as email delivery services (e.g., Mailchimp or similar), analytics providers, and hosting services. These parties are contractually obligated to keep your information confidential and use it only for the purposes for which we disclose it to them.",
      "Business Transfers: If we are involved in a merger, acquisition, or sale of all or a portion of our assets, your information may be transferred as part of that transaction.",
      "Legal Requirements: We may disclose your information where required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency).",
    ],
  },
  {
    id: "cookies",
    title: "5. Cookies and Tracking Technologies",
    content: `We may use cookies, web beacons, pixel tags, and similar tracking technologies to collect and store information about your visit to our Site. Cookies are small data files placed on your device that allow us to recognize your browser and capture and remember certain information.

We use cookies to understand and save your preferences for future visits, compile aggregate data about Site traffic and interaction, and improve our Site experience. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Site.`,
  },
  {
    id: "third-party",
    title: "6. Third-Party Websites",
    content: `Our Site may contain links to third-party websites and services that are not owned or controlled by Nickel And Gadget. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services. We strongly advise you to review the privacy policy of every site you visit. We are not responsible for the privacy practices or the content of such websites.`,
  },
  {
    id: "data-retention",
    title: "7. Data Retention",
    content: `We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our policies.

If you wish to cancel your newsletter subscription or request that we no longer use your information, please contact us at the address provided below. We will respond to your request within 30 days.`,
  },
  {
    id: "security",
    title: "8. Security of Your Information",
    content: `We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.`,
  },
  {
    id: "your-rights",
    title: "9. Your Privacy Rights",
    content: `Depending on your location, you may have certain rights regarding your personal information:`,
    list: [
      "The right to access the personal information we hold about you",
      "The right to request correction of inaccurate personal information",
      "The right to request deletion of your personal information",
      "The right to opt out of marketing communications at any time by clicking the unsubscribe link in any email we send",
      "The right to data portability in certain circumstances",
      "California residents may have additional rights under the California Consumer Privacy Act (CCPA), including the right to know, the right to delete, and the right to opt out of the sale of personal information",
    ],
    extra: `To exercise any of these rights, please contact us using the information provided in the Contact section below.`,
  },
  {
    id: "children",
    title: "10. Children's Privacy",
    content: `Our Site is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us so that we can take necessary action.`,
  },
  {
    id: "changes",
    title: "11. Changes to This Privacy Policy",
    content: `We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.`,
  },
  {
    id: "contact",
    title: "12. Contact Us",
    content: `If you have any questions about this Privacy Policy or our privacy practices, please contact us at:

Nickel And Gadget
Email: privacy@nickelandgadget.com
Website: nickelandgadget.com/contact`,
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      dates={<span>Last updated: {LAST_UPDATED}</span>}
      summary={
        <>
          <strong>Summary:</strong> We collect only the information you voluntarily provide (such as your email for our newsletter). We do not sell your personal information to third parties. You can unsubscribe or request deletion of your data at any time.
        </>
      }
      sections={sections}
    />
  );
}
