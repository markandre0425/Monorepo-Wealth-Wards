import React from "react";
import { createBrowserRouter, useRouteError, isRouteErrorResponse, redirect } from "react-router";
import { RootLayout } from "./components/layout";
import { DashboardPage } from "./components/dashboard-page";
import { SettingsPage } from "./components/settings-page";
import { ProfilePage } from "./components/profile-page";
import { TransactionsPage } from "./components/transactions-page";
import { getWalletSession } from "./services/wagmi-api";

// When served under /dashboard/ (dev proxy or prod), router needs basename so path "/dashboard/" matches route "/"
const base = (typeof import.meta.env?.BASE_URL === "string" && import.meta.env.BASE_URL !== "/" && import.meta.env.BASE_URL !== "./")
  ? import.meta.env.BASE_URL
  : undefined;

function getLandingRedirectUrl(): string {
  const url = (import.meta.env.VITE_LANDING_URL as string | undefined)?.trim();
  return url || "http://localhost:3000";
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

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: RootLayout,
      loader: requireAuthLoader,
      HydrateFallback,
      errorElement: React.createElement(RouteError),
      children: [
        { index: true, Component: DashboardPage },
        { path: "settings", Component: SettingsPage },
        { path: "profile", Component: ProfilePage },
        { path: "transactions", Component: TransactionsPage },
      ],
    },
  ],
  { basename: base }
);
