
import { Toaster } from "sonner";
import { router } from "./routes";
import { ThemeProvider, useTheme } from "./components/theme-context";
import { UserProfileProvider } from "./components/user-profile-context";
import { RouterProvider} from "react-router";

function AppInner() {
  const { isDark } = useTheme();
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? "#1c1c1c" : "#ffffff",
            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
            color: isDark ? "white" : "#1a1a2e",
            fontFamily: "Inter, sans-serif",
          },
        }}
      />
    </>
  );
}


export default function App() {
  return (
    <ThemeProvider>
      <UserProfileProvider>
        <AppInner />
      </UserProfileProvider>
    </ThemeProvider>
  );
}