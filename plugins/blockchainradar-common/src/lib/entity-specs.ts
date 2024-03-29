// dedicated function - serialization is likely to change in the future
export function isFullAccessKey(permissions: string) {
  return permissions === '"FullAccess"';
}

export type SubgraphEntity = {
  id: string;
};

export type CacheableSpec = {
  fetchDate: number;
};

export type RbacSpec = CacheableSpec & {
  roles?: Array<any>;
  membership?: Array<any>;
};

export type ContractSourceSpec = CacheableSpec & {
  abi: string;
  sourceCodeVerified: boolean;
  contractName: string;
  sourceFiles: string[];
  startBlock: number; // block height of creation transaction
};

export type ContractStateSpec = CacheableSpec & {
  methods: Record<string, string>; // json serialized
  interactsWith: Record<string, string>;
};

export type NearKeysSpec = CacheableSpec & {
  keys: Record<string, string>; // public_key => json serialized permissions
};

export type ContractDeploymentSpec = {
  source?: ContractSourceSpec;
  state?: ContractStateSpec;
  rbac?: RbacSpec;
};

export type MultisigSpec = CacheableSpec & {
  policy: {
    owners: number;
    threshold: number;
  };
  version?: string;
};

export type SignerSpec = CacheableSpec & {
  lastSigned: number;
};
