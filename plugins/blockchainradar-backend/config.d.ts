export interface Config {
  blockchain: {
    etherscan: {
      'ethereum-mainnet': {
        network: string;
        /**
         * Etherscan API key
         * @visibility secret
         */
        apiKey: string;
      };
      'ethereum-goerli': {
        network: string;
        /**
         * Etherscan API key for goerli
         * @visibility secret
         */
        apiKey: string;
      };
      'aurora-mainnet': {
        network: string;
        /**
         * Blockscout API key for aurora
         * @visibility secret
         */
        apiKey: string;
      };
    };
    rbac: {
      'ethereum-mainnet': string;
      'aurora-mainnet': string;
    };
  };
}
