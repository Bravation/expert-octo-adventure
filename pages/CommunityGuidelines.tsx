import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CommunityGuidelines = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("community.back", "Back")}
        </Button>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <h1 className="text-3xl font-bold text-foreground">{t("community.title", "Community Guidelines")}</h1>
            <p className="text-muted-foreground text-sm">{t("community.lastUpdated", "Last updated: March 24, 2026")}</p>
            <p className="text-muted-foreground">
              {t("community.intro", "ServiHub is built on trust between service providers and customers. These Community Guidelines establish the standards of behavior expected from every member. Violations may result in warnings, account suspension, or permanent removal from the Platform.")}
            </p>

            <section>
              <h2 className="text-xl font-semibold text-foreground">1. {t("community.s1Title", "Respect & Professionalism")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s1a", "Treat every user with courtesy and respect, regardless of background, identity, or opinion.")}</li>
                <li>{t("community.s1b", "Communicate clearly and professionally in all messages, reviews, and interactions.")}</li>
                <li>{t("community.s1c", "Resolve disagreements through calm dialogue or the Platform's dispute resolution process — never through threats, insults, or intimidation.")}</li>
                <li>{t("community.s1d", "Respect the time and boundaries of other users. Honor scheduled appointments and respond to messages promptly.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">2. {t("community.s2Title", "Honesty & Transparency")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s2a", "Providers must accurately represent their skills, qualifications, experience, and the services they offer.")}</li>
                <li>{t("community.s2b", "Pricing must be clear and honest. Hidden fees or bait-and-switch pricing is strictly prohibited.")}</li>
                <li>{t("community.s2c", "Photos and media in service listings must accurately represent the work you perform — do not use stock photos or others' work as your own.")}</li>
                <li>{t("community.s2d", "Customers must provide accurate descriptions of the work they need, including relevant details about the location, scope, and conditions.")}</li>
                <li>{t("community.s2e", "All users must use their real identity. Impersonating another person or business is prohibited.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">3. {t("community.s3Title", "Fair Reviews & Ratings")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s3a", "Reviews must reflect your genuine experience with the service provided.")}</li>
                <li>{t("community.s3b", "Do not leave fake, retaliatory, or incentivized reviews. Offering payment or discounts in exchange for positive reviews is prohibited.")}</li>
                <li>{t("community.s3c", "Do not pressure or threaten providers/customers to leave or remove reviews.")}</li>
                <li>{t("community.s3d", "Constructive criticism is welcome — personal attacks in reviews are not. Focus on the quality of service, not the individual.")}</li>
                <li>{t("community.s3e", "Providers may respond to reviews professionally. Retaliatory or abusive responses will be removed.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">4. {t("community.s4Title", "Safety & Trust")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s4a", "Never engage in or facilitate illegal activities through the Platform.")}</li>
                <li>{t("community.s4b", "Providers must maintain all necessary licenses, certifications, and insurance required for their services.")}</li>
                <li>{t("community.s4c", "Report any unsafe situations, suspicious behavior, or policy violations immediately through the Platform's support system.")}</li>
                <li>{t("community.s4d", "Do not share personal contact information (phone numbers, addresses, social media) to circumvent the Platform. All communication should occur within ServiHub's messaging system.")}</li>
                <li>{t("community.s4e", "Harassment, stalking, or any form of unwelcome contact — on or off the Platform — based on interactions within ServiHub is strictly prohibited.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">5. {t("community.s5Title", "Quality Standards for Providers")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s5a", "Deliver services that meet or exceed the quality described in your listing.")}</li>
                <li>{t("community.s5b", "Arrive on time and prepared for scheduled appointments. If you cannot make it, notify the customer as early as possible.")}</li>
                <li>{t("community.s5c", "Keep your availability calendar up to date to avoid overbooking or last-minute cancellations.")}</li>
                <li>{t("community.s5d", "Leave the customer's property in the same or better condition than you found it (for on-site services).")}</li>
                <li>{t("community.s5e", "Address customer concerns or complaints promptly and in good faith before escalating to the Platform.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">6. {t("community.s6Title", "Responsibilities for Customers")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s6a", "Provide a safe and accessible environment for providers performing on-site services.")}</li>
                <li>{t("community.s6b", "Be present or reachable during scheduled service times unless otherwise agreed upon.")}</li>
                <li>{t("community.s6c", "Pay for services through the Platform. Attempting to negotiate off-platform payments undermines the trust and safety protections ServiHub provides.")}</li>
                <li>{t("community.s6d", "Respect the provider's expertise and professional judgment. Disagreements on approach should be discussed, not demanded.")}</li>
                <li>{t("community.s6e", "Cancel or reschedule bookings with reasonable notice. Repeated no-shows or late cancellations may result in account restrictions.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">7. {t("community.s7Title", "Prohibited Content")}</h2>
              <p className="text-muted-foreground">{t("community.s7Intro", "The following content is not allowed anywhere on the Platform — including profiles, listings, messages, and reviews:")}</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s7a", "Hate speech, discrimination, or content targeting individuals based on race, ethnicity, gender, sexual orientation, religion, disability, or nationality.")}</li>
                <li>{t("community.s7b", "Sexually explicit, violent, or graphic content.")}</li>
                <li>{t("community.s7c", "Spam, unsolicited advertising, or promotional content for services outside the Platform.")}</li>
                <li>{t("community.s7d", "Misleading or fraudulent content designed to deceive other users.")}</li>
                <li>{t("community.s7e", "Content that infringes on intellectual property rights, copyrights, or trademarks.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">8. {t("community.s8Title", "Anti-Discrimination Policy")}</h2>
              <p className="text-muted-foreground">
                {t("community.s8Body", "ServiHub is committed to an inclusive marketplace. Providers may not refuse service, charge different prices, or provide different quality based on a customer's race, color, religion, gender, sexual orientation, national origin, disability, or age. Customers must extend the same respect to providers. Violations of this policy will result in immediate account review and potential removal.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">9. {t("community.s9Title", "Dispute Resolution Etiquette")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s9a", "Attempt to resolve issues directly with the other party through the Platform's messaging system first.")}</li>
                <li>{t("community.s9b", "Use the price adjustment feature for pricing disagreements rather than leaving negative reviews.")}</li>
                <li>{t("community.s9c", "If direct resolution fails, contact ServiHub support through the suggestion box or chat. Provide clear details and evidence.")}</li>
                <li>{t("community.s9d", "Accept mediation outcomes in good faith. Repeated frivolous disputes may result in account restrictions.")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">10. {t("community.s10Title", "Enforcement & Consequences")}</h2>
              <p className="text-muted-foreground">{t("community.s10Intro", "Violations of these guidelines are handled on a case-by-case basis. Consequences may include:")}</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("community.s10a", "Warning: A formal notice for minor or first-time violations.")}</li>
                <li>{t("community.s10b", "Temporary suspension: Account access restricted for a defined period for repeated or moderate violations.")}</li>
                <li>{t("community.s10c", "Permanent removal: Account terminated for severe violations, including fraud, harassment, discrimination, or repeated policy breaches.")}</li>
                <li>{t("community.s10d", "Content removal: Reviews, listings, or messages that violate these guidelines may be removed without notice.")}</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                {t("community.s10Footer", "ServiHub reserves the right to take action at its sole discretion. All enforcement decisions are final, though users may submit an appeal through the support system.")}
              </p>
            </section>

            <section className="border-t border-border pt-6">
              <p className="text-muted-foreground text-sm">
                {t("community.contact", "If you witness a violation of these guidelines or need to report an issue, please use the Platform's support chat or suggestion box. We review all reports promptly and confidentially.")}
              </p>
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default CommunityGuidelines;
