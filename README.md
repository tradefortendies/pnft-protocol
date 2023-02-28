# pnft-protocol

We are the first open-source NFT perpetual futures DEX. Our vision for pNFT is to build a platform that is totally decentralized, trustless & permissionless
### 1. Security 🛡️

With more people reviewing the code, potential vulnerabilities and security flaws are more likely to be identified and fixed quickly, making pNFT more secure overall

### 2. Transparency🦾

When a platform is open source, the source code is freely available for anyone to review and inspect. This means that users can verify that pNFT is doing what it claims to do, without relying on blind trust in the developers

### 3. Community🤝

Being an open-source platform, we would love to foster a community of developers, users, and supporters who are invested in the success of pNFT

Anyone in pNFT community can take ownership of the platform and help the platform grow over time

### 4. Trust❤️‍🔥

"Trust the code, don't trust the team" 

Humans, even the most skilled and trustworthy ones can make mistakes

By being open-source, the codes can be accessed and improved by anyone, aligning with pNFT's vision to be fully decentralized and trustless

### 5. A platform is only as strong as the community behind it 

Whether you're a trader, a developer or a web3 enthusiast, you can be the co-owners of pNFT platform and build the future together🤝

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
```
npm i
npm run build
```

If the installation failed on your machine, please try a vanilla install instead:
```
npm run clean
rm -rf node_modules/
rm package-lock.json
npm install
npm run build
```

Run all the test cases:
```
npm run test
```
### Deployments
PNFT Protocol are deployed on Arbitrum  (an Ethereum Layer 2 network).

Contract addresses:

https://github.com/pnft-exchange/pnft-protocol/blob/main/deploy/mainnet/address/deployed_arbitrum.json (Arbitrum mainet)

https://github.com/pnft-exchange/pnft-protocol/blob/main/deploy/testnet/address/deployed_arbitrumGoerli.json (Arbitrum Goerli testnet)

### Documents
Please check out the document in  [gitbook](https://whitepaper.pnft.exchange/pnft/overview/pnft-in-a-nutshell)
