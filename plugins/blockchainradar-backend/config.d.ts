type EtherscanConfig = {
  network: string;
  apiKey: string;
}

export interface Config {
  blockchain: {
    etherscan: {
      /**
       * Etherscan API key
       * @visibility secret
       */
      'ethereum-mainnet': EtherscanConfig;
      /**
       * Etherscan API key for goerli
       * @visibility secret
       */
      'ethereum-goerli': EtherscanConfig;
      /**
       * Blockscout API key for aurora
       * @visibility secret
       */
      'aurora-mainnet': EtherscanConfig;
    };
  };
}
