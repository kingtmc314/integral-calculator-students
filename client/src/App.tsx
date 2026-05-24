import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LangProvider } from "./contexts/LangContext";
import Home from "./pages/Home";

// useHashLocation makes routing work on GitHub Pages (no server-side rewrites needed).
// On Vercel, hash routing also works fine — the URL will be /#/ instead of /
// but all functionality is identical.
function AppRouter() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LangProvider>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </LangProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
