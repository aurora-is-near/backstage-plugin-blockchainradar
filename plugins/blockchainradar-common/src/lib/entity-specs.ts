// dedicated function - serialization is likely to change in the future
export function isFullAccessKey(permissions: string) {
  return permissions === '"FullAccess"';
}

export type CacheableSpec = {
  fetchDate: number;
};

export type ContractSourceSpec = CacheableSpec & {
  abi: string;
  sourceCodeVerified: boolean;
  contractName: string;
  sourceFiles: string[];
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
