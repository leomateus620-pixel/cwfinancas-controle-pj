import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { FinanceIntroAnimation } from "@/components/FinanceIntroAnimation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { GlobalErrorHandler } from "@/components/error/GlobalErrorHandler";
import HomePage from "@/pages/HomePage";
import OverviewPage from "@/pages/OverviewPage";
import IncomePage from "@/pages/IncomePage";
import ExpensesPage from "@/pages/ExpensesPage";
import CashFlowPage from "@/pages/CashFlowPage";
import DREPage from "@/pages/DREPage";
import ForecastsPage from "@/pages/ForecastsPage";
import InvoicesPage from "@/pages/InvoicesPage";
import { UploadPage } from "@/pages/UploadPage";
import InsightsPage from "@/pages/InsightsPage";
import SettingsPage from "@/pages/SettingsPage";
import GoogleSheetsPage from "@/pages/GoogleSheetsPage";
import AccountsPage from "@/pages/AccountsPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import NotFound from "@/pages/NotFound";

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

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GlobalErrorHandler />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              
              {/* Protected routes */}
              <Route element={
                <ProtectedRoute>
                  <DateRangeProvider>
                    <DashboardLayout />
                  </DateRangeProvider>
                </ProtectedRoute>
              }>
                <Route path="/" element={<HomePage />} />
                <Route path="/overview" element={<OverviewPage />} />
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
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
