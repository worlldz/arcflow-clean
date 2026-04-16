export const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const arcFlowTipsAbi = [
  {
    type: "function",
    name: "nextTipId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createTip",
    stateMutability: "nonpayable",
    inputs: [
      { name: "postUrl", type: "string" },
      { name: "recipientHandle", type: "string" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "claimDeadline", type: "uint64" },
    ],
    outputs: [{ name: "tipId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimTip",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tipId", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "sigDeadline", type: "uint64" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refundExpiredTip",
    stateMutability: "nonpayable",
    inputs: [{ name: "tipId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getTip",
    stateMutability: "view",
    inputs: [{ name: "tipId", type: "uint256" }],
    outputs: [
      { name: "tipper", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "postUrl", type: "string" },
      { name: "recipientHandle", type: "string" },
      { name: "createdAt", type: "uint64" },
      { name: "claimDeadline", type: "uint64" },
      { name: "claimed", type: "bool" },
      { name: "refunded", type: "bool" },
      { name: "recipient", type: "address" },
    ],
  },
] as const;

export const arcFlowSwapAbi = [
  {
    type: "function",
    name: "previewSwap",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export function makeClaimProof(tipId: bigint) {
  return `ARCFLOW-CLAIM-${tipId.toString()}`;
}

export function makeProofTweetText(proof: string) {
  return `@arc ${proof}`;
}

export function makeProofTweetIntentUrl(proof: string) {
  const text = makeProofTweetText(proof);
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

export function makeClaimCelebrationTweetText(handle?: string) {
  const cleanHandle = handle?.replace(/^@/, "");
  return cleanHandle
    ? `@arc Thanks for the reward ^^ Claimed on ArcFlow from @${cleanHandle}.`
    : "@arc Thanks for the reward ^^ Claimed on ArcFlow.";
}

export function makeClaimCelebrationIntentUrl(handle?: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(
    makeClaimCelebrationTweetText(handle),
  )}`;
}

export function makeRewardAnnouncementText({
  recipientHandle,
  message,
  tipId,
}: {
  recipientHandle: string;
  message: string;
  tipId: bigint;
}) {
  const cleanHandle = recipientHandle.replace(/^@/, "");
  const cleanMessage = message.trim() || "great content";
  return `@arc I'm sending a reward to @${cleanHandle} because of "${cleanMessage}" ARCFLOW-REWARD-${tipId.toString()}`;
}

export function makeRewardAnnouncementIntentUrl(input: {
  recipientHandle: string;
  message: string;
  tipId: bigint;
}) {
  return `https://x.com/intent/post?text=${encodeURIComponent(
    makeRewardAnnouncementText(input),
  )}`;
}
