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
  ? import.meta.env.BASE_URL.replace(/\/$/, "")
  : undefined;

function getLandingRedirectUrl(): string {
  const url = (import.meta.env.VITE_LANDING_URL as string | undefined)?.trim();
  return url || "http://localhost:3000";
}

/** Route guard: redirect to landing if user is not logged in (no valid SIWE session). */
async function requireAuthLoader() {
  try {
    const session = await getWalletSession();
    if (!session?.ok || !session?.address) {
      return redirect(getLandingRedirectUrl());
    }
    return null;
  } catch {
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

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: RootLayout,
      loader: requireAuthLoader,
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
