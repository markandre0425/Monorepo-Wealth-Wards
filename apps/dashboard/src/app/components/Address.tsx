import { useState } from "react";
import { getAddress, isAddress } from "viem";

interface AddressProps {
  address?: string;
  disableAddressLink?: boolean;
  format?: "short" | "long";
  size?: "xs" | "sm" | "base" | "lg" | "xl";
}

const blockieSizeMap = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 32,
  xl: 40,
};

/**
 * Reusable Address component for consistent formatting, blockies, and copy-to-clipboard.
 */
export const Address = ({ address, disableAddressLink, format = "short", size = "base" }: AddressProps) => {
  const [addressCopied, setAddressCopied] = useState(false);

  if (!address || !isAddress(address)) {
    return <span className="text-gray-400 font-mono">Invalid Address</span>;
  }

  const checksummedAddress = getAddress(address);

  const displayAddress =
    format === "short"
      ? `${checksummedAddress.slice(0, 6)}...${checksummedAddress.slice(-4)}`
      : checksummedAddress;

  return (
    <div className="flex items-center gap-2 font-mono">
      <div
        className="rounded-full bg-gradient-to-br from-[#0FC6C2] to-[#165DFF] shrink-0"
        style={{ width: blockieSizeMap[size], height: blockieSizeMap[size] }}
      />
      
      {disableAddressLink ? (
        <span className="text-white hover:text-[#0FC6C2] transition-colors cursor-default">
          {displayAddress}
        </span>
      ) : (
        <a
          href={`https://etherscan.io/address/${checksummedAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white hover:text-[#0FC6C2] transition-colors underline-offset-4 hover:underline"
        >
          {displayAddress}
        </a>
      )}

      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(checksummedAddress);
          setAddressCopied(true);
          setTimeout(() => setAddressCopied(false), 2000);
        }}
        className="flex items-center justify-center transition-colors"
      >
        {addressCopied ? (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#00ffa3" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-white/40 hover:text-white">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
};
