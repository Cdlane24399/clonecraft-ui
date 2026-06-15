import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireAuth } from "@/components/RequireAuth";
import Landing from "./pages/Landing";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import NewClone from "./pages/NewClone";
import Progress from "./pages/Progress";
import Results from "./pages/Results";
import Projects from "./pages/Projects";
import Benchmarks from "./pages/Benchmarks";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />

          {/* Authenticated */}
          <Route
            path="/app/*"
            element={
              <RequireAuth>
                <Routes>
                  <Route index element={<NewClone />} />
                  <Route path="new" element={<NewClone />} />
                  <Route path="progress" element={<Progress />} />
                  <Route path="results" element={<Results />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="benchmarks" element={<Benchmarks />} />
                  <Route path="templates" element={<Templates />} />
                  <Route path="settings" element={<Settings />} />
                </Routes>
              </RequireAuth>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
