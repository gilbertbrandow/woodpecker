import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import * as Sentry from "@sentry/react";
import { registerNavigate } from "./lib/navigation";
import { ThemeProvider } from "./context/theme";
import { AuthProvider, useAuth } from "./context/auth";
import { TooltipProvider } from "./components/ui/tooltip";
import { router } from "./router";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});

registerNavigate((opts) => router.navigate(opts));

function InnerApp() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <Sentry.ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <InnerApp />
          </AuthProvider>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                fontSize: "0.95rem",
                padding: "14px 18px",
                boxShadow: "var(--toast-shadow)",
              },
            }}
          />
        </TooltipProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
