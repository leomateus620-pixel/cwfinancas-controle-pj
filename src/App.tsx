import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { FinanceIntroAnimation } from "@/components/FinanceIntroAnimation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { GlobalErrorHandler } from "@/components/error/GlobalErrorHandler";
import LandingPage from "@/pages/LandingPage";
import HomePage from "@/pages/HomePage";
import OverviewPage from "@/pages/OverviewPage";
import IncomePage from "@/pages/IncomePage";
import ExpensesPage from "@/pages/ExpensesPage";
import CashFlowPage from "@/pages/CashFlowPage";
import DREPage from "@/pages/DREPage";
import ForecastsPage from "@/pages/ForecastsPage";
import CompanyPage from "@/pages/CompanyPage";
import InvoicesPage from "@/pages/InvoicesPage";
import { UploadPage } from "@/pages/UploadPage";
import InsightsPage from "@/pages/InsightsPage";
import SettingsPage from "@/pages/SettingsPage";
import GoogleSheetsPage from "@/pages/GoogleSheetsPage";
import AccountsPage from "@/pages/AccountsPage";
import CreditCardPage from "@/pages/CreditCardPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import NotFound from "@/pages/NotFound";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfUsePage from "@/pages/TermsOfUsePage";
import StatementConverterPage from "@/pages/StatementConverterPage";
import DemandsListPage from "@/pages/demands/DemandsListPage";
import DemandsPlaceholderPage from "@/pages/demands/DemandsPlaceholderPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => {
  const [showIntro, setShowIntro] = useState(
    () => !sessionStorage.getItem("cwf-intro-seen")
  );

  const handleIntroComplete = useCallback(() => {
    sessionStorage.setItem("cwf-intro-seen", "true");
    setShowIntro(false);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {showIntro && <FinanceIntroAnimation onComplete={handleIntroComplete} />}
          <GlobalErrorHandler />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
                <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
                
                {/* Protected routes */}
                <Route element={
                  <ProtectedRoute>
                    <DateRangeProvider>
                      <DashboardLayout />
                    </DateRangeProvider>
                  </ProtectedRoute>
                }>
                  <Route path="/dashboard" element={<HomePage />} />
                  <Route path="/overview" element={<OverviewPage />} />
                  <Route path="/company" element={<CompanyPage />} />
                  <Route path="/income" element={<IncomePage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/cash-flow" element={<CashFlowPage />} />
                  <Route path="/dre" element={<DREPage />} />
                  <Route path="/forecasts" element={<ForecastsPage />} />
                  <Route path="/invoices" element={<InvoicesPage />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/google-sheets" element={<GoogleSheetsPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/credit-cards" element={<CreditCardPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/statement-converter" element={<StatementConverterPage />} />
                  <Route path="/demands" element={<DemandsListPage />} />
                  <Route path="/demands/dashboard" element={<DemandsPlaceholderPage title="Dashboard de Demandas" description="Indicadores e visão geral das demandas financeiras." />} />
                  <Route path="/demands/new" element={<DemandsPlaceholderPage title="Nova Demanda" description="Crie uma nova solicitação financeira." />} />
                  <Route path="/demands/approvals" element={<DemandsPlaceholderPage title="Aprovações Pendentes" description="Demandas que aguardam sua aprovação." />} />
                  <Route path="/demands/documents" element={<DemandsPlaceholderPage title="Documentos Financeiros" description="Todos os documentos vinculados às demandas." />} />
                  <Route path="/demands/settings" element={<DemandsPlaceholderPage title="Configurações de Fluxo" description="Regras de categorização e parâmetros do módulo." />} />
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
