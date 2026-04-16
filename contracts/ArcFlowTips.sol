// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract ArcFlowTips is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct Tip {
        address tipper;
        address token;
        uint256 amount;
        string postUrl;
        string recipientHandle;
        uint64 createdAt;
        uint64 claimDeadline;
        bool claimed;
        bool refunded;
        address recipient;
    }

    uint256 public nextTipId = 1;
    address public verifier;

    mapping(uint256 => Tip) private tips;
    mapping(address => bool) public supportedTokens;

    event TipCreated(
        uint256 indexed tipId,
        address indexed tipper,
        address indexed token,
        uint256 amount,
        string postUrl,
        string recipientHandle,
        uint64 claimDeadline
    );

    event TipClaimed(
        uint256 indexed tipId,
        address indexed recipient,
        address indexed token,
        uint256 amount
    );

    event TipRefunded(
        uint256 indexed tipId,
        address indexed tipper,
        address indexed token,
        uint256 amount
    );

    event VerifierUpdated(address indexed newVerifier);
    event SupportedTokenUpdated(address indexed token, bool supported);

    constructor(
        address initialOwner,
        address initialVerifier,
        address usdc,
        address eurc
    ) Ownable(initialOwner) {
        require(initialVerifier != address(0), "Verifier required");
        require(usdc != address(0) && eurc != address(0), "Token required");

        verifier = initialVerifier;
        supportedTokens[usdc] = true;
        supportedTokens[eurc] = true;

        emit VerifierUpdated(initialVerifier);
        emit SupportedTokenUpdated(usdc, true);
        emit SupportedTokenUpdated(eurc, true);
    }

    function createTip(
        string calldata postUrl,
        string calldata recipientHandle,
        address token,
        uint256 amount,
        uint64 claimDeadline
    ) external nonReentrant returns (uint256 tipId) {
        require(supportedTokens[token], "Unsupported token");
        require(amount > 0, "Amount must be > 0");
        require(bytes(postUrl).length > 0, "Post URL required");
        require(bytes(recipientHandle).length > 0, "Handle required");
        require(bytes(recipientHandle).length <= 32, "Handle too long");
        require(
            claimDeadline > block.timestamp + 5 minutes,
            "Deadline too soon"
        );

        tipId = nextTipId++;

        tips[tipId] = Tip({
            tipper: msg.sender,
            token: token,
            amount: amount,
            postUrl: postUrl,
            recipientHandle: recipientHandle,
            createdAt: uint64(block.timestamp),
            claimDeadline: claimDeadline,
            claimed: false,
            refunded: false,
            recipient: address(0)
        });

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit TipCreated(
            tipId,
            msg.sender,
            token,
            amount,
            postUrl,
            recipientHandle,
            claimDeadline
        );
    }

    function claimTip(
        uint256 tipId,
        address recipient,
        uint64 sigDeadline,
        bytes calldata signature
    ) external nonReentrant {
        Tip storage tip = tips[tipId];

        require(tip.tipper != address(0), "Tip not found");
        require(!tip.claimed, "Already claimed");
        require(!tip.refunded, "Already refunded");
        require(recipient == msg.sender, "Recipient mismatch");
        require(block.timestamp <= tip.claimDeadline, "Claim window ended");
        require(block.timestamp <= sigDeadline, "Signature expired");

        bytes32 digest = _claimDigest(tipId, recipient, sigDeadline);
        address recoveredSigner = digest.toEthSignedMessageHash().recover(
            signature
        );
        require(recoveredSigner == verifier, "Invalid verifier signature");

        tip.claimed = true;
        tip.recipient = recipient;

        IERC20(tip.token).safeTransfer(recipient, tip.amount);

        emit TipClaimed(tipId, recipient, tip.token, tip.amount);
    }

    function refundExpiredTip(uint256 tipId) external nonReentrant {
        Tip storage tip = tips[tipId];

        require(tip.tipper != address(0), "Tip not found");
        require(msg.sender == tip.tipper, "Only tipper");
        require(!tip.claimed, "Already claimed");
        require(!tip.refunded, "Already refunded");
        require(block.timestamp > tip.claimDeadline, "Claim still active");

        tip.refunded = true;

        IERC20(tip.token).safeTransfer(tip.tipper, tip.amount);

        emit TipRefunded(tipId, tip.tipper, tip.token, tip.amount);
    }

    function setVerifier(address newVerifier) external onlyOwner {
        require(newVerifier != address(0), "Verifier required");
        verifier = newVerifier;
        emit VerifierUpdated(newVerifier);
    }

    function setSupportedToken(address token, bool supported) external onlyOwner {
        require(token != address(0), "Token required");
        supportedTokens[token] = supported;
        emit SupportedTokenUpdated(token, supported);
    }

    function claimDigest(
        uint256 tipId,
        address recipient,
        uint64 sigDeadline
    ) external view returns (bytes32) {
        return _claimDigest(tipId, recipient, sigDeadline);
    }

    function getTip(
        uint256 tipId
    )
        external
        view
        returns (
            address tipper,
            address token,
            uint256 amount,
            string memory postUrl,
            string memory recipientHandle,
            uint64 createdAt,
            uint64 claimDeadline,
            bool claimed,
            bool refunded,
            address recipient
        )
    {
        Tip storage tip = tips[tipId];
        return (
            tip.tipper,
            tip.token,
            tip.amount,
            tip.postUrl,
            tip.recipientHandle,
            tip.createdAt,
            tip.claimDeadline,
            tip.claimed,
            tip.refunded,
            tip.recipient
        );
    }

    function _claimDigest(
        uint256 tipId,
        address recipient,
        uint64 sigDeadline
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encode(address(this), block.chainid, tipId, recipient, sigDeadline)
        );
    }
}
