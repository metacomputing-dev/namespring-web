import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import PaymentFailPage from "./pages/PaymentFailPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import SupportPage from "./pages/SupportPage";

const SpringApp = lazy(() => import("./v3/app"));

export default function AppRouter() {
  const basename = import.meta.env.BASE_URL || "/";

  return (
    <BrowserRouter basename={basename}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/fail" element={<PaymentFailPage />} />
          <Route path="*" element={<SpringApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
