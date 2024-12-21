interface NetworkConfig {
  /**
   * Network type, commonly 'mainnet', 'testnet'
   * @visibility frontend
   */
  type?: string;
  /**
   * Network chainId, required for EVM state digestion
   * @visibility frontend
   */
  chainId: string;
  /**
   * JSON-RPC endpoint, required for state digestion
   * @visibility frontend
   */
  rpcUrl: string;
  /**
   * Explorer API endpoint, required for source code digestion
   * @visibility frontend
   */
  explorerApiUrl: string;
  /**
   * Explorer API key, required for etherscan
   * @visibility secret
   */
  explorerApiKey?: string;
  /**
   * Explorer URL, used for displaying links
   * @visibility frontend
   */
  explorerUrl?: string;
  /**
   * Subgraph GraphQL endpoint, required for RBAC digestion on EVM networks
   * @visibility secret
   */
  subgraphUrl?: string;
}

export interface Config {
  blockchain: {
    [name: string]: NetworkConfig;
  };
}
