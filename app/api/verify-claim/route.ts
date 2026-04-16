import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createPublicClient,
  encodeAbiParameters,
  http,
  isAddress,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcFlowTipsAbi, makeClaimProof } from "../../../lib/contracts";
import { arcTestnet, CONTRACTS } from "../../../lib/wagmi";
import { X_USERNAME_COOKIE } from "../../../lib/x-auth";

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});

function parseTipReadResult(data: unknown) {
  if (!data) return null;

  if (Array.isArray(data)) {
    const [
      tipper,
      token,
      amount,
      postUrl,
      recipientHandle,
      createdAt,
      claimDeadline,
      claimed,
      refunded,
      recipient,
    ] = data;

    if (
      typeof tipper === "string" &&
      typeof token === "string" &&
      typeof amount === "bigint" &&
      typeof postUrl === "string" &&
      typeof recipientHandle === "string" &&
      typeof createdAt === "bigint" &&
      typeof claimDeadline === "bigint" &&
      typeof claimed === "boolean" &&
      typeof refunded === "boolean" &&
      typeof recipient === "string"
    ) {
      return {
        tipper,
        token,
        amount,
        postUrl,
        recipientHandle,
        createdAt,
        claimDeadline,
        claimed,
        refunded,
        recipient,
      };
    }
  }

  const record = data as {
    tipper?: string;
    token?: string;
    amount?: bigint;
    postUrl?: string;
    recipientHandle?: string;
    createdAt?: bigint;
    claimDeadline?: bigint;
    claimed?: boolean;
    refunded?: boolean;
    recipient?: string;
  };

  if (
    typeof record.tipper === "string" &&
    typeof record.token === "string" &&
    typeof record.amount === "bigint" &&
    typeof record.postUrl === "string" &&
    typeof record.recipientHandle === "string" &&
    typeof record.createdAt === "bigint" &&
    typeof record.claimDeadline === "bigint" &&
    typeof record.claimed === "boolean" &&
    typeof record.refunded === "boolean" &&
    typeof record.recipient === "string"
  ) {
    return record;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!CONTRACTS.tips) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_TIPS_CONTRACT is missing." },
        { status: 500 },
      );
    }

    const verifierPrivateKey = process.env.VERIFIER_PRIVATE_KEY as
      | `0x${string}`
      | undefined;

    if (!verifierPrivateKey) {
      return NextResponse.json(
        {
          error: "VERIFIER_PRIVATE_KEY is missing in .env.local.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const tipId = BigInt(body.tipId);
    const recipient = body.recipient as `0x${string}`;
    const store = await cookies();
    const connectedUsername = store.get(X_USERNAME_COOKIE)?.value;

    if (!isAddress(recipient)) {
      return NextResponse.json(
        { error: "Recipient wallet address is invalid." },
        { status: 400 },
      );
    }

    if (!connectedUsername) {
      return NextResponse.json(
        { error: "Connect X before claiming a reward." },
        { status: 401 },
      );
    }

    const rawTip = await (publicClient.readContract as any)({
      address: CONTRACTS.tips,
      abi: arcFlowTipsAbi,
      functionName: "getTip",
      args: [tipId],
    });

    const tip = parseTipReadResult(rawTip);

    if (!tip) {
      return NextResponse.json(
        { error: "Tip could not be parsed from contract response." },
        { status: 500 },
      );
    }

    if (!tip.tipper || tip.tipper === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Tip not found." }, { status: 404 });
    }

    if (tip.claimed) {
      return NextResponse.json(
        { error: "This tip has already been claimed." },
        { status: 400 },
      );
    }

    if (tip.refunded) {
      return NextResponse.json(
        { error: "This tip has already been refunded." },
        { status: 400 },
      );
    }

    const expectedHandle = String(tip.recipientHandle)
      .replace(/^@/, "")
      .toLowerCase();

    const proof = makeClaimProof(tipId);

    if (connectedUsername.replace(/^@/, "").toLowerCase() !== expectedHandle) {
      return NextResponse.json(
        {
          error:
            `Connected X account is @${connectedUsername}, but this reward is reserved for @${expectedHandle}.`,
        },
        { status: 400 },
      );
    }

    const sigDeadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
    const digest = keccak256(
      encodeAbiParameters(
        [
          { name: "contractAddress", type: "address" },
          { name: "chainId", type: "uint256" },
          { name: "tipId", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "sigDeadline", type: "uint64" },
        ],
        [CONTRACTS.tips, BigInt(arcTestnet.id), tipId, recipient, sigDeadline],
      ),
    );

    const verifierAccount = privateKeyToAccount(verifierPrivateKey);
    const signature = await verifierAccount.signMessage({
      message: { raw: digest },
    });

    return NextResponse.json({
      ok: true,
      signature,
      sigDeadline: Number(sigDeadline),
      proof,
      expectedHandle,
      authorUsername: connectedUsername,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
