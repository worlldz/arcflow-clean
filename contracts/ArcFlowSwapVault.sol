// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArcFlowSwapVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable usdc;
    address public immutable eurc;
    uint16 public feeBps = 30;

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event FeeUpdated(uint16 feeBps);

    constructor(
        address initialOwner,
        address usdc_,
        address eurc_
    ) Ownable(initialOwner) {
        require(usdc_ != address(0) && eurc_ != address(0), "Token required");
        usdc = usdc_;
        eurc = eurc_;
    }

    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= 100, "Fee too high");
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function previewSwap(
        address tokenIn,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        require(tokenIn == usdc || tokenIn == eurc, "Unsupported token");
        require(amountIn > 0, "Amount required");

        amountOut = (amountIn * (10_000 - feeBps)) / 10_000;
    }

    function swap(
        address tokenIn,
        uint256 amountIn
    ) external nonReentrant returns (uint256 amountOut) {
        address tokenOut = tokenIn == usdc ? eurc : usdc;
        amountOut = previewSwap(tokenIn, amountIn);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function seed(address token, uint256 amount) external onlyOwner {
        require(token == usdc || token == eurc, "Unsupported token");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        require(token == usdc || token == eurc, "Unsupported token");
        require(to != address(0), "Recipient required");
        IERC20(token).safeTransfer(to, amount);
    }
}
