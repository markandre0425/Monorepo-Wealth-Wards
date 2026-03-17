import { useState, useEffect } from "react";
import { toast } from "sonner";
import { EthLogo, ChevronDownIcon } from "./shared-icons";
import { PrimaryButton, SecondaryButton } from "./button-styles";
import { useUserProfile, DEFAULT_PROFILE, BASE } from "./user-profile-context";
import { useWagmiSession } from "../hooks/useWagmiSession";

// Avatar options from public/avatar (base-relative for /dashboard/)
const DEFAULT_AVATARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `${BASE}avatar/avatar${n}.jpg`);

export function ProfilePage() {
  const { profile, isConnected, updateProfile, fetchProfile } = useUserProfile();
  const { address } = useWagmiSession();
  const walletConnected = isConnected || !!address;

  const [displayName, setDisplayName] = useState("Default");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState(DEFAULT_PROFILE.bio);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(DEFAULT_PROFILE.avatarUrl);
  const [editing, setEditing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "Default");
      setEmail(profile.email || "");
      setBio(
        profile.bio || DEFAULT_PROFILE.bio
      );
      setAvatarUrl(profile.avatarUrl || DEFAULT_PROFILE.avatarUrl);
    }
  }, [profile]);

  const wallets = [
    { network: "Ethereum", address: "0x7a3F...9c2E", balance: "12.45 ETH", usd: "$ 35,467.94" },
    { network: "Bitcoin", address: "bc1q8...k3mf", balance: "0.892 BTC", usd: "$ 56,639.57" },
    { network: "Polygon", address: "0x4b2D...7f1A", balance: "8,420 MATIC", usd: "$ 5,894.00" },
  ];

  const recentActivity = [
    { action: "Received", amount: "2.5 ETH", from: "0x9d2F...4a1B", time: "2 hours ago", type: "in" as const },
    { action: "Sent", amount: "0.1 BTC", from: "bc1q3...m8nf", time: "5 hours ago", type: "out" as const },
    { action: "Swapped", amount: "1.2 ETH → 3,200 USDC", from: "Uniswap V2", time: "1 day ago", type: "swap" as const },
    { action: "Received", amount: "500 CSCS", from: "Staking Rewards", time: "2 days ago", type: "in" as const },
  ];

  const handleSave = async () => {
    try {
      await updateProfile({
        displayName,
        email,
        bio,
        avatarUrl,
      });
      setEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error("Failed to save profile");
    }
  };

  const handleAvatarSelect = (url: string) => {
    setAvatarUrl(url);
    setShowAvatarPicker(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAvatarUrl(dataUrl);
        toast.success("Avatar preview updated (saved on profile save)");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex gap-[20px] flex-1">
      {/* Avatar Picker Backdrop and Modal (At top level to avoid clipping) */}
      {walletConnected && editing && showAvatarPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowAvatarPicker(false)}
          />
          <div className="fixed bg-[#2b2b2b] rounded-[12px] p-[16px] z-50 border border-[rgba(255,255,255,0.1)] w-[340px] shadow-2xl"
            style={{
              top: '200px',
              left: '60px',
            }}>
            <p className="text-white font-medium mb-[12px] text-sm">Select Avatar</p>

            {/* Default Avatars Grid */}
            <div className="grid grid-cols-3 gap-[8px] mb-[12px]">
              {DEFAULT_AVATARS.map((url) => (
                <button
                  key={url}
                  onClick={() => handleAvatarSelect(url)}
                  className={`size-[60px] rounded-[8px] overflow-visible border-2 transition-all flex-shrink-0 ${
                    avatarUrl === url
                      ? "border-[#00aaff] shadow-[0_0_12px_rgba(0,170,255,0.6)]"
                      : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]"
                  }`}
                >
                  <img src={url} alt="avatar" className="size-full object-cover rounded-[6px]" />
                </button>
              ))}
            </div>

            {/* Upload Custom */}
            <div className="border-t border-[rgba(255,255,255,0.1)] pt-[12px]">
              <label className="flex items-center gap-[8px] px-[10px] py-[8px] rounded-[6px] bg-[rgba(0,170,255,0.1)] cursor-pointer hover:bg-[rgba(0,170,255,0.2)] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="text-[#00aaff] text-sm font-medium">
                  {uploading ? "Uploading..." : "Upload Photo"}
                </span>
              </label>
            </div>
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col gap-[20px] max-w-[900px]">
        {/* Profile Card */}
        <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[24px]">
          <div className="flex items-start gap-[24px]">
            <div
              className="relative size-[96px] shrink-0 rounded-full overflow-hidden border-2 border-[rgba(0,170,255,0.5)] cursor-pointer group"
              onClick={() => walletConnected && editing && setShowAvatarPicker(!showAvatarPicker)}
            >
              <img
                alt=""
                className="size-full object-cover"
                src={avatarUrl || DEFAULT_PROFILE.avatarUrl || `${BASE}avatar/avatar1.jpg`}
              />
              {walletConnected && editing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm font-medium">Change</p>
                </div>
              )}
              {!walletConnected && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#888" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-[16px]">
                <div>
                  {walletConnected && editing ? (
                    <input
                      className="bg-[#2b2b2b] rounded-[8px] px-[12px] py-[6px] font-['Inter',sans-serif] font-bold text-[24px] text-white outline-none w-full"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  ) : (
                    <p className="font-['Inter',sans-serif] font-bold text-[24px] text-white">{displayName}</p>
                  )}
                  {walletConnected && editing ? (
                    <input
                      className="bg-[#2b2b2b] rounded-[8px] px-[12px] py-[4px] font-['Inter',sans-serif] text-[14px] text-[#86909c] outline-none mt-[4px] w-full"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  ) : (
                    <p className="font-['Inter',sans-serif] font-normal text-[14px] text-[#86909c] mt-[4px]">{email || (!walletConnected ? "Connect wallet to edit" : "")}</p>
                  )}
                </div>
                {walletConnected ? (
                  editing ? (
                    <div className="flex gap-[8px]">
                      <SecondaryButton onClick={() => setEditing(false)}>
                        Cancel
                      </SecondaryButton>
                      <PrimaryButton onClick={handleSave}>
                        Save
                      </PrimaryButton>
                    </div>
                  ) : (
                    <PrimaryButton onClick={() => setEditing(true)}>
                      Edit Profile
                    </PrimaryButton>
                  )
                ) : (
                  <a
                    href="/app/?connect=1"
                    target="_top"
                    className="bg-[#0FC6C2]/20 rounded-[12px] h-[36px] flex items-center justify-center px-[16px] cursor-pointer hover:bg-[#0FC6C2]/30 transition-colors"
                  >
                    <p className="font-['Poppins',sans-serif] font-semibold text-[14px] text-[#0FC6C2]">Connect to Edit</p>
                  </a>
                )}
              </div>
              {walletConnected && editing ? (
                <textarea
                  className="bg-[#2b2b2b] rounded-[8px] px-[12px] py-[8px] font-['Inter',sans-serif] text-[14px] text-white/80 outline-none w-full resize-none"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              ) : (
                <p className="font-['Inter',sans-serif] font-normal text-[14px] text-white/80">{bio}</p>
              )}
              <div className="flex gap-[24px] mt-[16px]">
                <div>
                  <p className="font-['Inter',sans-serif] font-bold text-[20px] text-white">$ 97,901.51</p>
                  <p className="font-['Inter',sans-serif] font-normal text-[12px] text-[#86909c]">Total Portfolio</p>
                </div>
                <div>
                  <p className="font-['Inter',sans-serif] font-bold text-[20px] text-[#00ffa3]">+12.3%</p>
                  <p className="font-['Inter',sans-serif] font-normal text-[12px] text-[#86909c]">30d Change</p>
                </div>
                <div>
                  <p className="font-['Inter',sans-serif] font-bold text-[20px] text-white">47</p>
                  <p className="font-['Inter',sans-serif] font-normal text-[12px] text-[#86909c]">Transactions</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connected Wallets */}
        <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[24px]">
          <div className="flex items-center justify-between mb-[20px]">
            <h2 className="font-['Inter',sans-serif] font-bold text-[24px] text-white">Connected Wallets</h2>
            <PrimaryButton onClick={() => toast("Connect a new wallet...")}>
              + Add Wallet
            </PrimaryButton>
          </div>
          <div className="flex flex-col gap-[12px]">
            {wallets.map((wallet, i) => (
              <div key={i} className="flex items-center justify-between bg-[#2b2b2b]/50 rounded-[12px] px-[16px] py-[12px]">
                <div className="flex items-center gap-[12px]">
                  <div className="flex items-center gap-[4px] bg-[rgba(0,0,0,0.4)] rounded-[25px] pl-[5px] pr-[10px] py-[5px]">
                    <div className="flex items-start p-[5px] rounded-[25px] shrink-0" style={{ backgroundImage: "linear-gradient(144.638deg, rgb(255, 255, 255) 6.1321%, rgba(217, 217, 217, 0.71) 99.078%)" }}>
                      <EthLogo size={12} />
                    </div>
                    <p className="font-['Inter',sans-serif] font-medium text-[12px] text-white">{wallet.network}</p>
                    <ChevronDownIcon />
                  </div>
                  <p className="font-['Inter',sans-serif] font-normal text-[14px] text-white/60">{wallet.address}</p>
                </div>
                <div className="text-right">
                  <p className="font-['Inter',sans-serif] font-semibold text-[16px] text-white">{wallet.balance}</p>
                  <p className="font-['Inter',sans-serif] font-normal text-[12px] text-[#86909c]">{wallet.usd}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[24px]">
          <h2 className="font-['Inter',sans-serif] font-bold text-[24px] text-white mb-[20px]">Recent Activity</h2>
          <div className="flex flex-col gap-[12px]">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-center justify-between bg-[#2b2b2b]/50 rounded-[12px] px-[16px] py-[12px]">
                <div className="flex items-center gap-[12px]">
                  <div
                    className={`size-[36px] rounded-full flex items-center justify-center text-[16px] ${
                      activity.type === "in"
                        ? "bg-[#00ffa3]/20"
                        : activity.type === "out"
                        ? "bg-[#fb035c]/20"
                        : "bg-[rgba(0,170,255,0.2)]"
                    }`}
                  >
                    {activity.type === "in" ? "↓" : activity.type === "out" ? "↑" : "⇆"}
                  </div>
                  <div>
                    <p className="font-['Inter',sans-serif] font-medium text-[16px] text-white">{activity.action}</p>
                    <p className="font-['Inter',sans-serif] font-normal text-[12px] text-[#86909c]">{activity.from}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-['Inter',sans-serif] font-semibold text-[16px] ${activity.type === "in" ? "text-[#00ffa3]" : activity.type === "out" ? "text-[#fb035c]" : "text-white"}`}>
                    {activity.type === "in" ? "+" : activity.type === "out" ? "-" : ""}{activity.amount}
                  </p>
                  <p className="font-['Inter',sans-serif] font-normal text-[12px] text-[#86909c]">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
