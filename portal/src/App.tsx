import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, GuestRoute, RoleRoute } from "./components/ProtectedRoute";
import { PortalLayout } from "./components/PortalLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PaymentPage } from "./pages/PaymentPage";
import { PimsleurTestPage } from "./pages/PimsleurTestPage";
import { PimsleurResultPage } from "./pages/PimsleurResultPage";
import { CfitResultPage } from "./pages/CfitResultPage";
import { CfitTestPage } from "./pages/CfitTestPage";
import { PapikostikTestPage } from "./pages/PapikostikTestPage";
import { PapikostikResultPage } from "./pages/PapikostikResultPage";
import { CertificatePage } from "./pages/CertificatePage";
import { AdminPimsleurPage } from "./pages/AdminPimsleurPage";
import { AdminPimsleurDetailPage } from "./pages/AdminPimsleurDetailPage";
import { AdminCfitPage } from "./pages/AdminCfitPage";
import { AdminCfitDetailPage } from "./pages/AdminCfitDetailPage";
import { AdminPapikostikPage } from "./pages/AdminPapikostikPage";
import { AdminPapikostikDetailPage } from "./pages/AdminPapikostikDetailPage";
import { AdminRecapPage } from "./pages/AdminRecapPage";
import { AdminFinalReviewPage } from "./pages/AdminFinalReviewPage";
import { AdminPaymentsPage } from "./pages/AdminPaymentsPage";
import { AdminTestProgressPage } from "./pages/AdminTestProgressPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<PortalLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route element={<RoleRoute allowedRoles={["participant"]} />}>
                <Route path="/payment" element={<PaymentPage />} />
                <Route path="/test/pimsleur" element={<PimsleurTestPage />} />
                <Route path="/test/cfit" element={<CfitTestPage />} />
                <Route path="/test/papikostik" element={<PapikostikTestPage />} />
                <Route path="/result/pimsleur" element={<PimsleurResultPage />} />
                <Route path="/result/cfit" element={<CfitResultPage />} />
                <Route path="/result/papikostik" element={<PapikostikResultPage />} />
                <Route path="/result/certificate" element={<CertificatePage />} />
                <Route path="/certificate" element={<CertificatePage />} />
                {/* Legacy routes now point to the gated final review flow. */}
                <Route path="/test/language" element={<Navigate to="/test/pimsleur" replace />} />
                <Route path="/test/character" element={<Navigate to="/test/papikostik" replace />} />
                <Route path="/result" element={<Navigate to="/result/pimsleur" replace />} />
                <Route path="/result/legacy" element={<Navigate to="/result/certificate" replace />} />
              </Route>
              <Route element={<RoleRoute allowedRoles={["admin"]} />}>
                <Route path="/admin/pimsleur" element={<AdminPimsleurPage />} />
                <Route path="/admin/pimsleur/:userId" element={<AdminPimsleurDetailPage />} />
                <Route path="/admin/cfit" element={<AdminCfitPage />} />
                <Route path="/admin/cfit/:userId" element={<AdminCfitDetailPage />} />
                <Route path="/admin/papikostik" element={<AdminPapikostikPage />} />
                <Route path="/admin/papikostik/:userId" element={<AdminPapikostikDetailPage />} />
                <Route path="/admin/recap" element={<AdminRecapPage />} />
                <Route path="/admin/payments" element={<AdminPaymentsPage />} />
                <Route path="/admin/test-progress" element={<AdminTestProgressPage />} />
                <Route path="/admin/review/:userId" element={<AdminFinalReviewPage />} />
              </Route>
              <Route element={<RoleRoute allowedRoles={["psychologist"]} />}>
                <Route path="/psychologist" element={<DashboardPage />} />
                <Route path="/psychologist/pimsleur" element={<AdminPimsleurPage />} />
                <Route path="/psychologist/pimsleur/:userId" element={<AdminPimsleurDetailPage />} />
                <Route path="/psychologist/cfit" element={<AdminCfitPage />} />
                <Route path="/psychologist/cfit/:userId" element={<AdminCfitDetailPage />} />
                <Route path="/psychologist/papikostik" element={<AdminPapikostikPage />} />
                <Route path="/psychologist/papikostik/:userId" element={<AdminPapikostikDetailPage />} />
                <Route path="/psychologist/recap" element={<AdminRecapPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
