import React from "react";
import { createBrowserRouter, useRouteError, isRouteErrorResponse, redirect } from "react-router";
import { RootLayout } from "./components/layout";
import { getWalletSession } from "./services/wagmi-api";

// Force basename for production deployment under /dashboard.
// This prevents "No routes matched location '/dashboard/'" when static hosting rewrites to /dashboard/index.html.
const base = "/dashboard";

function getLandingRedirectUrl(): string {
  const configured = (import.meta.env.VITE_LANDING_URL as string | undefined)?.trim();
  // Env-driven default: if not configured, keep user on same origin root.
  return configured || window.location.origin;
}

/** Route guard: redirect to landing if user is not logged in (no valid SIWE session). */
async function requireAuthLoader() {
  // console.log("[Dashboard] requireAuthLoader checking session...");
  try {
    const session = await getWalletSession();
    // console.log("[Dashboard] Session response:", session);
    if (!session?.ok || !session?.address) {
      console.warn("[Dashboard] Not authenticated, redirecting to landing...");
      return redirect(getLandingRedirectUrl());
    }
    return null;
  } catch (err) {
    console.error("[Dashboard] requireAuthLoader error:", err);
    return redirect(getLandingRedirectUrl());
  }
}

function RouteError() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const message = isRouteErrorResponse(error) ? error.statusText : (error as Error)?.message;
  const homeHref = base ? base + "/" : "/";
  return React.createElement(
    "div",
    { style: { padding: "2rem", textAlign: "center", fontFamily: "sans-serif" } },
    React.createElement("h1", null, is404 ? "Page not found" : "Something went wrong"),
    React.createElement("p", null, message),
    React.createElement("a", { href: homeHref }, "Go to dashboard")
  );
}

function HydrateFallback() {
  return React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#020817", color: "white" } }, "Loading Dashboard...");
}

const DashboardPage = React.lazy(() => import("./components/dashboard-page").then((m) => ({ default: m.DashboardPage })));
const SettingsPage = React.lazy(() => import("./components/settings-page").then((m) => ({ default: m.SettingsPage })));
const ProfilePage = React.lazy(() => import("./components/profile-page").then((m) => ({ default: m.ProfilePage })));
const TransactionsPage = React.lazy(() => import("./components/transactions-page").then((m) => ({ default: m.TransactionsPage })));

const withSuspense = (component: React.ReactNode) =>
  React.createElement(
    React.Suspense,
    {
      fallback: React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            color: "white",
          },
        },
        "Loading page..."
      ),
    },
    component
  );

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: RootLayout,
      loader: requireAuthLoader,
      HydrateFallback,
      errorElement: React.createElement(RouteError),
      children: [
        { index: true, element: withSuspense(React.createElement(DashboardPage)) },
        { path: "settings", element: withSuspense(React.createElement(SettingsPage)) },
        { path: "profile", element: withSuspense(React.createElement(ProfilePage)) },
        { path: "transactions", element: withSuspense(React.createElement(TransactionsPage)) },
      ],
    },
  ],
  { basename: base }
);
