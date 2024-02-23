export const SILO_NAMES_BY_CHAIN_ID = {
  '1313161560': 'powergold',
};

type SiloChainId = keyof typeof SILO_NAMES_BY_CHAIN_ID;
type SiloName = (typeof SILO_NAMES_BY_CHAIN_ID)[SiloChainId];

export function isSiloChainId(value: string): value is SiloChainId {
  return value in SILO_NAMES_BY_CHAIN_ID;
}

export function isSiloName(value: string): value is SiloName {
  return Object.values(SILO_NAMES_BY_CHAIN_ID).includes(value);
}

export const NETWORK_NAMES_BY_CHAIN_ID: { [id: number]: string } = {
  1: 'mainnet',
  3: 'ropsten',
  4: 'rinkeby',
  5: 'goerli',
  42: 'kovan',
  11155111: 'sepolia',
  10: 'optimistic',
  69: 'kovan-optimistic',
  42161: 'arbitrum',
  421611: 'rinkeby-arbitrum',
  137: 'polygon',
  80001: 'mumbai-polygon',
  100: 'xdai',
  99: 'poa', // not presently supported by either fetcher, but...
  77: 'sokol-poa',
  56: 'binance',
  97: 'testnet-binance',
  42220: 'celo',
  44787: 'alfajores-celo',
  62320: 'baklava-celo',
  43114: 'avalanche',
  43113: 'fuji-avalanche',
  40: 'telos',
  41: 'testnet-telos',
  8: 'ubiq',
  311752642: 'oneledger', // not presently supported by either fetcher, but...
  4216137055: 'frankenstein-oneledger',
  57: 'syscoin',
  5700: 'tanenbaum-syscoin',
  288: 'boba',
  28: 'rinkeby-boba',
  106: 'velas',
  82: 'meter',
  83: 'testnet-meter',
  1313161554: 'aurora',
  1313161555: 'testnet-aurora',
  1313161560: 'powergold',
  250: 'fantom',
  4002: 'testnet-fantom',
  128: 'heco',
  256: 'testnet-heco',
  1284: 'moonbeam',
  1285: 'moonriver',
  1287: 'moonbase-alpha',
  122: 'fuse',
  11297108109: 'palm',
  11297108099: 'testnet-palm',
  70: 'hoo',
  25: 'cronos',
  338: 'testnet-cronos',
  199: 'bttc',
  1029: 'donau-bttc',
  1024: 'clover',
};

export interface NetworkInfo {
  name: string;
  networkId: number;
  chainId: number;
}

export const NETWORKS_BY_NAME = Object.fromEntries<NetworkInfo>(
  Object.entries(NETWORK_NAMES_BY_CHAIN_ID).map(
    ([id, name]) => [
      name,
      { name, networkId: Number(id), chainId: Number(id) },
    ], // id is a string since it's a key so must use Number()
  ),
);
