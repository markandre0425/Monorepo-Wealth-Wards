import { useState } from "react";
import { toast } from "sonner";
import { useTheme, themeColors } from "./theme-context";
import { Button, PrimaryButton } from "./button-styles";

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
      style={{ backgroundColor: enabled ? "rgba(0,170,255,0.7)" : "#353535" }}
    >
      <div
        className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-transform duration-200 ${
          enabled ? "translate-x-[23px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export function SettingsPage() {
  const { isDark, toggleTheme } = useTheme();
  const tc = themeColors(isDark);
  const [notifications, setNotifications] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [autoLock, setAutoLock] = useState(true);
  const [currency, setCurrency] = useState("USD");
  const [language, setLanguage] = useState("English");
  const [slippage, setSlippage] = useState("0.5");

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <div className="flex gap-[20px] flex-1">
      <div className="flex-1 flex flex-col gap-[20px] max-w-[900px]">
        {/* General Settings */}
        <div
          className="backdrop-blur-[10px] rounded-[16px] p-[24px] transition-colors duration-300"
          style={{ backgroundColor: tc.cardBg, border: `1px solid ${tc.cardBorder}` }}
        >
          <h2 className="font-['Inter',sans-serif] font-bold text-[24px] mb-[24px]" style={{ color: tc.textPrimary }}>General Settings</h2>
          <div className="flex flex-col gap-[20px]">
            {/* Currency */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-['Inter',sans-serif] font-medium text-[16px]" style={{ color: tc.textPrimary }}>Default Currency</p>
                <p className="font-['Inter',sans-serif] font-normal text-[14px]" style={{ color: tc.textSecondary }}>Set your preferred display currency</p>
              </div>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  toast(`Currency changed to ${e.target.value}`);
                }}
                className="rounded-[12px] px-[16px] py-[8px] font-['Inter',sans-serif] text-[14px] outline-none cursor-pointer transition-colors duration-300"
                style={{ backgroundColor: tc.selectBg, color: tc.textPrimary }}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (&euro;)</option>
                <option value="GBP">GBP (&pound;)</option>
                <option value="JPY">JPY (&yen;)</option>
              </select>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-['Inter',sans-serif] font-medium text-[16px]" style={{ color: tc.textPrimary }}>Language</p>
                <p className="font-['Inter',sans-serif] font-normal text-[14px]" style={{ color: tc.textSecondary }}>Choose your preferred language</p>
              </div>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  toast(`Language changed to ${e.target.value}`);
                }}
                className="rounded-[12px] px-[16px] py-[8px] font-['Inter',sans-serif] text-[14px] outline-none cursor-pointer transition-colors duration-300"
                style={{ backgroundColor: tc.selectBg, color: tc.textPrimary }}
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
              </select>
            </div>

            {/* Dark Mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-['Inter',sans-serif] font-medium text-[16px]" style={{ color: tc.textPrimary }}>Dark Mode</p>
                <p className="font-['Inter',sans-serif] font-normal text-[14px]" style={{ color: tc.textSecondary }}>Toggle dark/light theme</p>
              </div>
              <ToggleSwitch
                enabled={isDark}
                onToggle={() => {
                  toggleTheme();
                  toast(`${isDark ? "Light" : "Dark"} mode enabled`);
                }}
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div
          className="backdrop-blur-[10px] rounded-[16px] p-[24px] transition-colors duration-300"
          style={{ backgroundColor: tc.cardBg, border: `1px solid ${tc.cardBorder}` }}
        >
          <h2 className="font-['Inter',sans-serif] font-bold text-[24px] mb-[24px]" style={{ color: tc.textPrimary }}>Security</h2>
          <div className="flex flex-col gap-[20px]">
            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-['Inter',sans-serif] font-medium text-[16px]" style={{ color: tc.textPrimary }}>Push Notifications</p>
                <p className="font-['Inter',sans-serif] font-normal text-[14px]" style={{ color: tc.textSecondary }}>Get alerts for transactions and price changes</p>
              </div>
              <ToggleSwitch
                enabled={notifications}
                onToggle={() => {
                  setNotifications(!notifications);
                  toast(`Notifications ${!notifications ? "enabled" : "disabled"}`);
                }}
              />
            </div>

            {/* 2FA */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-['Inter',sans-serif] font-medium text-[16px]" style={{ color: tc.textPrimary }}>Two-Factor Authentication</p>
                <p className="font-['Inter',sans-serif] font-normal text-[14px]" style={{ color: tc.textSecondary }}>Add an extra layer of security</p>
              </div>
              <ToggleSwitch
                enabled={twoFA}
                onToggle={() => {
                  setTwoFA(!twoFA);
                  toast(`2FA ${!twoFA ? "enabled" : "disabled"}`);
                }}
              />
            </div>

            {/* Auto Lock */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-['Inter',sans-serif] font-medium text-[16px]" style={{ color: tc.textPrimary }}>Auto-Lock Wallet</p>
                <p className="font-['Inter',sans-serif] font-normal text-[14px]" style={{ color: tc.textSecondary }}>Lock wallet after 5 minutes of inactivity</p>
              </div>
              <ToggleSwitch
                enabled={autoLock}
                onToggle={() => {
                  setAutoLock(!autoLock);
                  toast(`Auto-lock ${!autoLock ? "enabled" : "disabled"}`);
                }}
              />
            </div>
          </div>
        </div>

        {/* Network Settings */}
        <div
          className="backdrop-blur-[10px] rounded-[16px] p-[24px] transition-colors duration-300"
          style={{ backgroundColor: tc.cardBg, border: `1px solid ${tc.cardBorder}` }}
        >
          <h2 className="font-['Inter',sans-serif] font-bold text-[24px] mb-[24px]" style={{ color: tc.textPrimary }}>Network & Trading</h2>
          <div className="flex flex-col gap-[20px]">
            {/* Slippage */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-['Inter',sans-serif] font-medium text-[16px]" style={{ color: tc.textPrimary }}>Slippage Tolerance</p>
                <p className="font-['Inter',sans-serif] font-normal text-[14px]" style={{ color: tc.textSecondary }}>Maximum price change during swap</p>
              </div>
              <div className="flex items-center gap-[8px]">
                {["0.1", "0.5", "1.0"].map((val) => (
                  <Button
                    key={val}
                    onClick={() => {
                      setSlippage(val);
                      toast(`Slippage set to ${val}%`);
                    }}
                    size="sm"
                    variant={slippage === val ? "gradient-primary" : "primary"}
                  >
                    {val}%
                  </Button>
                ))}
              </div>
            </div>

            {/* Default Network */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-['Inter',sans-serif] font-medium text-[16px]" style={{ color: tc.textPrimary }}>Default Network</p>
                <p className="font-['Inter',sans-serif] font-normal text-[14px]" style={{ color: tc.textSecondary }}>Preferred blockchain network</p>
              </div>
              <select
                className="rounded-[12px] px-[16px] py-[8px] font-['Inter',sans-serif] text-[14px] outline-none cursor-pointer transition-colors duration-300"
                style={{ backgroundColor: tc.selectBg, color: tc.textPrimary }}
              >
                <option>Ethereum Mainnet</option>
                <option>Polygon</option>
                <option>Arbitrum</option>
                <option>Optimism</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save button */}
        <PrimaryButton onClick={handleSave} size="lg" className="self-start">
          Save Settings
        </PrimaryButton>
      </div>
    </div>
  );
}
