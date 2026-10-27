/*
 * Terms and Conditions — Nickel And Gadget
 */

import LegalPage, { type LegalSection } from "@/components/site/LegalPage";

const LAST_UPDATED = "October 27, 2026";
const EFFECTIVE_DATE = "October 27, 2026";

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: `By accessing or using the Nickel And Gadget website located at nickelandgadget.com (the "Site"), subscribing to our newsletter, or otherwise engaging with our content or services, you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to all of these Terms, you must not access or use the Site.

These Terms apply to all visitors, subscribers, and others who access or use the Site. We reserve the right to modify these Terms at any time. We will notify you of material changes by updating the "Last Updated" date above. Your continued use of the Site after any changes constitutes your acceptance of the new Terms.`,
  },
  {
    id: "description",
    title: "2. Description of Service",
    content: `Nickel And Gadget is a consumer publication that provides articles, product guides, and a newsletter about gadgets and everyday products for older adults, including health and safety devices, smart-home products, phones and tablets, hearing and vision aids, and household tools. Our content is produced for general informational purposes only.

We do not sell products. We do not provide medical advice, diagnosis, or treatment; information about health-related devices is not a substitute for advice from your doctor, audiologist, or other qualified professional.`,
  },
  {
    id: "medical-disclaimer",
    title: "3. Product and Health Device Disclaimer",
    content: `Product descriptions, features, and prices on this Site come from manufacturers' and retailers' published information on the date of each article and may change without notice. We do not guarantee the accuracy, availability, or suitability of any product.`,
    list: [
      "Always check the seller's current product page, price, return policy, and any subscription or monitoring fees before buying.",
      "Health-related devices (such as hearing aids, medical alert systems, or blood pressure monitors) are described for general information only; ask your doctor or another qualified professional which device fits your needs.",
      "A consumer gadget is not a substitute for emergency services. In an emergency, call 911.",
      "Warranties, support, and returns are provided by the manufacturer or seller, not by Nickel And Gadget.",
    ],
    extra: `Nickel And Gadget expressly disclaims all responsibility for any loss or harm arising from the purchase or use of any product mentioned on this Site. Reliance on any information provided by Nickel And Gadget is solely at your own risk.`,
  },
  {
    id: "intellectual-property",
    title: "4. Intellectual Property Rights",
    content: `All content published on this Site — including but not limited to articles, text, graphics, images, logos, icons, audio clips, digital downloads, data compilations, and software — is the property of Nickel And Gadget or its content suppliers and is protected by applicable intellectual property laws.

You may access and read content on this Site for your personal, non-commercial use. You may share links to our articles. However, you may not:`,
    list: [
      "Reproduce, copy, republish, upload, post, transmit, or distribute any content from this Site without our express written permission",
      "Modify or create derivative works based on our content",
      "Use our content for commercial purposes without a licensing agreement",
      "Remove any copyright, trademark, or other proprietary notices from our content",
      "Scrape, crawl, or use automated tools to collect content from the Site in bulk",
    ],
    extra: `If you wish to use our content beyond personal reading, please contact us at hello@nickelandgadget.com to request permission.`,
  },
  {
    id: "user-conduct",
    title: "5. User Conduct",
    content: `When using our Site or interacting with us through contact forms or newsletter subscriptions, you agree not to:`,
    list: [
      "Use the Site for any unlawful purpose or in violation of any applicable laws or regulations",
      "Submit false, misleading, or fraudulent information through any form on the Site",
      "Attempt to gain unauthorized access to any portion of the Site or its related systems",
      "Interfere with or disrupt the integrity or performance of the Site",
      "Transmit any viruses, malware, or other harmful code",
      "Engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Site",
      "Use the Site to send unsolicited communications (spam)",
    ],
  },
  {
    id: "newsletter",
    title: "6. Newsletter Subscription",
    content: `By subscribing to the Nickel And Gadget newsletter, you agree to receive periodic email communications from us containing product guides, gadget news, deals, and sponsored offers from advertisers.`,
    list: [
      "You may unsubscribe at any time by clicking the unsubscribe link in any email we send, or by contacting us directly.",
      "We will not sell or share your email address with third parties for their marketing purposes.",
      "We reserve the right to modify the frequency, format, or content of our newsletter at any time.",
      "Subscription to our newsletter does not create a professional or advisory relationship of any kind.",
    ],
  },
  {
    id: "third-party-links",
    title: "7. Third-Party Links and Resources",
    content: `Our Site may contain links to third-party websites, research papers, studies, and other external resources. These links are provided for your convenience and informational purposes only.

We do not endorse, control, or assume responsibility for the content, privacy policies, or practices of any third-party sites or services. We make no representations or warranties regarding the accuracy, completeness, or reliability of any third-party content. Your access to and use of third-party sites is at your own risk and subject to those sites' own terms and conditions.

References to scientific studies, research papers, or publications are provided for informational context. We do not guarantee that our interpretation or summary of such research is complete, current, or free from error.`,
  },
  {
    id: "affiliate-disclosure",
    title: "8. Affiliate and Advertising Disclosure",
    content: `Nickel And Gadget is reader-supported. Some product links on the Site and in our newsletter are affiliate links: if you click one and make a purchase, we may earn a commission at no additional cost to you. Our newsletter also carries paid advertisements from third parties, which are labeled "Sponsored".

Our product guides are researched from manufacturers' and retailers' published information and other sources listed in each article. We do not test products hands-on, and we do not accept payment to describe a product more favorably. Prices and availability are set by the sellers and can change at any time; always check the seller's page before buying. Any purchase is a transaction between you and the seller.`,
  },
  {
    id: "disclaimer-warranties",
    title: "9. Disclaimer of Warranties",
    content: `THE SITE AND ITS CONTENT ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, NICKEL AND GADGET DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:`,
    list: [
      "Implied warranties of merchantability, fitness for a particular purpose, and non-infringement",
      "Warranties that the Site will be uninterrupted, error-free, or free of viruses or other harmful components",
      "Warranties regarding the accuracy, completeness, reliability, or timeliness of any content on the Site",
      "Warranties that any defects in the Site will be corrected",
    ],
    extra: `Some jurisdictions do not allow the exclusion of implied warranties, so the above exclusions may not apply to you.`,
  },
  {
    id: "limitation-liability",
    title: "10. Limitation of Liability",
    content: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NICKEL AND GADGET AND ITS OFFICERS, DIRECTORS, EMPLOYEES, CONTRIBUTORS, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES — ARISING OUT OF OR IN CONNECTION WITH:`,
    list: [
      "Your access to or use of (or inability to access or use) the Site",
      "Any content obtained from the Site",
      "Any purchase or use of a product mentioned on the Site",
      "Unauthorized access to or alteration of your transmissions or data",
      "Any other matter relating to the Site",
    ],
    extra: `In no event shall our total liability to you for all claims arising from or related to the Site exceed one hundred US dollars ($100). This limitation applies regardless of the form of action and whether we have been advised of the possibility of such damages.`,
  },
  {
    id: "indemnification",
    title: "11. Indemnification",
    content: `You agree to defend, indemnify, and hold harmless Nickel And Gadget and its officers, directors, employees, contributors, and agents from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Site, including but not limited to any use of the Site's content other than as expressly authorized in these Terms.`,
  },
  {
    id: "governing-law",
    title: "12. Governing Law and Dispute Resolution",
    content: `These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Any dispute arising from or relating to these Terms or your use of the Site shall first be attempted to be resolved through good-faith negotiation between the parties.

If the dispute cannot be resolved through negotiation within 30 days, it shall be submitted to binding arbitration in accordance with the rules of the American Arbitration Association. The arbitration shall take place in the United States, and the arbitrator's decision shall be final and binding.

You agree that any dispute resolution proceedings will be conducted only on an individual basis and not in a class, consolidated, or representative action.`,
  },
  {
    id: "termination",
    title: "13. Termination",
    content: `We reserve the right to terminate or suspend your access to the Site, at our sole discretion, without notice and without liability, for any reason, including if we believe you have violated these Terms. Upon termination, your right to use the Site will immediately cease.

All provisions of these Terms which by their nature should survive termination shall survive, including without limitation: ownership provisions, warranty disclaimers, indemnity, and limitations of liability.`,
  },
  {
    id: "entire-agreement",
    title: "14. Entire Agreement",
    content: `These Terms, together with our Privacy Policy and any other legal notices published by us on the Site, constitute the entire agreement between you and Nickel And Gadget concerning your use of the Site. If any provision of these Terms is deemed invalid by a court of competent jurisdiction, the invalidity of such provision shall not affect the validity of the remaining provisions, which shall remain in full force and effect.

Our failure to enforce any right or provision of these Terms shall not be considered a waiver of those rights.`,
  },
  {
    id: "contact",
    title: "15. Contact Information",
    content: `If you have any questions about these Terms and Conditions, please contact us at:

Nickel And Gadget
Email: legal@nickelandgadget.com
Website: nickelandgadget.com/contact`,
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms & Conditions"
      dates={<><span>Last updated: {LAST_UPDATED}</span><span>Effective: {EFFECTIVE_DATE}</span></>}
      summary={
        <>
          <strong>Key points:</strong> By using this Site, you agree to these Terms. Our product guides are for general information only; prices and details come from sellers and can change. Always consult a qualified healthcare professional before making health decisions. We are not liable for any health outcomes resulting from information on this Site.
        </>
      }
      sections={sections}
    />
  );
}
