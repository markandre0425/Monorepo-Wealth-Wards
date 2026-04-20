import { useState, useEffect } from "react";
import { isAddress, createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import scaffoldConfig from "../scaffold.config";

const RPC_URL = scaffoldConfig.targetNetworks[0].rpcUrls.default.http[0];

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

interface AddressInputProps {
  /** Current address or ENS name (controlled). */
  addressText: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Reusable AddressInput component for hex addresses and ENS support.
 */
export const AddressInput = ({ addressText, onChange, placeholder = "Address (0x... or ENS)", disabled }: AddressInputProps) => {
  const [isEns, setIsEns] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    const checkEns = async () => {
      if (addressText.endsWith(".eth")) {
        setIsEns(true);
        setIsResolving(true);
        try {
          const address = await publicClient.getEnsAddress({ name: addressText });
          setResolvedAddress(address);
        } catch (e) {
          setResolvedAddress(null);
        } finally {
          setIsResolving(false);
        }
      } else {
        setIsEns(false);
        setResolvedAddress(null);
        setIsResolving(false);
      }
    };

    const timer = setTimeout(checkEns, 500);
    return () => clearTimeout(timer);
  }, [addressText]);

  const isValid = !addressText || isAddress(addressText) || (isEns && !!resolvedAddress);

  return (
    <div className="relative w-full">
      <input
        className={`bg-[#2b2b2b] rounded-[12px] h-[40px] flex items-center px-[16px] font-['Poppins',sans-serif] font-semibold text-[14px] text-white tracking-[0.14px] outline-none placeholder-white/50 w-full transition-all border ${
          isValid ? "border-transparent focus:border-[#0FC6C2]/50" : "border-red-500/50 focus:border-red-500"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        placeholder={placeholder}
        value={addressText}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
        disabled={disabled}
      />
      {isEns && isValid && !isResolving && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded uppercase font-bold">
            ENS
          </span>
        </div>
      )}
      {isEns && isResolving && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="text-[10px] animate-pulse text-cyan-400/70 font-bold uppercase">
            Resolving...
          </span>
        </div>
      )}
      {!isValid && !isResolving && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase font-bold">
            Invalid
          </span>
        </div>
      )}
      {resolvedAddress && !isResolving && (
        <div className="absolute left-4 -bottom-5">
          <p className="text-[10px] text-[#86909c] font-mono">
            Resolved: {resolvedAddress.slice(0, 10)}...{resolvedAddress.slice(-8)}
          </p>
        </div>
      )}
    </div>
  );
};
