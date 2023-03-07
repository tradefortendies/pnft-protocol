import { expect } from "chai"
import { BigNumber } from "ethers"
import { ethers } from "hardhat"

describe("PerpMath test", async () => {
    const x96 = BigNumber.from(2).pow(96)
    const x10_18 = BigNumber.from(10).pow(18)
    const x10_6 = BigNumber.from(10).pow(6)
    const maxUint256 = BigNumber.from(2).pow(256).sub(1)
    const maxUint160 = BigNumber.from(2).pow(160).sub(1)
    const maxInt256 = BigNumber.from(2).pow(255).sub(1)
    const minInt256 = BigNumber.from(2).pow(255).mul(-1)
    const maxUint24 = BigNumber.from(2).pow(24).sub(1)

    let perpMath

    beforeEach(async () => {
        const perpMathF = await ethers.getContractFactory("TestPerpMath")
        perpMath = await perpMathF.deploy()
    })

    it("testCalculateLiquidity", async () => {
        let a = await perpMath.testCalculateLiquidity(BigNumber.from(10).pow(18).mul(5), x10_6.div(100), BigNumber.from(10).pow(16).mul(32))
        expect(a).to.be.deep.eq(BigNumber.from("1772175376705177874061"))
    })

})
