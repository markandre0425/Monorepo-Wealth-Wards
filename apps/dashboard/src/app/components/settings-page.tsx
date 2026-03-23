import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTheme, themeColors } from "./theme-context";
import { Button, PrimaryButton } from "./button-styles";
import { useUserProfile } from "./user-profile-context";

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
  const { profile, updateProfile, isConnected } = useUserProfile();
  
  const [currency, setCurrency] = useState("USD");
  const [language, setLanguage] = useState("English");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile.settings) {
      setCurrency(profile.settings.currency || "USD");
      setLanguage(profile.settings.language || "English");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet to save settings.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        settings: {
          currency,
          language,
        }
      });
      toast.success("Settings saved successfully!");
    } catch (err) {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
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

        {/* Save button */}
        <PrimaryButton onClick={handleSave} size="lg" className="self-start" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </PrimaryButton>
      </div>
    </div>
  );
}
