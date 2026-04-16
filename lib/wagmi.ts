import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
    public: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const TOKENS = {
  USDC: {
    symbol: "USDC",
    address: "0x3600000000000000000000000000000000000000" as const,
    decimals: 6,
  },
  EURC: {
    symbol: "EURC",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as const,
    decimals: 6,
  },
} as const;

const rawTipsContract = process.env.NEXT_PUBLIC_TIPS_CONTRACT;
const isZeroAddress =
  rawTipsContract?.toLowerCase() ===
  "0x0000000000000000000000000000000000000000";

export const CONTRACTS = {
  tips:
    rawTipsContract && !isZeroAddress
      ? (rawTipsContract as `0x${string}`)
      : undefined,
} as const;

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
  },
});
