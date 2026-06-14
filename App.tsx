import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Services from "./pages/Services";
import Dashboard from "./pages/Dashboard";
import ProviderProfile from "./pages/ProviderProfile";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import PayPalReturn from "./pages/PayPalReturn";
import BookingPaymentReturn from "./pages/BookingPaymentReturn";
import SuggestionsHistory from "./pages/SuggestionsHistory";
import AdminSuggestions from "./pages/AdminSuggestions";
import AdminQuoteAuditLog from "./pages/AdminQuoteAuditLog";
import ServiceRequests from "./pages/ServiceRequests";
import MyRequests from "./pages/MyRequests";
import RequestQuote from "./pages/RequestQuote";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CommunityGuidelines from "./pages/CommunityGuidelines";
import ChatSupport from "@/components/ChatSupport";
import BottomNav from "@/components/BottomNav";
import InstallBanner from "@/components/InstallBanner";
import SuggestionBox from "@/components/SuggestionBox";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <div className="pb-14 md:pb-0">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/services" element={<Services />} />
                <Route path="/provider/:providerId" element={<ProviderProfile />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/paypal-return" element={<ProtectedRoute><PayPalReturn /></ProtectedRoute>} />
                <Route path="/booking-payment-return" element={<ProtectedRoute><BookingPaymentReturn /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/service-requests" element={<ProtectedRoute><ServiceRequests /></ProtectedRoute>} />
                <Route path="/my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
                <Route path="/quote/:serviceId" element={<ProtectedRoute><RequestQuote /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/suggestions" element={<ProtectedRoute><SuggestionsHistory /></ProtectedRoute>} />
                <Route path="/admin/suggestions" element={<ProtectedRoute><AdminSuggestions /></ProtectedRoute>} />
                <Route path="/admin/quote-audit-log" element={<ProtectedRoute><AdminQuoteAuditLog /></ProtectedRoute>} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <BottomNav />
            <InstallBanner />
            <SuggestionBox />
            <ChatSupport />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
