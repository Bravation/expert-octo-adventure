import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("tos.back", "Back")}
        </Button>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <h1 className="text-3xl font-bold text-foreground">{t("tos.title", "Terms of Service")}</h1>
            <p className="text-muted-foreground text-sm">{t("tos.lastUpdated", "Last updated: March 24, 2026")}</p>

            <section>
              <h2 className="text-xl font-semibold text-foreground">1. {t("tos.s1Title", "Acceptance of Terms")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s1Body", "By accessing or using ServiHub (\"the Platform\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree, you must not use the Platform. These Terms apply to all users, including customers and service providers.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">2. {t("tos.s2Title", "Platform Purpose")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s2Body", "ServiHub is a marketplace that connects service providers with customers. The Platform facilitates discovery, booking, communication, and payment for services. ServiHub acts solely as an intermediary and is not a party to any service agreement between providers and customers.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">3. {t("tos.s3Title", "User Accounts")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s3Body", "You must provide accurate, complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. You must notify us immediately of any unauthorized use. ServiHub reserves the right to suspend or terminate accounts that violate these Terms.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">4. {t("tos.s4Title", "Non-Circumvention & Platform Exclusivity")}</h2>
              <p className="text-muted-foreground font-medium text-foreground">
                {t("tos.s4Intro", "This is a critical clause. By using ServiHub, you agree to the following:")}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("tos.s4a", "You shall NOT solicit, divert, or attempt to redirect any customer or provider discovered through the Platform to conduct transactions outside of ServiHub.")}</li>
                <li>{t("tos.s4b", "You shall NOT share personal contact information (phone numbers, emails, social media handles, external website links) for the purpose of circumventing the Platform's booking and payment systems.")}</li>
                <li>{t("tos.s4c", "All bookings, communications, and payments for services discovered through ServiHub must be conducted exclusively through the Platform for a minimum period of 24 months from the initial connection.")}</li>
                <li>{t("tos.s4d", "Violation of this clause may result in immediate account termination, forfeiture of pending earnings, and legal action to recover lost commissions and damages.")}</li>
                <li>{t("tos.s4e", "ServiHub reserves the right to monitor communications on the Platform to detect circumvention attempts, in compliance with applicable privacy laws.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">5. {t("tos.s5Title", "Commission & Fees")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s5Body", "Service providers agree to pay a commission on each completed transaction processed through the Platform. The commission rate starts at 15% and decreases by 1% for every 20 completed bookings, down to a minimum of 5%. A platform fee (15%) plus Stripe processing (2.9% + $0.30) is added on top of the provider's price at checkout, so providers always net their full listed price. All fees are non-refundable unless otherwise stated. ServiHub reserves the right to modify fee structures with 30 days' prior notice.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">6. {t("tos.s6Title", "Payments & Refunds")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s6Body", "All payments must be processed through the Platform's integrated payment system. Direct payments between users outside the Platform are strictly prohibited. Refund requests are handled on a case-by-case basis. Booking fees are retained by the Platform regardless of service completion. Service payments are released to providers after successful service completion and confirmation.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">7. {t("tos.s7Title", "Service Provider Obligations")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("tos.s7a", "Providers must deliver services as described in their listings with professional quality.")}</li>
                <li>{t("tos.s7b", "Providers must maintain accurate availability, pricing, and service descriptions.")}</li>
                <li>{t("tos.s7c", "Providers must respond to booking requests within 48 hours.")}</li>
                <li>{t("tos.s7d", "Providers must hold all necessary licenses, permits, and insurance required for their services.")}</li>
                <li>{t("tos.s7e", "Providers must not discriminate against customers based on race, gender, religion, nationality, or any other protected characteristic.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">8. {t("tos.s8Title", "Customer Obligations")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("tos.s8a", "Customers must provide accurate information when booking services.")}</li>
                <li>{t("tos.s8b", "Customers must pay for services through the Platform's payment system.")}</li>
                <li>{t("tos.s8c", "Customers must treat service providers with respect and professionalism.")}</li>
                <li>{t("tos.s8d", "Customers must provide honest and fair reviews based on their actual experience.")}</li>
                <li>{t("tos.s8e", "Cancellations must follow the Platform's cancellation policy. Late cancellations may incur fees.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">9. {t("tos.s9Title", "Prohibited Conduct")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("tos.s9a", "Using the Platform for any unlawful purpose or to solicit illegal activities.")}</li>
                <li>{t("tos.s9b", "Creating fake accounts, reviews, or listings.")}</li>
                <li>{t("tos.s9c", "Harassing, threatening, or intimidating other users.")}</li>
                <li>{t("tos.s9d", "Scraping, crawling, or using automated tools to extract data from the Platform.")}</li>
                <li>{t("tos.s9e", "Interfering with or disrupting the Platform's functionality or security.")}</li>
                <li>{t("tos.s9f", "Posting content that is defamatory, obscene, or infringes on intellectual property rights.")}</li>
                <li>{t("tos.s9g", "Advertising competing platforms or services within ServiHub.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">10. {t("tos.s10Title", "Intellectual Property")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s10Body", "All content, trademarks, logos, and intellectual property on the Platform belong to ServiHub or its licensors. Users retain ownership of content they submit but grant ServiHub a worldwide, non-exclusive, royalty-free license to use, display, and distribute such content for Platform operations and marketing purposes.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">11. {t("tos.s11Title", "Limitation of Liability")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s11Body", "ServiHub is not liable for the quality, safety, or legality of services provided by service providers. The Platform is provided \"as is\" without warranties of any kind. ServiHub's total liability shall not exceed the fees paid by you to the Platform in the 12 months preceding the claim. ServiHub is not responsible for any indirect, incidental, special, or consequential damages.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">12. {t("tos.s12Title", "Dispute Resolution")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s12Body", "Any disputes between users should first be resolved through the Platform's internal messaging system. If a resolution cannot be reached, ServiHub may mediate at its discretion. For disputes between a user and ServiHub, both parties agree to binding arbitration. Class action lawsuits and jury trials are waived to the fullest extent permitted by law.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">13. {t("tos.s13Title", "Privacy")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s13Body", "Your use of the Platform is also governed by our Privacy Policy. By using ServiHub, you consent to the collection, use, and sharing of your information as described in our Privacy Policy.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">14. {t("tos.s14Title", "Termination")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s14Body", "ServiHub may suspend or terminate your account at any time for violation of these Terms. Upon termination, your right to use the Platform ceases immediately. Pending transactions may be cancelled, and any outstanding fees remain payable. Sections regarding non-circumvention, intellectual property, limitation of liability, and dispute resolution survive termination.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">15. {t("tos.s15Title", "Modifications")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s15Body", "ServiHub reserves the right to modify these Terms at any time. Material changes will be communicated via email or Platform notification at least 30 days before taking effect. Continued use of the Platform after changes constitutes acceptance of the updated Terms.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">16. {t("tos.s16Title", "Governing Law")}</h2>
              <p className="text-muted-foreground">
                {t("tos.s16Body", "These Terms are governed by and construed in accordance with applicable laws. Any legal proceedings shall be conducted in the jurisdiction where ServiHub is incorporated.")}
              </p>
            </section>

            <section className="border-t border-border pt-6">
              <p className="text-muted-foreground text-sm">
                {t("tos.contact", "If you have any questions about these Terms, please contact us through the Platform's support chat.")}
              </p>
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default TermsOfService;
