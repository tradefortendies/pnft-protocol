import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { TestERC20, Vault, VirtualToken } from "../../typechain"
import { ClearingHouseFixture } from "../clearingHouse/fixtures"

export async function deposit(sender: Wallet, vault: Vault, amount: number, token: TestERC20, baseToken: VirtualToken): Promise<void> {
    const decimals = await token.decimals()
    const parsedAmount = parseUnits(amount.toString(), decimals)
    await token.connect(sender).approve(vault.address, parsedAmount)
    await vault.connect(sender).deposit(token.address, parsedAmount, baseToken.address)
}

export async function mintAndDeposit(fixture: ClearingHouseFixture, wallet: Wallet, amount: number, baseToken: VirtualToken): Promise<void> {
    const usdc = fixture.WETH
    const decimals = await usdc.decimals()
    await usdc.mint(wallet.address, parseUnits(amount.toString(), decimals))
    await deposit(wallet, fixture.vault, amount, usdc, baseToken)
}
