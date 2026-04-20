import { Outlet, useNavigate, useLocation } from "react-router";
import { toast } from "sonner";
import { useState } from "react";
import {
  DashboardIcon,
  SettingsIcon,
  ProfileIcon,
  TransactionsIcon,
  LogoutIcon,
  HamburgerIcon,
  CloseIcon,
} from "./shared-icons";
import { useTheme, themeColors } from "./theme-context";
import { useUserProfile } from "./user-profile-context";
import logoIcon from "@/assets/newicon.png";
import { Button } from "./button-styles";
import { useIsMobile } from "./ui/use-mobile";
import { mainnet } from "viem/chains";
import { GasFeeStrip } from "./gas-fee-strip";
import { useWagmiSession } from "../hooks/useWagmiSession";
import { logoutFromBackend } from "../services/wagmi-api";
import { DEFAULT_AVATAR_PATH } from "./user-profile-context";

function clearWalletClientState() {
  const storagePrefixes = ["wagmi.", "walletconnect", "@appkit/"];

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (storagePrefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  }
}

async function disconnectWalletIfPossible() {
  const provider = (window as Window & {
    ethereum?: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }).ethereum;

  if (!provider?.request) return;

  try {
    // Remove site from wallet connected permissions when provider supports it.
    await provider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Some wallets do not implement revoke permissions; backend logout still signs out SIWE.
  }
}

function getLandingUrl(): string {
  const configured = (import.meta.env.VITE_LANDING_URL as string | undefined)?.trim();
  // Env-driven default: same-origin root.
  return configured || window.location.origin;
}

async function logoutAndRedirectToLanding() {
  let backendLogoutFailed = false;

  try {
    await logoutFromBackend();
  } catch {
    backendLogoutFailed = true;
  }

  await disconnectWalletIfPossible();
  clearWalletClientState();

  if (backendLogoutFailed) {
    toast.error("Logout request failed, redirecting anyway");
  } else {
    toast.success("Logged out successfully");
  }

  const landingUrl = getLandingUrl();

  try {
    if (window.top && window.top !== window) {
      window.top.location.replace(landingUrl);
    }
  } catch {
    // Ignore top-window navigation failures and always navigate current window.
  }

  window.location.replace(landingUrl);
}

/* Background blobs */

function BackgroundBlobs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute h-[912px] left-[184px] top-[-376px] w-[797px]">
        <div className="absolute inset-[-9.74%_-12.92%_-9.75%_-12.92%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1003 1089.77">
            <g filter="url(#filter0_f_bg1)">
              <circle cx="501.5" cy="501.5" fill="url(#paint0_bg1)" r="301.5" />
            </g>
            <g filter="url(#filter1_f_bg1)">
              <rect fill="url(#paint1_bg1)" height="411.069" width="289.734" x="356.633" y="478.704" />
            </g>
            <defs>
              <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="1003" id="filter0_f_bg1" width="1003" x="0" y="0">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                <feGaussianBlur result="effect1_foregroundBlur" stdDeviation="100" />
              </filter>
              <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="811.07" id="filter1_f_bg1" width="689.734" x="156.633" y="278.704">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                <feGaussianBlur result="effect1_foregroundBlur" stdDeviation="100" />
              </filter>
              <linearGradient gradientUnits="userSpaceOnUse" id="paint0_bg1" x1="501.5" x2="501.5" y1="200" y2="803">
                <stop stopColor="#00C2FF" stopOpacity="0" />
                <stop offset="1" stopColor="#FF29C3" />
              </linearGradient>
              <linearGradient gradientUnits="userSpaceOnUse" id="paint1_bg1" x1="501.5" x2="501.5" y1="478.704" y2="889.773">
                <stop stopColor="#184BFF" stopOpacity="0" />
                <stop offset="1" stopColor="#174AFF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <div className="absolute h-[912px] left-[1147px] top-[-209px] w-[797px]">
        <div className="absolute inset-[-9.74%_-12.92%_-9.75%_-12.92%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1003 1089.77">
            <g filter="url(#filter0_f_bg2)">
              <circle cx="501.5" cy="501.5" fill="url(#paint0_bg2)" r="301.5" />
            </g>
            <g filter="url(#filter1_f_bg2)">
              <rect fill="url(#paint1_bg2)" height="411.069" width="289.734" x="356.633" y="478.704" />
            </g>
            <defs>
              <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="1003" id="filter0_f_bg2" width="1003" x="0" y="0">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                <feGaussianBlur result="effect1_foregroundBlur" stdDeviation="100" />
              </filter>
              <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="811.07" id="filter1_f_bg2" width="689.734" x="156.633" y="278.704">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                <feGaussianBlur result="effect1_foregroundBlur" stdDeviation="100" />
              </filter>
              <linearGradient gradientUnits="userSpaceOnUse" id="paint0_bg2" x1="501.5" x2="501.5" y1="200" y2="803">
                <stop stopColor="#00C2FF" stopOpacity="0" />
                <stop offset="1" stopColor="#FF29C3" />
              </linearGradient>
              <linearGradient gradientUnits="userSpaceOnUse" id="paint1_bg2" x1="501.5" x2="501.5" y1="478.704" y2="889.773">
                <stop stopColor="#184BFF" stopOpacity="0" />
                <stop offset="1" stopColor="#174AFF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

/* Light background blobs */

function LightBackgroundBlobs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
      <BackgroundBlobs />
    </div>
  );
}

/* Nav items config */

const navItems = [
  { path: "/", label: "Dashboard", icon: DashboardIcon },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
  { path: "/profile", label: "Profile", icon: ProfileIcon },
  { path: "/transactions", label: "Transactions", icon: TransactionsIcon },
];

/* Sidebar */

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const tc = themeColors(isDark);
  const { chainId } = useWagmiSession();
  const gasChainId = chainId ?? mainnet.id;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div
      className="flex flex-col w-[280px] shrink-0 h-full min-h-0 pt-[20px] pb-[40px]"
      style={{ background: tc.sidebarBg }}
    >
      {/* Logo area */}
      <div
        className="flex items-center gap-[8px] px-[20px] mb-[40px] cursor-pointer shrink-0"
        onClick={() => navigate("/")}
      >
        <div className="size-[85px] relative shrink-0 overflow-hidden rounded-lg">
          <img alt="Wealth Wards" src={logoIcon} width={85} height={85} className="absolute inset-0 size-full object-contain pointer-events-none" />
        </div>
        <div className="flex flex-col">
          <p className="font-['Montserrat',sans-serif] font-semibold text-[24px]" style={{ color: tc.textPrimary }}>WEALTH WARDS</p>
          <p className="font-['Montserrat',sans-serif] font-semibold text-[14px]" style={{ color: tc.textPrimary }}>YOUR FINANCIAL GUARDIAN</p>
        </div>
      </div>

      {/* Nav + gas (scrolls); Log out pinned to bottom — same as mobile drawer */}
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="flex flex-1 flex-col gap-[8px] overflow-y-auto px-[25px] min-h-0">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <div key={item.path} className="flex flex-col gap-[8px]">
                <button
                  onClick={() => navigate(item.path)}
                  className={`flex gap-[19px] items-center px-[25px] py-[16px] rounded-[16px] cursor-pointer transition-all duration-200 ${active ? "" : ""
                    }`}
                  style={
                    active
                      ? {
                        backgroundImage:
                          "linear-gradient(129.101deg, rgb(31, 142, 190) 5.3557%, rgb(68, 4, 149) 29.462%, rgb(68, 4, 149) 56.025%, rgb(177, 2, 205) 81.92%)",
                      }
                      : { backgroundColor: "transparent" }
                  }
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = tc.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Icon />
                  <p
                    className="font-['Inter',sans-serif] font-medium text-[18px]"
                    style={{ color: active ? "#ffffff" : tc.textMuted }}
                  >
                    {item.label}
                  </p>
                </button>
                {item.path === "/transactions" && (
                  <div className="w-full">
                    <GasFeeStrip chainId={gasChainId} compact />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="shrink-0 px-[25px] pt-[16px] mt-auto"
          style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}
        >
          <button
            className="flex gap-[19px] items-center px-[25px] py-[16px] rounded-[16px] cursor-pointer hover:opacity-80 transition-opacity w-full"
            onClick={async () => {
              await logoutAndRedirectToLanding();
            }}
          >
            <LogoutIcon />
            <p className="font-['Inter',sans-serif] font-medium text-[18px]" style={{ color: tc.textMuted }}>Log Out</p>
          </button>
        </div>
      </div>
    </div>
  );
}

/* Top bar */

function TopBar() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const tc = themeColors(isDark);
  const { profile, isConnected } = useUserProfile();
  const { address: sessionAddress } = useWagmiSession();
  const walletLinked = isConnected || !!sessionAddress;

  return (
    <div className="flex items-center justify-end gap-[16px] px-[20px] py-[16px] shrink-0">
      {!walletLinked && (
        <a
          href="/app/?connect=1"
          target="_top"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <Button size="md">
            Connect Account
          </Button>
        </a>
      )}
      <button
        className="flex items-center gap-[12px] cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => navigate("/profile")}
      >
        <p className="font-['Inter',sans-serif] font-medium text-[18px]" style={{ color: tc.textMuted }}>{profile.displayName}</p>
        <div className="size-[48px] shrink-0 rounded-full overflow-hidden">
          <img alt="" className="size-full object-cover" src={profile.avatarUrl || DEFAULT_AVATAR_PATH} />
        </div>
      </button>
    </div>
  );
}

/* Safe Area Wrapper */

function SafeArea({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-1 flex flex-col min-w-0 overflow-y-auto"
      style={{
        paddingLeft: 'max(0px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0px, env(safe-area-inset-right, 0px))',
        paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {children}
    </div>
  );
}

/* Mobile Header */

function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { isDark } = useTheme();
  const tc = themeColors(isDark);
  const { isConnected } = useUserProfile();
  const { address: sessionAddress } = useWagmiSession();
  const walletLinked = isConnected || !!sessionAddress;

  return (
    <div
      className="flex items-center gap-[12px] px-[16px] py-[12px] shrink-0"
      style={{
        background: tc.sidebarBg,
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
      }}
    >
      <button
        onClick={onMenuClick}
        className="p-[8px] hover:opacity-80 transition-opacity"
      >
        <HamburgerIcon />
      </button>
      <div className="flex-1" />
      {!walletLinked && (
        <a
          href="/app/?connect=1"
          target="_top"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <Button size="sm">Connect Account</Button>
        </a>
      )}
    </div>
  );
}

/* Mobile Sidebar Overlay */

function MobileSidebarOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const tc = themeColors(isDark);
  const { chainId } = useWagmiSession();
  const gasChainId = chainId ?? mainnet.id;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full min-h-0 w-[280px] flex flex-col pt-[20px] pb-[40px] z-50 transition-transform duration-300 ease-in-out backdrop-blur-[24px] ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        style={{
          background: isDark ? 'rgba(11,11,15,0.92)' : 'rgba(255,255,255,0.88)',
          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(40px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Close Button */}
        <div className="flex justify-end px-[16px] mb-[16px]">
          <button
            onClick={onClose}
            className="p-[8px] hover:opacity-80 transition-opacity"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Logo area */}
        <div
          className="flex items-center gap-[8px] px-[20px] mb-[40px] cursor-pointer"
          onClick={() => handleNavClick("/")}
        >
          <div className="size-[60px] relative shrink-0 overflow-hidden rounded-lg">
            <img alt="Wealth Wards" src={logoIcon} width={60} height={60} className="absolute inset-0 size-full object-contain pointer-events-none" />
          </div>
          <div className="flex flex-col">
            <p className="font-['Montserrat',sans-serif] font-semibold text-[16px]" style={{ color: tc.textPrimary }}>WEALTH WARDS</p>
            <p className="font-['Montserrat',sans-serif] font-semibold text-[11px]" style={{ color: tc.textPrimary }}>YOUR FINANCIAL GUARDIAN</p>
          </div>
        </div>

        {/* Nav + gas (scrolls); Log out pinned to bottom */}
        <div className="flex flex-col flex-1 min-h-0 w-full">
          <div className="flex flex-1 flex-col gap-[8px] overflow-y-auto px-[25px] min-h-0">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <div key={item.path} className="flex flex-col gap-[8px]">
                  <button
                    onClick={() => handleNavClick(item.path)}
                    className={`flex gap-[19px] items-center px-[25px] py-[16px] rounded-[16px] cursor-pointer transition-all duration-200`}
                    style={
                      active
                        ? {
                          backgroundImage:
                            "linear-gradient(129.101deg, rgb(31, 142, 190) 5.3557%, rgb(68, 4, 149) 29.462%, rgb(68, 4, 149) 56.025%, rgb(177, 2, 205) 81.92%)",
                        }
                        : { backgroundColor: "transparent" }
                    }
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = tc.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Icon />
                    <p
                      className="font-['Inter',sans-serif] font-medium text-[18px]"
                      style={{ color: active ? "#ffffff" : tc.textMuted }}
                    >
                      {item.label}
                    </p>
                  </button>
                  {item.path === "/transactions" && (
                    <div className="w-full">
                      <GasFeeStrip chainId={gasChainId} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="shrink-0 px-[25px] pt-[16px] mt-auto"
            style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}
          >
            <button
              className="flex gap-[19px] items-center px-[25px] py-[16px] rounded-[16px] cursor-pointer hover:opacity-80 transition-opacity w-full"
              onClick={async () => {
                await logoutAndRedirectToLanding();
              }}
            >
              <LogoutIcon />
              <p className="font-['Inter',sans-serif] font-medium text-[18px]" style={{ color: tc.textMuted }}>Log Out</p>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* Root Layout */

export function RootLayout() {
  const { isDark } = useTheme();
  const tc = themeColors(isDark);
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden transition-colors duration-300" style={{ backgroundColor: tc.pageBg }}>
      {isDark && <BackgroundBlobs />}
      {!isDark && <LightBackgroundBlobs />}
      <div className="relative z-10 flex h-full min-h-screen">
        {/* Desktop Sidebar */}
        {!isMobile && <Sidebar />}

        {/* Content Area */}
        <SafeArea>
          {isMobile ? (
            <>
              <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />
              <div
                className="flex-1 px-[16px] pb-[20px] overflow-y-auto"
                style={{
                  paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
                  paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
                }}
              >
                <Outlet />
              </div>
            </>
          ) : (
            <>
              <TopBar />
              <div className="flex-1 px-[20px] pb-[20px] overflow-auto">
                <Outlet />
              </div>
            </>
          )}
        </SafeArea>

        {/* Mobile Sidebar Overlay */}
        {isMobile && (
          <MobileSidebarOverlay isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        )}
      </div>
    </div>
  );
}