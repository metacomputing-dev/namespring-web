import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App.jsx";
import PaymentFailPage from "./pages/PaymentFailPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import SupportPage from "./pages/SupportPage";

export default function AppRouter() {
  const basename = import.meta.env.BASE_URL || "/";

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/support" element={<SupportPage />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/fail" element={<PaymentFailPage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}
