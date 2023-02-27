# pnft-protocol

pNFT is an open-source NFT perpetual futures DEX (decentralized exchange), that allows traders and speculators who love NFT assets to go long or short by leveraging NFT floor prices.
The platform is fully decentralized, supported by Arbitrum—the fast and inexpensive L2 scaling solution. With security measures inherited from the Ethereum blockchain.

## How does pnft work?
![how-does-pnft-work](https://1916212504-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FCHOhb5RdFI5IQeYuNUzj%2Fuploads%2F2ALM2UVr419TTuRyEp4u%2FpNFT-Gitbook-01.png?alt=media&token=a017338f-c5b5-44fa-9777-83697691b86d)

## Smart contracts
This repository contains the smart contracts for PNFT Protocol.
- /contracts : source code smart contract
- /deploy : script deploy 
- /test : test scripts

### Local Development
You need Node.js 16+ to build. Use nvm to install it.

Clone this repository, install Node.js dependencies, and build the source code:

npm i
npm run build
If the installation failed on your machine, please try a vanilla install instead:

npm run clean
rm -rf node_modules/
rm package-lock.json
npm install
npm run build
Run all the test cases:

npm run test

### Deployments
PNFT Protocol are deployed on Arbitrum  (an Ethereum Layer 2 network).

Contract addresses:
https://github.com/pnft-exchange/pnft-protocol/blob/main/deploy/testnet/address/deployed_arbitrumGoerli.json (Arbitrum Goerli testnet)

### Documents
Please check out the document in  [gitbook](https://whitepaper.pnft.exchange/pnft/overview/pnft-in-a-nutshell)
