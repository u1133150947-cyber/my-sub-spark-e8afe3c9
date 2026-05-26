import { lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import { RequireAdmin } from "./components/RequireAdmin";

// Code-split heavy pages — they each pull in big dependency trees (charts, qrcode, etc.).
const DashboardPage = lazy(() => import("./modules/dashboard/DashboardPage"));
const SubsListPage = lazy(() => import("./modules/subs/SubsListPage"));
const SubsCreatePage = lazy(() => import("./modules/subs/SubsCreatePage"));
const PanelsListPage = lazy(() => import("./modules/panels/PanelsListPage"));
const UpdatePage = lazy(() => import("./modules/panels/UpdatePage"));
const ServerLogsPage = lazy(() => import("./modules/serverLogs/ServerLogsPage"));
const HelpPage = lazy(() => import("./modules/help/HelpPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAdmin><Index /></RequireAdmin>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="subs" element={<SubsListPage />} />
            <Route path="subs/create" element={<SubsCreatePage />} />
            <Route path="panels" element={<PanelsListPage />} />
            <Route path="update" element={<UpdatePage />} />
            <Route path="logs" element={<ServerLogsPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
