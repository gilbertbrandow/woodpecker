import { RouterProvider } from "@tanstack/react-router";
import { useAuth } from "./context/auth";
import { router } from "./router";
import { useVersionCheck } from "./lib/useVersionCheck";

export function App() {
  const auth = useAuth();
  useVersionCheck();
  return <RouterProvider router={router} context={{ auth }} />;
}
