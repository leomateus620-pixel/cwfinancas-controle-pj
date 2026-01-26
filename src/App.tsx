import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import OverviewPage from "@/pages/OverviewPage";
import IncomePage from "@/pages/IncomePage";
import ExpensesPage from "@/pages/ExpensesPage";
import CashFlowPage from "@/pages/CashFlowPage";
import BalanceSheetPage from "@/pages/BalanceSheetPage";
import ForecastsPage from "@/pages/ForecastsPage";
import InvoicesPage from "@/pages/InvoicesPage";
import UploadPage from "@/pages/UploadPage";
import InsightsPage from "@/pages/InsightsPage";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/income" element={<IncomePage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/cash-flow" element={<CashFlowPage />} />
              <Route path="/balance" element={<BalanceSheetPage />} />
              <Route path="/forecasts" element={<ForecastsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
