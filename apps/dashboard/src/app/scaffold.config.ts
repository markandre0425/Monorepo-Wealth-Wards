import * as chains from "viem/chains";

export type ScaffoldConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
};

const scaffoldConfig = {
  // The networks on which your DApp is live
  targetNetworks: [chains.mainnet],

  // The interval at which your front-end polls the RPC servers.
  pollingInterval: 30000,

  // This is placeholders, please replace with your actual keys
  alchemyApiKey: import.meta.env.VITE_ALCHEMY_API_KEY || "oKsh3Sa8Xm98u-B_EuQSXYA5n93ZzThE",
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "3a8170812b53460ff61aa5209772a818",

  // Only show the Burner Wallet when running on localhost
  onlyLocalBurnerWallet: true,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
