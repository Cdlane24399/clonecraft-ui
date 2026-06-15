import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
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
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<NewClone />} />
          <Route path="/app/new" element={<NewClone />} />
          <Route path="/app/progress" element={<Progress />} />
          <Route path="/app/results" element={<Results />} />
          <Route path="/app/projects" element={<Projects />} />
          <Route path="/app/benchmarks" element={<Benchmarks />} />
          <Route path="/app/templates" element={<Templates />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
