"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Address,
  decodeEventLog,
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
} from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  arcFlowTipsAbi,
  erc20Abi,
  makeClaimProof,
  makeProofTweetIntentUrl,
  makeProofTweetText,
  makeRewardAnnouncementIntentUrl,
  makeRewardAnnouncementText,
} from "../lib/contracts";
import { arcTestnet, CONTRACTS, TOKENS } from "../lib/wagmi";

type TokenSymbol = keyof typeof TOKENS;

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

function parseTipReadResult(data: unknown) {
  if (!data) return null;

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
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,24,37,0.97),rgba(7,10,17,0.99))] p-5 shadow-[0_36px_100px_rgba(0,0,0,0.48)] sm:p-6">
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
      className="h-14 w-full rounded-2xl border border-white/8 bg-[#0a1018] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#92ffe7] focus:bg-[#0d1520]"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
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
      className="h-12 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
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
    <div className="rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function Status({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#92ffe7]/15 bg-[#92ffe7]/8 px-4 py-3 text-sm text-[#e0fff7]">
      {text}
    </div>
  );
}

function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const injectedConnector = connectors[0];

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="w-full rounded-2xl bg-[linear-gradient(135deg,#b7fff1_0%,#84ffe2_40%,#3ae0b6_100%)] px-4 py-3 text-sm font-semibold text-[#04120e] shadow-[0_18px_40px_rgba(61,239,193,0.3)] transition hover:scale-[1.01]"
      >
        {`${address.slice(0, 6)}...${address.slice(-4)} / Disconnect`}
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

export default function Page() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();

  const tipsAddress = (CONTRACTS.tips ?? zeroAddress) as Address;
  const hasTipsContract = Boolean(CONTRACTS.tips);

  const [tab, setTab] = useState<"rewards" | "payment">("rewards");

  const [tipToken, setTipToken] = useState<TokenSymbol>("USDC");
  const [tipPostUrl, setTipPostUrl] = useState("");
  const [tipRecipientHandle, setTipRecipientHandle] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [tipStatus, setTipStatus] = useState("");
  const [tipApproved, setTipApproved] = useState(false);
  const [createdTipId, setCreatedTipId] = useState<bigint | null>(null);

  const [claimTipId, setClaimTipId] = useState("");
  const [claimTweetUrl, setClaimTweetUrl] = useState("");
  const [claimStatus, setClaimStatus] = useState("");
  const [verifiedSignature, setVerifiedSignature] = useState<`0x${string}` | null>(null);
  const [verifiedSigDeadline, setVerifiedSigDeadline] = useState<bigint | null>(null);
  const [verifiedTipId, setVerifiedTipId] = useState<bigint | null>(null);
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

  const numericClaimTipId = useMemo(() => {
    try {
      return claimTipId ? BigInt(claimTipId) : 0n;
    } catch {
      return 0n;
    }
  }, [claimTipId]);

  const announcementTweetText =
    tipRecipientHandle && createdTipId !== null
      ? makeRewardAnnouncementText({
          recipientHandle: tipRecipientHandle,
          message: tipMessage,
          tipId: createdTipId,
        })
      : "";

  const announcementTweetIntentUrl =
    tipRecipientHandle && createdTipId !== null
      ? makeRewardAnnouncementIntentUrl({
          recipientHandle: tipRecipientHandle,
          message: tipMessage,
          tipId: createdTipId,
        })
      : "#";

  const claimProof =
    numericClaimTipId > 0n
      ? makeClaimProof(numericClaimTipId)
      : "";

  const claimTweetText = claimProof ? makeProofTweetText(claimProof) : "";
  const claimTweetIntentUrl = claimProof ? makeProofTweetIntentUrl(claimProof) : "#";

  const { data: claimTipData, refetch: refetchClaimTipData } = useReadContract({
    address: tipsAddress,
    abi: arcFlowTipsAbi,
    functionName: "getTip",
    args: [numericClaimTipId],
    query: {
      enabled: hasTipsContract && numericClaimTipId > 0n,
    },
  });

  const parsedClaimTipData = useMemo(
    () => parseTipReadResult(claimTipData),
    [claimTipData],
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
    setTipApproved(false);
  }, [tipAmount, tipToken, address]);

  useEffect(() => {
    setVerifiedSignature(null);
    setVerifiedSigDeadline(null);
    setVerifiedTipId(null);
  }, [claimTipId, claimTweetUrl, address, xUsername]);

  async function ensureArc() {
    if (chainId !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }
  }

  async function disconnectX() {
    await fetch("/api/x/logout", { method: "POST" });
    setXUsername(null);
  }

  async function approveTipToken() {
    try {
      if (!CONTRACTS.tips) {
        throw new Error("NEXT_PUBLIC_TIPS_CONTRACT is still empty in .env.local.");
      }
      if (!parsedTipAmount) throw new Error("Enter a valid amount.");

      setTipStatus(`Approving ${tipToken}...`);
      await ensureArc();

      const hash = await writeContractAsync({
        address: selectedTipToken.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [tipsAddress, parsedTipAmount],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      setTipApproved(true);
      setTipStatus(`${tipToken} approved.`);
    } catch (error) {
      setTipStatus(error instanceof Error ? error.message : "Approval failed.");
    }
  }

  async function createTip() {
    try {
      if (!CONTRACTS.tips) {
        throw new Error("NEXT_PUBLIC_TIPS_CONTRACT is still empty in .env.local.");
      }
      if (!parsedTipAmount) throw new Error("Enter a valid amount.");
      if (!tipApproved) throw new Error(`Approve ${tipToken} first.`);
      if (!tipPostUrl.trim()) throw new Error("Paste a tweet URL.");

      const handle = normalizeHandle(tipRecipientHandle);
      if (!handle) throw new Error("Enter the X handle.");

      setTipStatus("Creating reward...");
      await ensureArc();

      const claimDeadline = BigInt(
        Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      );

      const hash = await writeContractAsync({
        address: tipsAddress,
        abi: arcFlowTipsAbi,
        functionName: "createTip",
        args: [
          tipPostUrl.trim(),
          handle,
          selectedTipToken.address,
          parsedTipAmount,
          claimDeadline,
        ],
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      let createdTipId: bigint | null = null;

      for (const log of receipt?.logs ?? []) {
        try {
          const decoded = decodeEventLog({
            abi: [
              {
                type: "event",
                name: "TipCreated",
                inputs: [
                  { indexed: true, name: "tipId", type: "uint256" },
                  { indexed: true, name: "tipper", type: "address" },
                  { indexed: true, name: "token", type: "address" },
                  { indexed: false, name: "amount", type: "uint256" },
                  { indexed: false, name: "postUrl", type: "string" },
                  { indexed: false, name: "recipientHandle", type: "string" },
                  { indexed: false, name: "claimDeadline", type: "uint64" },
                ],
              },
            ],
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "TipCreated") {
            createdTipId = decoded.args.tipId;
            break;
          }
        } catch {
          // ignore unrelated logs
        }
      }

      if (createdTipId !== null) {
        setCreatedTipId(createdTipId);
        setClaimTipId(createdTipId.toString());
        setTipApproved(false);
        setTipStatus(`Reward created. Tip ID: ${createdTipId.toString()}`);
        const tweetUrl = makeRewardAnnouncementIntentUrl({
          recipientHandle: handle,
          message: tipMessage,
          tipId: createdTipId,
        });
        window.open(tweetUrl, "_blank", "noopener,noreferrer");
      } else {
        setTipStatus("Reward created. Check ArcScan for the TipCreated event.");
      }
    } catch (error) {
      setTipStatus(error instanceof Error ? error.message : "Reward failed.");
    }
  }

  async function verifyClaimTip() {
    try {
      if (!address) throw new Error("Connect wallet first.");
      if (!CONTRACTS.tips) {
        throw new Error("NEXT_PUBLIC_TIPS_CONTRACT is still empty in .env.local.");
      }
      if (!claimTipId) throw new Error("Enter a tip ID.");
      if (!claimTweetUrl.trim()) throw new Error("Paste the proof tweet URL.");

      setClaimStatus("Verifying proof tweet...");
      await ensureArc();

      const verifyResponse = await fetch("/api/verify-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipId: claimTipId,
          recipient: address,
          tweetUrl: claimTweetUrl.trim(),
        }),
      });

      const verifyJson = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyJson.error || "Verification failed.");
      }

      setVerifiedSignature(verifyJson.signature);
      setVerifiedSigDeadline(BigInt(verifyJson.sigDeadline));
      setVerifiedTipId(BigInt(claimTipId));
      setClaimStatus("Verified. Claim is ready.");
    } catch (error) {
      setClaimStatus(error instanceof Error ? error.message : "Verification failed.");
    }
  }

  async function claimVerifiedTip() {
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

      const hash = await writeContractAsync({
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
      await refetchClaimTipData();
      setVerifiedSignature(null);
      setVerifiedSigDeadline(null);
      setVerifiedTipId(null);
      setClaimStatus("Claim completed.");
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

      const hash = await writeContractAsync({
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
      <section className="relative mb-6 overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,12,20,0.98),rgba(4,6,10,0.98))] p-5 shadow-[0_48px_120px_rgba(0,0,0,0.58)] sm:p-7">
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
                Social rewards on Arc with a public @arc proof flow. Direct payments stay simple, clean, and onchain.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:w-[360px] xl:items-end">
              <WalletButton />
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
                  value={chainId === arcTestnet.id ? "Arc Testnet" : "Switch Required"}
                />
                <Stat label="Assets" value="USDC / EURC" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <NavButton active={tab === "rewards"} onClick={() => setTab("rewards")}>
              Rewards
            </NavButton>
            <NavButton active={tab === "payment"} onClick={() => setTab("payment")}>
              Send Payment
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
        <section className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
          <div className="space-y-6">
            <Panel
              title="Create Reward"
              subtitle="Lock USDC or EURC to an X handle. Add your own message and let ArcFlow handle the proof flow."
            >
              <div className="grid gap-4">
                <div>
                  <Label title="Tweet URL" />
                  <Input
                    placeholder="https://x.com/user/status/123..."
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

                <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#0d131c,#091019)] p-4">
                  <Label
                    title="Optional Sender Announcement"
                    helper={
                      announcementTweetText ? (
                        <Link
                          href={announcementTweetIntentUrl}
                          target="_blank"
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]"
                        >
                          Open X Compose
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
                    disabled={!isConnected || tipApproved}
                    className={`h-12 rounded-2xl px-4 text-sm font-semibold transition ${
                      tipApproved
                        ? "border border-white/10 bg-white/[0.05] text-slate-500"
                        : "bg-[linear-gradient(135deg,#b7fff1_0%,#84ffe2_40%,#3ae0b6_100%)] text-[#04120e] shadow-[0_18px_40px_rgba(61,239,193,0.3)] hover:scale-[1.01]"
                    } disabled:cursor-not-allowed disabled:hover:scale-100`}
                  >
                    Approve {tipToken}
                  </button>
                  <button
                    onClick={createTip}
                    disabled={!isConnected || !tipApproved}
                    className={`h-12 rounded-2xl px-4 text-sm font-semibold transition ${
                      tipApproved
                        ? "bg-[linear-gradient(135deg,#b7fff1_0%,#84ffe2_40%,#3ae0b6_100%)] text-[#04120e] shadow-[0_18px_40px_rgba(61,239,193,0.3)] hover:scale-[1.01]"
                        : "border border-white/10 bg-white/[0.03] text-slate-500"
                    } disabled:cursor-not-allowed disabled:hover:scale-100`}
                  >
                    Create Reward
                  </button>
                </div>

                {tipStatus ? <Status text={tipStatus} /> : null}
              </div>
            </Panel>

            <Panel
              title="Claim Reward"
              subtitle="Connect the correct X account, post the matching @arc proof tweet, then paste the tweet URL here for verification."
            >
              <div className="grid gap-4">
                <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#0d131c,#091019)] p-4">
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label title="Tip ID" />
                    <Input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={claimTipId}
                      onChange={(event) => setClaimTipId(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label title="Proof Tweet URL" />
                    <Input
                      placeholder="https://x.com/you/status/123..."
                      value={claimTweetUrl}
                      onChange={(event) => setClaimTweetUrl(event.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#0c1119,#0a0f17)] p-4">
                  <Label
                    title="Recipient Proof Tweet"
                    helper={
                      claimProof ? (
                        <Link
                          href={claimTweetIntentUrl}
                          target="_blank"
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]"
                        >
                          Open X Compose
                        </Link>
                      ) : null
                    }
                  />
                  <p className="font-mono text-xs leading-6 text-[#c8fff1]">
                    {claimTweetText ||
                      "Connect wallet and enter the tip ID to generate the recipient proof tweet."}
                  </p>
                </div>

                {parsedClaimTipData ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Stat label="Handle" value={`@${parsedClaimTipData.recipientHandle}`} />
                    <Stat
                      label="Amount"
                      value={`${formatUnits(parsedClaimTipData.amount, 6)} ${
                        parsedClaimTipData.token === TOKENS.USDC.address ? "USDC" : "EURC"
                      }`}
                    />
                    <Stat
                      label="Deadline"
                      value={formatTimestamp(parsedClaimTipData.claimDeadline)}
                    />
                    <Stat
                      label="State"
                      value={
                        parsedClaimTipData.refunded
                          ? "Refunded"
                          : parsedClaimTipData.claimed
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
                    onClick={claimVerifiedTip}
                    disabled={!isConnected || !xUsername || !verifiedSignature}
                  >
                    Claim
                  </PrimaryButton>
                </div>

                {claimStatus ? <Status text={claimStatus} /> : null}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="The ArcFlow Protocol">
              <div className="grid gap-3">
                <Stat label="1. Spot a Creator" value="Find a tweet or profile that deserves a reward." />
                <Stat label="2. Lock the Reward" value="Securely escrow USDC or EURC to their social handle." />
                <Stat label="3. Simple Verification" value="The recipient validates their handle with a single @arc proof." />
                <Stat label="4. Automated Payout" value="Smart contracts verify the proof and release the funds instantly." />
              </div>
            </Panel>

            <Panel title="Quick Links">
              <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
                <div className="grid gap-3">
                  <Link href="https://www.arc.network/" target="_blank" className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white transition hover:bg-white/[0.06]">
                    Arc Network
                  </Link>
                  <Link href="https://testnet.arcscan.app/" target="_blank" className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white transition hover:bg-white/[0.06]">
                    Arc Testnet Explorer
                  </Link>
                  <Link href="https://community.arc.network/" target="_blank" className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white transition hover:bg-white/[0.06]">
                    Arc Community
                  </Link>
                  <Link href="https://docs.arc.network/" target="_blank" className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white transition hover:bg-white/[0.06]">
                    Arc Docs
                  </Link>
                </div>
                <div className="flex min-h-[220px] items-end justify-start rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.09),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-5 lg:justify-end">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.42em] text-slate-500">
                      Powered by
                    </p>
                    <p className="mt-3 text-5xl font-medium tracking-[0.24em] text-white">
                      ARC
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
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
      )}
    </main>
  );
}
