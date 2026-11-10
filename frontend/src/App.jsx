import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import PageTransition from "./components/PageTransition.jsx";
import { AppSettingsProvider } from "./components/AppSettings.jsx";
import TankMap from "./pages/TankMap.jsx";
import TankDetails from "./pages/TankDetails.jsx";
import RegisterOrganization from "./pages/RegisterOrganization.jsx";
import Organizations from "./pages/Organizations.jsx";
import SeasonPlans from "./pages/SeasonPlans.jsx";
import Messages from "./pages/Messages.jsx";
import DataHealth from "./pages/DataHealth.jsx";
import NotFound from "./pages/NotFound.jsx";

function page(element) {
  return <PageTransition>{element}</PageTransition>;
}

export default function App() {
  const location = useLocation();
  const transitionKey = location.pathname.split("/").slice(0, 2).join("/");

  return (
    <AppSettingsProvider>
      <Layout>
        <AnimatePresence mode="wait">
          <Routes location={location} key={transitionKey}>
            <Route path="/" element={page(<TankMap />)} />
            <Route path="/tanks/:tankId" element={page(<TankDetails />)} />
            <Route path="/organizations" element={page(<Organizations />)} />
            <Route path="/organizations/new" element={page(<RegisterOrganization />)} />
            <Route path="/organizations/:organizationId/edit" element={page(<RegisterOrganization />)} />
            <Route path="/plans" element={page(<SeasonPlans />)} />
            <Route path="/messages" element={page(<Messages />)} />
            <Route path="/data-health" element={page(<DataHealth />)} />
            <Route path="*" element={page(<NotFound />)} />
          </Routes>
        </AnimatePresence>
      </Layout>
      <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: "12px", fontSize: "14px" } }} />
    </AppSettingsProvider>
  );
}
