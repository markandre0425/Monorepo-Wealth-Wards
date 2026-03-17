import svgPaths from "../../imports/svg-fziies2cf0";

export function EthLogo({ size = 12 }: { size?: number }) {
  return (
    <div className="overflow-clip relative" style={{ width: size, height: size }}>
      <div className="absolute inset-[0_19.3%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.36849 11.9999">
          <path d={svgPaths.p2a7f5200} fill="#343434" />
          <path d={svgPaths.p3aedc500} fill="#8C8C8C" />
          <path d={svgPaths.p2fab2c00} fill="#3C3C3B" />
          <path d={svgPaths.p22621c00} fill="#8C8C8C" />
          <path d={svgPaths.p25f35300} fill="#141414" />
          <path d={svgPaths.p5f31800} fill="#393939" />
        </svg>
      </div>
    </div>
  );
}

export function EthBadge() {
  return (
    <div className="flex items-center gap-[4px] bg-[rgba(0,0,0,0.4)] rounded-[25px] pl-[5px] pr-[10px] py-[5px]">
      <div className="flex items-center justify-center p-[5px] rounded-full shrink-0 size-[22px]" style={{ backgroundImage: "linear-gradient(144.638deg, rgb(255, 255, 255) 6.1321%, rgba(217, 217, 217, 0.71) 99.078%)" }}>
        <EthLogo size={12} />
      </div>
      <p className="font-['Inter',sans-serif] font-medium text-[12px] text-white">ETH</p>
      <ChevronDownIcon />
    </div>
  );
}

export function ChevronDownIcon() {
  return (
    <svg width="12" height="12" fill="none" viewBox="0 0 12 12">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
    </svg>
  );
}

export function DashboardIcon() {
  return (
    <div className="overflow-clip relative shrink-0 size-[24px]">
      <div className="absolute inset-[5.21%_53.13%_5.21%_5.21%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10 21.5">
          <path d={svgPaths.p824d300} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[5.21%_5.21%_42.71%_53.13%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10 12.5">
          <path d={svgPaths.p211752f0} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[63.54%_5.21%_5.21%_53.13%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10 7.5">
          <path d={svgPaths.p3f489480} fill="white" />
        </svg>
      </div>
    </div>
  );
}

export function SettingsIcon() {
  return (
    <div className="overflow-clip relative shrink-0 size-[24px]">
      <div className="absolute inset-[5.21%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21.5 21.5">
          <path d={svgPaths.p62080} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[57.71%_31.96%_19.79%_61.79%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.5 5.4">
          <path d={svgPaths.p1074b800} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[19.79%_31.96%_65.83%_61.79%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.5 3.45">
          <path d={svgPaths.p524d900} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[27.92%_21.12%_44.17%_50.96%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 6.7 6.7">
          <path d={svgPaths.p3b89d570} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[65.83%_61.79%_19.79%_31.96%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.5 3.45">
          <path d={svgPaths.p35592f00} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[19.79%_61.79%_57.71%_31.96%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.5 5.4">
          <path d={svgPaths.p338343f0} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[44.17%_50.96%_27.92%_21.13%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 6.69999 6.7">
          <path d={svgPaths.p2840ca00} fill="white" />
        </svg>
      </div>
    </div>
  );
}

export function ProfileIcon() {
  return (
    <div className="overflow-clip relative shrink-0 size-[24px]">
      <div className="absolute inset-[5.21%_26.04%_46.88%_26.04%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.5 11.5">
          <path d={svgPaths.p1744af00} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[59.38%_11.08%_5.21%_11.08%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.6799 8.5">
          <path d={svgPaths.p3e979980} fill="white" />
        </svg>
      </div>
    </div>
  );
}

export function TransactionsIcon() {
  return (
    <div className="overflow-clip relative shrink-0 size-[24px]">
      <div className="absolute inset-[5.21%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21.5 21.5">
          <path d={svgPaths.p62080} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[35.53%_25.01%_45.5%_24.78%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12.05 4.55333">
          <path d={svgPaths.p1477bc80} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[48.25%_46.88%_22.83%_46.88%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.5 6.94">
          <path d={svgPaths.p1a775300} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[21.82%_22.87%_21.88%_22.88%]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.0201 13.5125">
          <path d={svgPaths.p2d78c000} fill="white" />
        </svg>
      </div>
    </div>
  );
}

export function LogoutIcon() {
  return (
    <div className="relative shrink-0 size-[24px]">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <path d={svgPaths.p353eff00} fill="white" />
        <path d={svgPaths.p2f97f980} fill="white" />
        <path d={svgPaths.p2b0da00} fill="white" />
      </svg>
    </div>
  );
}

export function MoneysIcon() {
  return (
    <div className="size-[32px] shrink-0 relative">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <path d={svgPaths.p1fe70f00} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" />
        <path d={svgPaths.p18870300} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" />
        <path d={svgPaths.p31edae40} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" />
        <path d="M6.37325 11.0667V16.9335" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" />
        <path d="M21.629 11.0671V16.9337" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" />
      </svg>
    </div>
  );
}

export function WalletMoneyIcon() {
  return (
    <div className="size-[32px] shrink-0 relative">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <path d={svgPaths.padadf80} fill="white" />
        <path d={svgPaths.p24cd8200} fill="white" />
        <path d={svgPaths.p370efa00} fill="white" />
        <path d={svgPaths.pdcfba80} fill="white" />
        <path d={svgPaths.p296f480} fill="white" />
      </svg>
    </div>
  );
}

export function ChartSquareIcon() {
  return (
    <div className="size-[32px] shrink-0 relative">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <path d={svgPaths.p1d535c00} fill="white" />
        <path d={svgPaths.pdfce600} fill="white" />
        <path d={svgPaths.p3540f200} fill="white" />
        <path d={svgPaths.peb6e480} fill="white" />
      </svg>
    </div>
  );
}

export function BitcoinLogo() {
  return (
    <div className="bg-[#f7931a] flex items-center justify-center p-[4px] rounded-full shrink-0">
      <div className="overflow-clip relative size-[24px]">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9973 24">
          <path d={svgPaths.p1091ad00} fill="#F7931A" />
          <path d={svgPaths.p19ce2f00} fill="white" />
        </svg>
      </div>
    </div>
  );
}

export function EthereumLogo() {
  return (
    <div className="bg-[#00ffa3] flex items-center justify-center p-[4px] rounded-full shrink-0">
      <div className="overflow-clip relative size-[24px]">
        <div className="absolute inset-[0_19.3%]">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14.737 23.9998">
            <path d={svgPaths.p3f963800} fill="#343434" />
            <path d={svgPaths.p34042180} fill="#8C8C8C" />
            <path d={svgPaths.p1390c400} fill="#3C3C3B" />
            <path d={svgPaths.p1506f700} fill="#8C8C8C" />
            <path d={svgPaths.p38db8200} fill="#141414" />
            <path d={svgPaths.p36d98780} fill="#393939" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function HamburgerIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
