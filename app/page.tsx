"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Address,
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
} from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  arcFlowTipsAbi,
  erc20Abi,
  makeClaimCelebrationIntentUrl,
  makeRewardAnnouncementIntentUrl,
  makeRewardAnnouncementText,
} from "../lib/contracts";
import { arcTestnet, CONTRACTS, TOKENS } from "../lib/wagmi";

type TokenSymbol = keyof typeof TOKENS;
type ClaimableTip = {
  tipId: bigint;
  recipientHandle: string;
  amount: bigint;
  token: Address;
  claimDeadline: bigint;
  refunded: boolean;
  claimed: boolean;
};

function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

function safeParseAmount(value: string, decimals: number) {
  try {
    if (!value) return 0n;
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

function formatTimestamp(timestamp: bigint) {
  if (!timestamp) return "-";
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

function getReadableError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (
    message.includes("rate limited") ||
    message.includes("Request exceeds defined limit")
  ) {
    return "Network request is being rate limited right now. Wait 2-3 seconds and try again.";
  }

  return message;
}

function parseTipReadResult(data: unknown) {
  if (!data) return null;

  if (Array.isArray(data) && data.length >= 9) {
    const recipientHandle = data[4];
    const amount = data[2];
    const token = data[1];
    const claimDeadline = data[6];
    const claimed = data[7];
    const refunded = data[8];

    if (
      typeof recipientHandle === "string" &&
      typeof amount === "bigint" &&
      typeof token === "string" &&
      typeof claimDeadline === "bigint" &&
      typeof claimed === "boolean" &&
      typeof refunded === "boolean"
    ) {
      return {
        recipientHandle,
        amount,
        token: token as Address,
        claimDeadline,
        claimed,
        refunded,
      };
    }
  }

  const record = data as {
    recipientHandle?: string;
    amount?: bigint;
    token?: Address;
    claimDeadline?: bigint;
    refunded?: boolean;
    claimed?: boolean;
  };

  if (
    typeof record.recipientHandle !== "string" ||
    typeof record.amount !== "bigint" ||
    typeof record.token !== "string" ||
    typeof record.claimDeadline !== "bigint" ||
    typeof record.refunded !== "boolean" ||
    typeof record.claimed !== "boolean"
  ) {
    return null;
  }

  return record;
}

function NavButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      data-ui="nav-button"
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] transition ${
        active
          ? "bg-[#92ffe7] text-[#04130e] shadow-[0_18px_40px_rgba(82,245,204,0.24)]"
          : "border border-white/8 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      data-ui="panel"
      className={`rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,24,37,0.97),rgba(7,10,17,0.99))] p-5 shadow-[0_36px_100px_rgba(0,0,0,0.48)] sm:p-6 ${className}`}
    >
      <div className="mb-5">
        <h2 className="text-2xl font-medium text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Label({
  title,
  helper,
}: {
  title: string;
  helper?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
        {title}
      </span>
      {helper}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      data-ui="input"
      className="h-14 w-full rounded-2xl border border-white/8 bg-[#0a1018] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#92ffe7] focus:bg-[#0d1520]"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      data-ui="input"
      className="h-14 w-full rounded-2xl border border-white/8 bg-[#0a1018] px-4 text-sm text-white outline-none transition focus:border-[#92ffe7] focus:bg-[#0d1520]"
    />
  );
}

function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      data-ui="primary-button"
      className="h-12 rounded-2xl bg-[linear-gradient(135deg,#b7fff1_0%,#84ffe2_40%,#3ae0b6_100%)] px-4 text-sm font-semibold text-[#04120e] shadow-[0_18px_40px_rgba(61,239,193,0.3)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      data-ui="secondary-button"
      className="h-12 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function TweetButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="h-12 rounded-2xl border border-[#4cb7ff]/35 bg-[linear-gradient(135deg,#43b3ff_0%,#1d9bf0_60%,#1176d4_100%)] px-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(29,155,240,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div data-ui="stat" className="rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function Status({ text }: { text: string }) {
  return (
    <div data-ui="status" className="rounded-2xl border border-[#92ffe7]/15 bg-[#92ffe7]/8 px-4 py-3 text-sm text-[#e0fff7]">
      {text}
    </div>
  );
}

function WalletButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: nativeBalance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
    },
  });

  const injectedConnector = connectors[0];
  const wrongChain = isConnected && chainId !== arcTestnet.id;

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition hover:scale-[1.01] ${
          wrongChain
            ? "border border-red-400/30 bg-[linear-gradient(135deg,#471313_0%,#6e1818_45%,#b42323_100%)] text-white shadow-[0_18px_40px_rgba(180,35,35,0.28)]"
            : "bg-[linear-gradient(135deg,#b7fff1_0%,#84ffe2_40%,#3ae0b6_100%)] text-[#04120e] shadow-[0_18px_40px_rgba(61,239,193,0.3)]"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span>
            {wrongChain
              ? `${address.slice(0, 6)}...${address.slice(-4)} / Wrong Chain`
              : `${address.slice(0, 6)}...${address.slice(-4)} / Disconnect`}
          </span>
          <span className={`text-xs ${wrongChain ? "text-red-100" : "text-[#083326]"}`}>
            {nativeBalance
              ? `${Number(nativeBalance.formatted).toFixed(2)} ${nativeBalance.symbol}`
              : "--"}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={!injectedConnector || isPending}
      className="w-full rounded-2xl bg-[linear-gradient(135deg,#b7fff1_0%,#84ffe2_40%,#3ae0b6_100%)] px-4 py-3 text-sm font-semibold text-[#04120e] shadow-[0_18px_40px_rgba(61,239,193,0.3)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending
        ? "Connecting..."
        : injectedConnector
          ? "Connect Wallet"
          : "Wallet Not Detected"}
    </button>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "dark" | "light";
  onToggle: () => void;
}) {
  return (
    <button
      data-ui="theme-toggle"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Enable light mode" : "Enable dark mode"}
      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xl text-white shadow-[0_12px_36px_rgba(0,0,0,0.22)] transition hover:bg-white/[0.06]"
    >
      {theme === "dark" ? "\u2600" : "\u263d"}
    </button>
  );
}

export default function Page() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();

  const tipsAddress = (CONTRACTS.tips ?? zeroAddress) as Address;
  const hasTipsContract = Boolean(CONTRACTS.tips);

  const [tab, setTab] = useState<"rewards" | "payment" | "why-arc">("rewards");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [tipToken, setTipToken] = useState<TokenSymbol>("USDC");
  const [tipPostUrl, setTipPostUrl] = useState("");
  const [tipRecipientHandle, setTipRecipientHandle] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [tipStatus, setTipStatus] = useState("");
  const [tipApproved, setTipApproved] = useState(false);
  const [createdTipId, setCreatedTipId] = useState<bigint | null>(null);
  const [isApprovingTip, setIsApprovingTip] = useState(false);
  const [isCreatingTip, setIsCreatingTip] = useState(false);

  const [claimStatus, setClaimStatus] = useState("");
  const [verifiedSignature, setVerifiedSignature] = useState<`0x${string}` | null>(null);
  const [verifiedSigDeadline, setVerifiedSigDeadline] = useState<bigint | null>(null);
  const [verifiedTipId, setVerifiedTipId] = useState<bigint | null>(null);
  const [claimableTips, setClaimableTips] = useState<ClaimableTip[]>([]);
  const [claimLoading, setClaimLoading] = useState(false);
  const [selectedClaimTipId, setSelectedClaimTipId] = useState<bigint | null>(null);
  const [xUsername, setXUsername] = useState<string | null>(null);
  const [xLoading, setXLoading] = useState(true);

  const [paymentToken, setPaymentToken] = useState<TokenSymbol>("USDC");
  const [paymentAddress, setPaymentAddress] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const selectedTipToken = TOKENS[tipToken];
  const selectedPaymentToken = TOKENS[paymentToken];

  const parsedTipAmount = useMemo(
    () => safeParseAmount(tipAmount, selectedTipToken.decimals),
    [tipAmount, selectedTipToken.decimals],
  );

  const parsedPaymentAmount = useMemo(
    () => safeParseAmount(paymentAmount, selectedPaymentToken.decimals),
    [paymentAmount, selectedPaymentToken.decimals],
  );

  const announcementTweetText =
    tipRecipientHandle && createdTipId !== null
      ? makeRewardAnnouncementText({
          recipientHandle: tipRecipientHandle,
          message: tipMessage,
          tipId: createdTipId,
          postUrl: tipPostUrl,
        })
      : "";

  const announcementTweetIntentUrl =
    tipRecipientHandle && createdTipId !== null
      ? makeRewardAnnouncementIntentUrl({
          recipientHandle: tipRecipientHandle,
          message: tipMessage,
          tipId: createdTipId,
          postUrl: tipPostUrl,
        })
      : "#";

  const selectedClaimTip = useMemo(
    () => claimableTips.find((tip) => tip.tipId === selectedClaimTipId) ?? null,
    [claimableTips, selectedClaimTipId],
  );

  useEffect(() => {
    async function autoSwitch() {
      if (!isConnected) return;
      if (chainId === arcTestnet.id) return;
      try {
        await switchChainAsync({ chainId: arcTestnet.id });
      } catch {
        // manual fallback remains visible
      }
    }

    void autoSwitch();
  }, [chainId, isConnected, switchChainAsync]);

  useEffect(() => {
    async function loadXSession() {
      try {
        const response = await fetch("/api/x/session", { cache: "no-store" });
        const json = await response.json();
        setXUsername(json?.connected ? json.username : null);
      } catch {
        setXUsername(null);
      } finally {
        setXLoading(false);
      }
    }

    void loadXSession();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    void loadClaimableTips(xUsername);
  }, [xUsername, hasTipsContract, publicClient]);

  useEffect(() => {
    setTipApproved(false);
  }, [tipAmount, tipToken, address]);

  useEffect(() => {
    setVerifiedSignature(null);
    setVerifiedSigDeadline(null);
    setVerifiedTipId(null);
  }, [selectedClaimTipId, address, xUsername]);

  async function ensureArc() {
    if (chainId !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }
  }

  async function disconnectX() {
    await fetch("/api/x/logout", { method: "POST" });
    setXUsername(null);
  }

  async function loadClaimableTips(currentUsername?: string | null) {
    const username = normalizeHandle(currentUsername ?? xUsername ?? "");
    if (!username || !hasTipsContract || !publicClient) {
      setClaimableTips([]);
      setSelectedClaimTipId(null);
      return;
    }

    setClaimLoading(true);

    try {
      const nextTipId = (await (publicClient.readContract as any)({
        address: tipsAddress,
        abi: arcFlowTipsAbi,
        functionName: "nextTipId",
        args: [],
      })) as bigint;

      const total = Number(nextTipId > 1n ? nextTipId - 1n : 0n);
      if (!total) {
        setClaimableTips([]);
        setSelectedClaimTipId(null);
        return;
      }

      const ids = Array.from({ length: total }, (_, index) => BigInt(index + 1));
      const now = BigInt(Math.floor(Date.now() / 1000));

      const tips = (
        await Promise.all(
          ids.map(async (tipId) => {
            try {
              const rawTip = await (publicClient.readContract as any)({
                address: tipsAddress,
                abi: arcFlowTipsAbi,
                functionName: "getTip",
                args: [tipId],
              });
              const parsed = parseTipReadResult(rawTip);
              return parsed ? ({ ...parsed, tipId } as ClaimableTip) : null;
            } catch {
              return null;
            }
          }),
        )
      )
        .filter((tip): tip is ClaimableTip => Boolean(tip))
        .filter(
          (tip) =>
            normalizeHandle(tip.recipientHandle) === username &&
            !tip.claimed &&
            !tip.refunded &&
            tip.claimDeadline > now,
        );

      setClaimableTips(tips);
      setSelectedClaimTipId((current) =>
        tips.find((tip) => tip.tipId === current)?.tipId ?? tips[0]?.tipId ?? null,
      );
    } finally {
      setClaimLoading(false);
    }
  }

  async function approveTipToken() {
    setIsApprovingTip(true);
    try {
      if (!CONTRACTS.tips) {
        throw new Error("NEXT_PUBLIC_TIPS_CONTRACT is still empty in .env.local.");
      }
      if (!parsedTipAmount) throw new Error("Enter a valid amount.");

      setTipStatus(`Approving ${tipToken}...`);
      await ensureArc();

      const hash = await (writeContractAsync as any)({
        address: selectedTipToken.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [tipsAddress, parsedTipAmount],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      setTipApproved(true);
      setTipStatus(`${tipToken} approved.`);
    } catch (error) {
      setTipStatus(getReadableError(error, "Approval failed."));
    } finally {
      setIsApprovingTip(false);
    }
  }

  async function createTip() {
    setIsCreatingTip(true);
    try {
      if (!CONTRACTS.tips) {
        throw new Error("NEXT_PUBLIC_TIPS_CONTRACT is still empty in .env.local.");
      }
      if (!parsedTipAmount) throw new Error("Enter a valid amount.");
      if (!tipApproved) throw new Error(`Approve ${tipToken} first.`);

      const handle = normalizeHandle(tipRecipientHandle);
      if (!handle) throw new Error("Enter the X handle.");
      const normalizedPostUrl = tipPostUrl.trim() || `https://x.com/${handle}`;

      setTipStatus("Creating reward...");
      await ensureArc();

      const expectedTipId = (await (publicClient?.readContract as any)?.({
        address: tipsAddress,
        abi: arcFlowTipsAbi,
        functionName: "nextTipId",
        args: [],
      })) as bigint | undefined;

      const claimDeadline = BigInt(
        Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      );

      const hash = await (writeContractAsync as any)({
        address: tipsAddress,
        abi: arcFlowTipsAbi,
        functionName: "createTip",
        args: [
          normalizedPostUrl,
          handle,
          selectedTipToken.address,
          parsedTipAmount,
          claimDeadline,
        ],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      const createdTipId = expectedTipId ?? null;

      if (createdTipId !== null) {
        setCreatedTipId(createdTipId);
        setTipApproved(false);
        setTipStatus(`Reward created. Tip ID: ${createdTipId.toString()}`);
        const tweetUrl = makeRewardAnnouncementIntentUrl({
          recipientHandle: handle,
          message: tipMessage,
          tipId: createdTipId,
          postUrl: normalizedPostUrl,
        });
        window.open(tweetUrl, "_blank", "noopener,noreferrer");
      } else {
        setTipStatus("Reward created. Check ArcScan for the TipCreated event.");
      }
    } catch (error) {
      setTipStatus(getReadableError(error, "Reward failed."));
    } finally {
      setIsCreatingTip(false);
    }
  }

  async function verifyClaimTip() {
    try {
      if (!address) throw new Error("Connect wallet first.");
      if (!CONTRACTS.tips) {
        throw new Error("NEXT_PUBLIC_TIPS_CONTRACT is still empty in .env.local.");
      }
      if (!selectedClaimTipId) {
        throw new Error("No claimable rewards found for this connected X account.");
      }

      setClaimStatus("Verifying connected X account...");
      await ensureArc();

      const verifyResponse = await fetch("/api/verify-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipId: selectedClaimTipId.toString(),
          recipient: address,
        }),
      });

      const verifyJson = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(
          verifyJson.detail
            ? `${verifyJson.error || "Verification failed."} ${verifyJson.detail}`
            : verifyJson.error || "Verification failed.",
        );
      }

      setVerifiedSignature(verifyJson.signature);
      setVerifiedSigDeadline(BigInt(verifyJson.sigDeadline));
      setVerifiedTipId(selectedClaimTipId);
      setClaimStatus("Verified. Claim is ready.");
    } catch (error) {
      setClaimStatus(error instanceof Error ? error.message : "Verification failed.");
    }
  }

  async function claimVerifiedTip(openTweetAfterClaim = false) {
    try {
      if (!address) throw new Error("Connect wallet first.");
      if (!verifiedSignature || !verifiedSigDeadline || verifiedTipId === null) {
        throw new Error("Verify first.");
      }
      if (!CONTRACTS.tips) {
        throw new Error("NEXT_PUBLIC_TIPS_CONTRACT is still empty in .env.local.");
      }

      setClaimStatus("Claiming reward...");
      await ensureArc();

      const hash = await (writeContractAsync as any)({
        address: tipsAddress,
        abi: arcFlowTipsAbi,
        functionName: "claimTip",
        args: [
          verifiedTipId,
          address,
          verifiedSigDeadline,
          verifiedSignature,
        ],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      const celebrationUrl = openTweetAfterClaim
        ? makeClaimCelebrationIntentUrl({
            handle: selectedClaimTip?.recipientHandle,
            amount: selectedClaimTip
              ? formatUnits(selectedClaimTip.amount, 6)
              : undefined,
            tokenSymbol: selectedClaimTip
              ? selectedClaimTip.token === TOKENS.USDC.address
                ? "USDC"
                : "EURC"
              : undefined,
          })
        : null;
      setVerifiedSignature(null);
      setVerifiedSigDeadline(null);
      setVerifiedTipId(null);
      await loadClaimableTips(xUsername);
      setClaimStatus("Claim completed.");
      if (celebrationUrl) {
        window.location.href = celebrationUrl;
      }
    } catch (error) {
      setClaimStatus(error instanceof Error ? error.message : "Claim failed.");
    }
  }

  async function sendPayment() {
    try {
      if (!isConnected) throw new Error("Connect wallet first.");
      if (!parsedPaymentAmount) throw new Error("Enter a valid amount.");

      const trimmed = paymentAddress.trim();
      if (!trimmed.startsWith("0x")) {
        throw new Error("Wallet address must start with 0x.");
      }
      if (!isAddress(trimmed)) {
        throw new Error("Wallet address format is invalid.");
      }
      if (trimmed.toLowerCase() === zeroAddress.toLowerCase()) {
        throw new Error("Zero address is not allowed.");
      }

      setPaymentStatus(`Sending ${paymentToken}...`);
      await ensureArc();

      const hash = await (writeContractAsync as any)({
        address: selectedPaymentToken.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [trimmed as Address, parsedPaymentAmount],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      setPaymentStatus("Payment completed.");
    } catch (error) {
      setPaymentStatus(error instanceof Error ? error.message : "Payment failed.");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-10">
      <section
        data-ui="hero"
        className="relative mb-8 overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,12,20,0.98),rgba(4,6,10,0.98))] p-5 shadow-[0_48px_120px_rgba(0,0,0,0.58)] sm:p-7"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,rgba(124,255,226,0.2),transparent_24%),radial-gradient(circle_at_88%_16%,rgba(120,101,255,0.18),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(18,98,118,0.26),transparent_34%)]" />

        <div className="relative">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-[760px]">
              <p className="mb-4 text-[11px] uppercase tracking-[0.42em] text-[#98ffe5]">
                ArcFlow
              </p>
              <h1 className="max-w-[720px] text-5xl font-medium leading-[0.92] text-white sm:text-6xl">
                Reward a creator.
                <br />
                Anchor it on X.
                <br />
                Release on Arc.
              </h1>
                <p className="mt-5 max-w-[640px] text-sm leading-6 text-slate-400 sm:text-base">
                  Social rewards on Arc with stablecoin-native flows, cleaner identity checks, and faster creator payouts.
                </p>
            </div>

            <div className="flex flex-col gap-3 xl:w-[360px] xl:items-end">
              <div className="flex w-full gap-3">
                <ThemeToggle
                  theme={theme}
                  onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
                />
                <div className="flex-1">
                  <WalletButton />
                </div>
              </div>
              {isConnected && chainId !== arcTestnet.id ? (
                <div className="w-full rounded-2xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
                  Arc Test ağında olduğunuzdan emin olun. Your wallet is connected on the wrong chain right now.
                </div>
              ) : null}
              <button
                onClick={() => void switchChainAsync({ chainId: arcTestnet.id })}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.06]"
              >
                Add Arc Testnet Network
              </button>
              <div className="grid w-full gap-2">
                <Stat
                  label="Wallet"
                  value={
                    address
                      ? `${address.slice(0, 6)}...${address.slice(-4)}`
                      : "Not connected"
                  }
                />
                <Stat
                  label="Network"
                  value="Make sure Arc Testnet is selected in your wallet."
                />
                <Stat
                  label="Assets"
                  value={chainId === arcTestnet.id ? "USDC / EURC / Balance live" : "Wrong chain"}
                />
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <NavButton active={tab === "rewards"} onClick={() => setTab("rewards")}>
              Rewards
            </NavButton>
            <NavButton active={tab === "payment"} onClick={() => setTab("payment")}>
              Send Payment
            </NavButton>
            <NavButton active={tab === "why-arc"} onClick={() => setTab("why-arc")}>
              Why Arc
            </NavButton>
            <Link
              href="https://faucet.circle.com/"
              target="_blank"
              className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              Faucet
            </Link>
          </div>
        </div>
      </section>

      {tab === "rewards" ? (
        <section className="grid gap-10 xl:grid-cols-[1.04fr_0.96fr]">
          <div className="space-y-8">
            <Panel
              title="Create Reward"
              subtitle="Lock USDC or EURC to an X handle. Add your own message and let ArcFlow handle the proof flow."
              className="flex flex-col h-full xl:h-[760px]"
            >
              <div className="grid gap-4">
                <div>
                  <Label title="Tweet URL" helper={<span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optional</span>} />
                  <Input
                    placeholder="https://x.com/user/status/123... or leave empty"
                    value={tipPostUrl}
                    onChange={(event) => setTipPostUrl(event.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label title="Creator Handle" />
                    <Input
                      placeholder="@creator"
                      value={tipRecipientHandle}
                      onChange={(event) => setTipRecipientHandle(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label title="Asset" />
                    <Select
                      value={tipToken}
                      onChange={(event) => setTipToken(event.target.value as TokenSymbol)}
                    >
                      <option value="USDC">USDC</option>
                      <option value="EURC">EURC</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label title="Message" />
                  <Input
                    placeholder='because of "this thread helped me"'
                    value={tipMessage}
                    onChange={(event) => setTipMessage(event.target.value)}
                  />
                </div>

                <div>
                  <Label title="Amount" />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="25.00"
                    value={tipAmount}
                    onChange={(event) => setTipAmount(event.target.value)}
                  />
                </div>

                <div data-ui="subpanel" className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#0d131c,#091019)] p-4">
                  <Label
                    title="Optional Sender Announcement"
                    helper={
                      announcementTweetText ? (
                        <Link
                          href={announcementTweetIntentUrl}
                          target="_blank"
                          className="rounded-full border border-[#4cb7ff]/35 bg-[linear-gradient(135deg,#43b3ff_0%,#1d9bf0_60%,#1176d4_100%)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white transition hover:scale-[1.02]"
                        >
                          Share on X
                        </Link>
                      ) : null
                    }
                  />
                  <p className="font-mono text-xs leading-6 text-[#c8fff1]">
                    {announcementTweetText ||
                      "Create the reward first. Then ArcFlow will generate a clean sender tweet with the new reward ID."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={approveTipToken}
                    disabled={!isConnected || tipApproved || isApprovingTip || isCreatingTip}
                    className={`h-12 rounded-2xl px-4 text-sm font-semibold transition ${
                      tipApproved
                        ? "border border-white/10 bg-white/[0.05] text-slate-500"
                        : "bg-[linear-gradient(135deg,#b7fff1_0%,#84ffe2_40%,#3ae0b6_100%)] text-[#04120e] shadow-[0_18px_40px_rgba(61,239,193,0.3)] hover:scale-[1.01]"
                    } disabled:cursor-not-allowed disabled:hover:scale-100`}
                  >
                    {isApprovingTip ? `Approving ${tipToken}...` : `Approve ${tipToken}`}
                  </button>
                  <button
                    onClick={createTip}
                    disabled={!isConnected || !tipApproved || isApprovingTip || isCreatingTip}
                    className={`h-12 rounded-2xl px-4 text-sm font-semibold transition ${
                      tipApproved
                        ? "bg-[linear-gradient(135deg,#b7fff1_0%,#84ffe2_40%,#3ae0b6_100%)] text-[#04120e] shadow-[0_18px_40px_rgba(61,239,193,0.3)] hover:scale-[1.01]"
                        : "border border-white/10 bg-white/[0.03] text-slate-500"
                    } disabled:cursor-not-allowed disabled:hover:scale-100`}
                  >
                    {isCreatingTip ? "Creating Reward..." : "Create Reward"}
                  </button>
                </div>

                <div className="min-h-[52px]">
                  {tipStatus ? <Status text={tipStatus} /> : null}
                </div>
              </div>
            </Panel>

            <Panel
              title="Claim Reward"
              subtitle="Connect your X account to claim your rewards."
            >
              <div className="grid gap-4">
                <div data-ui="subpanel" className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#0d131c,#091019)] p-4">
                  <Label title="X Connection" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-300">
                      {xLoading
                        ? "Checking X session..."
                        : xUsername
                          ? `Connected as @${xUsername}`
                          : "Connect the X account that owns the handle receiving this reward."}
                    </p>
                    {xUsername ? (
                      <SecondaryButton onClick={() => void disconnectX()}>
                        Disconnect X
                      </SecondaryButton>
                    ) : (
                      <PrimaryButton
                        onClick={() => {
                          window.location.href = "/api/x/login";
                        }}
                        disabled={xLoading}
                      >
                        Connect X
                      </PrimaryButton>
                    )}
                  </div>
                </div>

                <div data-ui="subpanel" className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#0c1119,#0a0f17)] p-4">
                  <Label title="Claim Identity" />
                  <p className="font-mono text-xs leading-6 text-[#c8fff1]">
                    {xUsername
                      ? `@${xUsername} is connected. ArcFlow will scan for active rewards assigned to this handle.`
                      : "Connect X to load claimable rewards reserved for your handle."}
                  </p>
                </div>

                <div data-ui="subpanel" className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#0c1119,#0a0f17)] p-4">
                  <Label title="Claimable Rewards" />
                  {claimLoading ? (
                    <p className="text-sm leading-6 text-slate-400">Loading claimable rewards...</p>
                  ) : claimableTips.length ? (
                    <div className="grid gap-3">
                      {claimableTips.map((tip) => (
                        <button
                          key={tip.tipId.toString()}
                          type="button"
                          onClick={() => setSelectedClaimTipId(tip.tipId)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            selectedClaimTipId === tip.tipId
                              ? "border-[#92ffe7]/50 bg-[#92ffe7]/10"
                              : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                                Reward #{tip.tipId.toString()}
                              </p>
                              <p className="mt-2 text-sm font-medium text-white">
                                {formatUnits(tip.amount, 6)}{" "}
                                {tip.token === TOKENS.USDC.address ? "USDC" : "EURC"} reserved for @{tip.recipientHandle}
                              </p>
                            </div>
                            <p className="text-xs text-slate-400">
                              Ends {formatTimestamp(tip.claimDeadline)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-slate-400">
                      No active rewards were found for this connected X account yet.
                    </p>
                  )}
                </div>

                {selectedClaimTip ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Stat label="Reward ID" value={selectedClaimTip.tipId.toString()} />
                    <Stat label="Handle" value={`@${selectedClaimTip.recipientHandle}`} />
                    <Stat
                      label="Amount"
                      value={`${formatUnits(selectedClaimTip.amount, 6)} ${
                        selectedClaimTip.token === TOKENS.USDC.address ? "USDC" : "EURC"
                      }`}
                    />
                    <Stat
                      label="Deadline"
                      value={formatTimestamp(selectedClaimTip.claimDeadline)}
                    />
                    <Stat
                      label="State"
                      value={
                        selectedClaimTip.refunded
                          ? "Refunded"
                          : selectedClaimTip.claimed
                            ? "Claimed"
                            : "Active"
                      }
                    />
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <SecondaryButton
                    onClick={verifyClaimTip}
                    disabled={!isConnected || !xUsername}
                  >
                    Verify
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={() => void claimVerifiedTip(false)}
                    disabled={!isConnected || !xUsername || !verifiedSignature}
                  >
                    Claim
                  </PrimaryButton>
                </div>

                <TweetButton
                  onClick={() => void claimVerifiedTip(true)}
                  disabled={!isConnected || !xUsername || !verifiedSignature}
                >
                  Claim & Tweet
                </TweetButton>

                {claimStatus ? <Status text={claimStatus} /> : null}
              </div>
            </Panel>
          </div>

          <div className="space-y-8">
            <Panel title="The ArcFlow Protocol" className="flex flex-col h-full xl:h-[760px]">
              <div className="mt-4 flex flex-1 flex-col gap-4">
                <div className="grid gap-4">
                <Stat label="1. Spot a Creator" value="Find a tweet or profile that deserves a reward." />
                <Stat label="2. Lock the Reward" value="Securely lock USDC or EURC to their social handle." />
                <Stat label="3. Account Match" value="The recipient connects X, ArcFlow detects active rewards reserved for that handle, and verification becomes one click." />
                <Stat label="4. Automated Payout" value="Once the connected X account matches, smart contracts release funds instantly on Arc with no manual admin step." />
                </div>
                <div className="mt-auto rounded-[28px] border border-white/8 bg-white/[0.025] p-5">
                  <p className="text-sm leading-8 text-slate-300">
                    ArcFlow turns social appreciation into a cleaner product flow: creators can be discovered on X, rewarded in stablecoins, verified through connected identity, and paid out on Arc without clunky off-chain coordination.
                  </p>
                </div>
                <div className="rounded-[28px] border border-[#92ffe7]/18 bg-[#92ffe7]/7 px-5 py-6 text-center">
                  <p className="text-lg font-semibold uppercase tracking-[0.52em] text-[#98ffe5] sm:text-xl">
                    Build On Arc
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Explore Arc">
              <div className="mt-8 grid gap-3">
                <Link href="https://www.arc.network/" target="_blank" className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white transition hover:bg-white/[0.06]">
                  Arc Network | Build, Learn, Ecosystem, Start Building
                </Link>
                <Link href="https://testnet.arcscan.app/" target="_blank" className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white transition hover:bg-white/[0.06]">
                  Arc Testnet Explorer | Blockchain, Contracts, Charts, API
                </Link>
                <Link href="https://community.arc.network/" target="_blank" className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white transition hover:bg-white/[0.06]">
                  Arc Community | Events, Contents, Contributions, Badges
                </Link>
                <Link href="https://docs.arc.network/" target="_blank" className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white transition hover:bg-white/[0.06]">
                  Arc Docs | Documentation, Integrate, Everything you need
                </Link>
              </div>
            </Panel>
            <section
              data-ui="panel"
              className="mt-2 flex min-h-[188px] items-center justify-center rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.09),transparent_34%),linear-gradient(180deg,rgba(17,24,37,0.97),rgba(7,10,17,0.99))] px-6 py-5 text-center shadow-[0_36px_100px_rgba(0,0,0,0.48)]"
            >
              <div className="w-full max-w-[420px]">
                <p className="text-base font-medium uppercase tracking-[0.72em] text-slate-400">
                  Powered By
                </p>
                <p className="mt-6 pl-4 text-center text-5xl font-medium tracking-[1.12em] text-white sm:text-6xl">
                  ARC
                </p>
              </div>
            </section>
          </div>
        </section>
      ) : tab === "payment" ? (
        <section className="grid gap-8 xl:grid-cols-[1.02fr_0.98fr]">
          <Panel
            title="Send Payment"
            subtitle="Directly send USDC or EURC to a wallet address. Address must be valid and start with 0x."
          >
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label title="Asset" />
                  <Select
                    value={paymentToken}
                    onChange={(event) => setPaymentToken(event.target.value as TokenSymbol)}
                  >
                    <option value="USDC">USDC</option>
                    <option value="EURC">EURC</option>
                  </Select>
                </div>

                <div>
                  <Label title="Amount" />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="10.00"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label title="Wallet Address" />
                <Input
                  placeholder="0x..."
                  value={paymentAddress}
                  onChange={(event) => setPaymentAddress(event.target.value)}
                />
              </div>

              <PrimaryButton onClick={sendPayment} disabled={!isConnected}>
                Send {paymentToken}
              </PrimaryButton>

              {paymentStatus ? <Status text={paymentStatus} /> : null}
            </div>
          </Panel>

          <Panel title="Payment Notes">
            <div className="grid gap-3">
              <Stat label="Validation" value="Address must start with 0x and pass wallet format validation." />
              <Stat label="Blocked" value="Zero address is rejected." />
              <Stat label="Reminder" value="A valid blockchain address can still be unused; chain cannot prove ownership in advance." />
            </div>
          </Panel>
        </section>
      ) : (
        <section className="grid gap-10 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-8">
            <Panel
              title="Why Arc"
              subtitle="Arc gives ArcFlow the kind of base layer this product needs: stablecoin-native flows, fast confirmations, and an ecosystem that feels like it wants builders to win."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Stat
                  label="Stablecoin Native"
                  value="Arc feels aligned with products built around USDC and EURC, which is exactly what ArcFlow needs for rewards and direct payments."
                />
                <Stat
                  label="Fast Confirmation"
                  value="When a social reward turns into an onchain action, speed matters. Arc keeps that loop feeling immediate instead of stale."
                />
                <Stat
                  label="Consumer Product Fit"
                  value="Arc works especially well for apps that sit between identity, payments, creators, and community instead of purely trader-first experiences."
                />
                <Stat
                  label="Builder Energy"
                  value="A strong product lives or dies by iteration speed. Arc gives us a place where shipping faster actually feels possible."
                />
              </div>
            </Panel>

            <Panel title="What Arc Gives Us">
              <div className="grid gap-4">
                <div className="rounded-[28px] border border-white/8 bg-white/[0.025] p-5">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
                    Build, Learn, Ecosystem
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Arc presents the network as more than raw infrastructure. The website, docs, and community all push
                    the same idea: builders should have clear paths to learn, integrate, and grow inside the ecosystem.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/8 bg-white/[0.025] p-5">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
                    Docs + Explorer Practicality
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Good docs matter because they lower the friction between an idea and a working product. Arc also has
                    the testnet explorer and ecosystem surfaces that make verifying contracts, tracking activity, and
                    shipping iterations easier.
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-8">
            <Panel title="Why We Picked Arc For ArcFlow">
              <div className="grid gap-4">
                <div className="rounded-[28px] border border-white/8 bg-white/[0.025] p-5">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">For This Product</p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    ArcFlow is about rewarding people on the internet with stablecoins in a way that still feels clean,
                    modern, and social. Arc fits that story better than a chain that only feels optimized for trading.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/8 bg-white/[0.025] p-5">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">For Developers</p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    One of the biggest reasons we like Arc is the builder atmosphere around it. The team values
                    developers, the community highlights contributions, and people building on Arc tend to actually sound
                    happy to keep building.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/8 bg-white/[0.025] p-5">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">For Growth</p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Community events, content, contributions, and visible ecosystem pathways make Arc feel like a place
                    where projects can compound attention over time instead of launching once and disappearing.
                  </p>
                </div>
              </div>
            </Panel>

            <section
              data-ui="panel"
              className="flex min-h-[188px] items-center justify-center rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.09),transparent_34%),linear-gradient(180deg,rgba(17,24,37,0.97),rgba(7,10,17,0.99))] px-6 py-5 text-center shadow-[0_36px_100px_rgba(0,0,0,0.48)]"
            >
              <div className="w-full max-w-[420px]">
                <p className="text-base font-medium uppercase tracking-[0.72em] text-slate-400">
                  Powered By
                </p>
                <p className="mt-6 pl-4 text-center text-5xl font-medium tracking-[1.12em] text-white sm:text-6xl">
                  ARC
                </p>
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}

