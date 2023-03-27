import { MockContract } from "@eth-optimism/smock"
import { expect } from "chai"
import { parseEther, parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { ClearingHouseConfig, MarketRegistry, TestERC20, VirtualToken, NFTOracle, UniswapV3Pool, Vault } from "../../../typechain"
import { ClearingHouseFixture, createClearingHouseFixture } from "../fixtures"
import { initMarket } from "../../helper/marketHelper"
describe("Vault deposit test", () => {
    const [admin, maker, taker, alice, bob] = waffle.provider.getWallets()
    const loadFixture: ReturnType<typeof waffle.createFixtureLoader> = waffle.createFixtureLoader([admin])
    let vault: Vault
    let weth: TestERC20
    let wethPriceFeed: MockContract
    let clearingHouseConfig: ClearingHouseConfig
    let pool: UniswapV3Pool
    let collateralDecimals: number
    let fixture: ClearingHouseFixture
    let baseToken: VirtualToken
    let nftOracle: NFTOracle
    let marketRegistry: MarketRegistry
    const initPrice = "63.86"

    beforeEach(async () => {
        fixture = await loadFixture(createClearingHouseFixture())
        vault = fixture.vault
        weth = fixture.WETH
        wethPriceFeed = fixture.mockedWethPriceFeed
        clearingHouseConfig = fixture.clearingHouseConfig
        pool = fixture.pool
        fixture = fixture
        baseToken = fixture.baseToken
        collateralDecimals = await weth.decimals()
        nftOracle = fixture.nftOracle
        marketRegistry = fixture.marketRegistry
        const amount = parseUnits("1000", collateralDecimals)
        await weth.mint(alice.address, amount)

        await weth.connect(alice).approve(vault.address, ethers.constants.MaxUint256)

        await initMarket(fixture, initPrice, undefined, 0)

        await nftOracle.setNftPrice((await marketRegistry.getNftContract(baseToken.address)), parseUnits(initPrice, 18))
    })

    describe("settlement token", async () => {

        it("deposit settlement token", async () => {
            const amount = parseUnits("100", collateralDecimals)

            // check event has been sent
            await expect(vault.connect(alice).deposit(weth.address, amount, baseToken.address))
                .to.emit(vault, "Deposited")
                .withArgs(weth.address, alice.address, amount, baseToken.address)

            // reduce alice balance
            expect(await weth.balanceOf(alice.address)).to.eq(parseUnits("900", collateralDecimals))

            // increase vault balance
            expect(await weth.balanceOf(vault.address)).to.eq(amount)

            // update sender's balance
            expect(await vault.getBalance(alice.address, baseToken.address)).to.eq(amount)
        })

        it("deposit settlement token for others", async () => {
            const amount = parseUnits("100", collateralDecimals)

            await expect(vault.connect(alice).depositFor(bob.address, weth.address, amount, baseToken.address))
                .to.emit(vault, "Deposited")
                .withArgs(weth.address, bob.address, amount, baseToken.address)

            // reduce alice balance
            expect(await weth.balanceOf(alice.address)).to.eq(parseUnits("900", collateralDecimals))

            // alice's vault balance not changed
            expect(await vault.getBalance(alice.address, baseToken.address)).to.be.eq(parseUnits("0", await weth.decimals()))

            // increase vault balance
            expect(await weth.balanceOf(vault.address)).to.eq(amount)

            // update bob's balance
            expect(await vault.getBalance(bob.address, baseToken.address)).to.eq(amount)

            // bob's weth balance not changed
            expect(await weth.balanceOf(bob.address)).to.be.eq("0")
        })

        it("should be able to deposit for alice herself", async () => {
            const amount = parseUnits("100", await weth.decimals())
            await vault.connect(alice).depositFor(alice.address, weth.address, amount, baseToken.address)

            const aliceBalance = await vault.getBalance(alice.address, baseToken.address)
            const alicewethBalanceAfter = await weth.balanceOf(alice.address)

            // reduce alice's weth balance
            expect(alicewethBalanceAfter).to.be.eq(parseUnits("900", await weth.decimals()))

            // increase alice's vault balance
            expect(aliceBalance).to.be.eq(amount)

            // increase vault balance
            expect(await weth.balanceOf(vault.address)).to.eq(parseUnits("100", await weth.decimals()))
        })

        it("force error, not enough balance", async () => {
            const amount = parseUnits("1100", await weth.decimals())
            await expect(vault.connect(alice).deposit(weth.address, amount, baseToken.address)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance",
            )
            await expect(vault.connect(alice).depositFor(bob.address, weth.address, amount, baseToken.address)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance",
            )
        })

        it("force error, inconsistent vault balance with deflationary token", async () => {
            weth.setTransferFeeRatio(50)
            await expect(
                vault.connect(alice).deposit(weth.address, parseUnits("100", collateralDecimals), baseToken.address),
            ).to.be.revertedWith("V_IBA")
            weth.setTransferFeeRatio(0)
        })

        it("force error, deposit for zero address", async () => {
            const amount = parseUnits("1000", await weth.decimals())
            await expect(
                vault.connect(alice).depositFor(ethers.constants.AddressZero, weth.address, amount, baseToken.address),
            ).to.be.revertedWith("V_DFZA")
        })

        it("force error, zero amount", async () => {
            await expect(vault.connect(alice).deposit(weth.address, "0", baseToken.address)).to.be.revertedWith("V_ZA")
            await expect(vault.connect(alice).depositFor(bob.address, weth.address, "0", baseToken.address)).to.be.revertedWith("V_ZA")
        })

        describe("settlement token balance cap", async () => {
            beforeEach(async () => {
                await clearingHouseConfig.setSettlementTokenBalanceCap(100)
            })

            it("force error, when it's over settlementTokenBalanceCap", async () => {
                await expect(vault.connect(alice).deposit(weth.address, 101, baseToken.address)).to.be.revertedWith("V_GTSTBC")
            })

            it("force error, when the the total balance is over cap", async () => {
                await expect(vault.connect(alice).deposit(weth.address, 100, baseToken.address)).not.be.reverted
                await expect(vault.connect(alice).deposit(weth.address, 1, baseToken.address)).to.be.revertedWith("V_GTSTBC")
            })

            it("can deposit if balanceOf(vault) <= settlementTokenBalanceCap after deposited", async () => {
                await expect(vault.connect(alice).deposit(weth.address, 99, baseToken.address)).not.be.reverted
            })

            it("force error, cannot deposit when settlementTokenBalanceCap == 0", async () => {
                await clearingHouseConfig.setSettlementTokenBalanceCap(0)
                await expect(vault.connect(alice).deposit(weth.address, 1, baseToken.address)).to.be.revertedWith("V_GTSTBC")
                await expect(vault.connect(alice).deposit(weth.address, 101, baseToken.address)).to.be.revertedWith("V_GTSTBC")
            })
        })
    })

})
