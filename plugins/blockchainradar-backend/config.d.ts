export interface Config {
  blockchain: {
    etherscan: {
      /**
       * Etherscan API key
       * @visibility secret
       */
      'ethereum-mainnet': {
        network: string;
        apiKey: string;
      };
      /**
       * Etherscan API key for goerli
       * @visibility secret
       */
      'ethereum-goerli': {
        network: string;
        apiKey: string;
      };
      /**
       * Blockscout API key for aurora
       * @visibility secret
       */
      'aurora-mainnet': {
        network: string;
        apiKey: string;
      };
    };
  };
}
