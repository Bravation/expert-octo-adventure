import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("privacy.back", "Back")}
        </Button>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <h1 className="text-3xl font-bold text-foreground">{t("privacy.title", "Privacy Policy")}</h1>
            <p className="text-muted-foreground text-sm">{t("privacy.lastUpdated", "Last updated: March 24, 2026")}</p>

            <section>
              <h2 className="text-xl font-semibold text-foreground">1. {t("privacy.s1Title", "Introduction")}</h2>
              <p className="text-muted-foreground">
                {t("privacy.s1Body", "ServiHub (\"we,\" \"us,\" or \"our\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. By using ServiHub, you consent to the practices described in this policy.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">2. {t("privacy.s2Title", "Information We Collect")}</h2>
              <h3 className="text-lg font-medium text-foreground">{t("privacy.s2aTitle", "2.1 Information You Provide")}</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("privacy.s2a1", "Account information: name, email address, password, and account type (customer or service provider).")}</li>
                <li>{t("privacy.s2a2", "Profile information: bio, avatar photo, city, state, ZIP code, and professional details.")}</li>
                <li>{t("privacy.s2a3", "Service listings: titles, descriptions, pricing, categories, and photos.")}</li>
                <li>{t("privacy.s2a4", "Booking details: scheduled dates, times, notes, and service preferences.")}</li>
                <li>{t("privacy.s2a5", "Communications: messages exchanged through the Platform's messaging system.")}</li>
                <li>{t("privacy.s2a6", "Reviews and ratings you submit about service providers.")}</li>
                <li>{t("privacy.s2a7", "Feedback and suggestions submitted through the suggestion box.")}</li>
              </ul>
              <h3 className="text-lg font-medium text-foreground mt-4">{t("privacy.s2bTitle", "2.2 Information Collected Automatically")}</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("privacy.s2b1", "Device information: browser type, operating system, and device identifiers.")}</li>
                <li>{t("privacy.s2b2", "Usage data: pages visited, features used, and interaction patterns.")}</li>
                <li>{t("privacy.s2b3", "Location data: approximate location based on IP address, or precise location if you enable geolocation services.")}</li>
                <li>{t("privacy.s2b4", "Push notification tokens and subscription data if you opt in to notifications.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">3. {t("privacy.s3Title", "How We Use Your Information")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("privacy.s3a", "To create and manage your account and authenticate your identity.")}</li>
                <li>{t("privacy.s3b", "To facilitate service discovery, bookings, and communication between customers and providers.")}</li>
                <li>{t("privacy.s3c", "To process payments and calculate commissions.")}</li>
                <li>{t("privacy.s3d", "To send transactional notifications (booking confirmations, status updates, messages).")}</li>
                <li>{t("privacy.s3e", "To display provider profiles, reviews, and ratings to customers.")}</li>
                <li>{t("privacy.s3f", "To improve our Platform through analytics and AI-powered feedback analysis.")}</li>
                <li>{t("privacy.s3g", "To detect and prevent fraud, circumvention, and Terms of Service violations.")}</li>
                <li>{t("privacy.s3h", "To provide personalized service recommendations based on your activity.")}</li>
                <li>{t("privacy.s3i", "To comply with legal obligations and enforce our agreements.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">4. {t("privacy.s4Title", "Information Sharing & Disclosure")}</h2>
              <p className="text-muted-foreground">{t("privacy.s4Intro", "We do not sell your personal information. We may share your data in the following circumstances:")}</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("privacy.s4a", "With other users: Your profile information, service listings, and reviews are visible to other Platform users as necessary for the service marketplace.")}</li>
                <li>{t("privacy.s4b", "With payment processors: Payment information is shared with third-party payment providers (e.g., PayPal) to process transactions securely.")}</li>
                <li>{t("privacy.s4c", "With AI services: Feedback submissions may be analyzed by AI systems to generate automated responses. No personally identifiable information is shared beyond what you include in your submission.")}</li>
                <li>{t("privacy.s4d", "For legal reasons: We may disclose information if required by law, legal process, or government request, or to protect our rights and safety.")}</li>
                <li>{t("privacy.s4e", "Business transfers: In the event of a merger, acquisition, or sale, your information may be transferred as part of the transaction.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">5. {t("privacy.s5Title", "Data Security")}</h2>
              <p className="text-muted-foreground">
                {t("privacy.s5Body", "We implement industry-standard security measures to protect your information, including encryption in transit (TLS/SSL), secure authentication, and row-level security on our database. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">6. {t("privacy.s6Title", "Data Retention")}</h2>
              <p className="text-muted-foreground">
                {t("privacy.s6Body", "We retain your information for as long as your account is active or as needed to provide services. After account deactivation, we may retain certain data for legal compliance, dispute resolution, and enforcement of our agreements. Booking records and transaction data are retained for financial and tax reporting purposes.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">7. {t("privacy.s7Title", "Your Rights & Choices")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("privacy.s7a", "Access & update: You can view and update your profile information through the Settings page at any time.")}</li>
                <li>{t("privacy.s7b", "Account deletion: You can request account deactivation through the Settings page. Some data may be retained as described above.")}</li>
                <li>{t("privacy.s7c", "Notifications: You can manage push notification preferences and opt out at any time.")}</li>
                <li>{t("privacy.s7d", "Location: You can disable location sharing through your browser or device settings.")}</li>
                <li>{t("privacy.s7e", "Data portability: You may request a copy of your personal data by contacting us through the Platform's support chat.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">8. {t("privacy.s8Title", "Cookies & Tracking")}</h2>
              <p className="text-muted-foreground">
                {t("privacy.s8Body", "ServiHub uses essential cookies and local storage to maintain your session, remember your preferences (language, theme), and ensure the Platform functions correctly. We do not use third-party advertising cookies. Analytics data is collected to improve the Platform experience.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">9. {t("privacy.s9Title", "Children's Privacy")}</h2>
              <p className="text-muted-foreground">
                {t("privacy.s9Body", "ServiHub is not intended for users under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a user is under 18, we will take steps to deactivate their account and delete their data.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">10. {t("privacy.s10Title", "International Data Transfers")}</h2>
              <p className="text-muted-foreground">
                {t("privacy.s10Body", "Your information may be stored and processed in servers located in different jurisdictions. By using the Platform, you consent to the transfer of your information to countries that may have different data protection laws than your country of residence.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">11. {t("privacy.s11Title", "Changes to This Policy")}</h2>
              <p className="text-muted-foreground">
                {t("privacy.s11Body", "We may update this Privacy Policy from time to time. Material changes will be communicated via email or Platform notification at least 30 days before taking effect. Continued use of the Platform after changes constitutes acceptance of the updated policy.")}
              </p>
            </section>

            <section className="border-t border-border pt-6">
              <p className="text-muted-foreground text-sm">
                {t("privacy.contact", "If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us through the Platform's support chat.")}
              </p>
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
