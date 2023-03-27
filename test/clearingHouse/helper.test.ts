import { expect } from "chai"
import { BigNumber } from "ethers"
import { formatEther, parseEther } from "ethers/lib/utils"
import { ethers } from "hardhat"
import { encodeLiquidityPriceSlippedToBase, encodeLiquidityPriceSlippedToQuote } from "../shared/utilities"

describe("Helper test", async () => {
    beforeEach(async () => {
    })

    it("helper test", async () => {
        console.log(
            'encodeLiquidityPriceSlippedToQuote',
            formatEther(encodeLiquidityPriceSlippedToQuote(parseEther('120.93'), '100', 2).mul(95).div(100))
        )
        console.log(
            'encodeLiquidityPriceSlippedToBase',
            formatEther(encodeLiquidityPriceSlippedToBase(parseEther('120.93'), '100', 2).mul(95).div(100))
        )
    })

})
