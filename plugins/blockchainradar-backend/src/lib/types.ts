import { Entity } from '@backstage/catalog-model';
import { BlockchainAdapter } from '../adapters/BlockchainAdapter';
import {
  BlockchainAddressEntity,
  isBlockchainAddress,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

export interface NetworkInfo {
  name: string;
  networkId: number;
  chainId: number;
}

// apologies for this being stringly-typed, but that's how
// Etherscan does it
export interface EtherscanResult {
  SourceCode: string; // really: string | SolcSources | SolcInput
  ABI: string; // really: it's the ABI [we won't use this]
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string; // really: a number used as a boolean
  Runs: string; // really: a number
  ConstructorArguments: string; // encoded as hex string, no 0x in front
  EVMVersion: string;
  Library: string; // semicolon-delimited list of colon-delimited name-address pairs (addresses lack 0x in front)
  LicenseType: string; // ignored
  Proxy: string; // no clue what this is [ignored]
  Implementation: string; // or this [ignored]
  SwarmSource: string; // ignored
}

export interface SupportedNetworks {
  [name: string]: NetworkInfo;
}

export interface FetcherOptions {
  apiKey?: string;
}

export interface SourceInfo {
  contractName?: string;
  sources: SourcesByPath;
  options: CompilerOptions;
  etherScanResult: EtherscanResult;
}

export interface SourcesByPath {
  [sourcePath: string]: string;
}

// apologies if reinventing the wheel here
export type CompilerOptions = SolcOptions | VyperOptions; // note: only Solidity really supported atm

export interface SolcOptions {
  language: 'Solidity' | 'Yul'; // again, only Solidity really supported atm
  version: string;
  settings: SolcSettings;
  specializations: SolcSpecializations;
}

export interface VyperOptions {
  language: 'Vyper';
  version: string;
  settings: VyperSettings;
  specializations: VyperSpecializations;
}

// only including settings that would alter compiled result
// (no outputSelection, no modelChecker once that exists, no stopAfter)
export interface SolcSettings {
  remappings?: string[];
  optimizer?: OptimizerSettings;
  evmVersion?: string; // not gonna enumerate these
  debug?: DebugSettings;
  metadata?: MetadataSettings;
  viaIR?: boolean;
  libraries?: LibrarySettings; // note: we don't actually want to return this!
  compilationTarget?: {
    // not actually a valid compiler setting, but rather where the
    // contract name is stored! (as the lone value, the lone key being the source
    // where it's defined)
    [sourcePath: string]: string;
  };
}

export interface VyperSettings {
  evmVersion?: string; // not gonna enumerate these
  optimize?: boolean; // warning: the Vyper compiler treats this as true if it's not specified!
  // also Etherscan currently doesn't support this flag; any Vyper contract currently
  // verified on Etherscan necessarily has this field unspecified (and thus effectively true)
}

export interface SolcSpecializations {
  libraries?: LibrarySettings;
  constructorArguments?: string; // encoded, as hex string, w/o 0x in front
}

export interface VyperSpecializations {
  constructorArguments?: string; // encoded, as hex string, w/o 0x in front
}

export interface SolcSources {
  [sourcePath: string]: {
    keccak256?: string;
    content?: string; // for Etherscan we assume this exists
    urls?: string;
  };
}

export interface SolcInput {
  language: 'Solidity';
  sources: SolcSources;
  settings: SolcSettings;
}

export interface SolcMetadata {
  language: 'Solidity' | 'Yul';
  compiler: {
    version: string;
  };
  settings: SolcSettings;
  sources: SolcSources;
  version: number;
  // there's also output, but we don't care about that
}

export interface LibrarySettings {
  [contractPath: string]: Libraries;
}

export interface Libraries {
  [libraryName: string]: string;
}

export interface MetadataSettings {
  useLiteralContent?: boolean;
  bytecodeHash?: 'none' | 'ipfs' | 'bzzr1';
}

export interface DebugSettings {
  revertStrings?: 'default' | 'strip' | 'debug' | 'verboseDebug';
}

export interface OptimizerSettings {
  enabled?: boolean;
  runs?: number;
  details?: OptimizerDetails;
}

export interface OptimizerDetails {
  peephole?: boolean;
  jumpdestRemover?: boolean;
  orderLiterals?: boolean;
  deduplicate?: boolean;
  cse?: boolean;
  constantOptimizer?: boolean;
  yul?: boolean;
  yulDetails?: YulDetails;
}

export interface YulDetails {
  stackAllocation?: boolean;
  optimizerSteps?: string;
}

export function isValidBlockchainAddress(
  entity: Entity,
  adapter: BlockchainAdapter,
): entity is BlockchainAddressEntity {
  return (
    isBlockchainAddress(entity) && adapter.isValidAddress(entity.spec.address)
  );
}
