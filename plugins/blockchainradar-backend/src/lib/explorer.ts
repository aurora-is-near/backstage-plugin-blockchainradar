import Web3Utils from 'web3-utils';

const etherscanCommentHeader = `/**
 *Submitted for verification at Etherscan.io on 20XX-XX-XX
*/
`; // note we include that final newline

export function processSingleResult(result: UnifiedSourceResponse): SourceInfo {
  const filename = makeFilename(result.contractName);
  return {
    explorerResult: result,
    contractName: result.contractName,
    sources: {
      // we prepend this header comment so that line numbers in the debugger
      // will match up with what's displayed on the website; note that other
      // cases don't display a similar header on the website
      [filename]: etherscanCommentHeader + result.sourceCode,
    },
    options: {
      language: 'Solidity',
      version: result.compilerVersion,
      settings: extractSettings(result),
      specializations: {
        libraries: processLibraries(result.libraries),
        constructorArguments: result.contructorArguments,
      },
    },
  };
}

export function processMultiResult(
  result: UnifiedSourceResponse,
  sources: SolcSources,
): SourceInfo {
  return {
    explorerResult: result,
    contractName: result.contractName,
    sources: processSources(sources),
    options: {
      language: 'Solidity',
      version: result.compilerVersion,
      settings: extractSettings(result),
      specializations: {
        libraries: processLibraries(result.libraries),
        constructorArguments: result.contructorArguments,
      },
    },
  };
}

export function processJsonResult(
  result: UnifiedSourceResponse,
  jsonInput: SolcInput,
): SourceInfo {
  return {
    explorerResult: result,
    contractName: result.contractName,
    sources: processSources(jsonInput.sources),
    options: {
      language: jsonInput.language,
      version: result.compilerVersion,
      settings: removeLibraries(jsonInput.settings), // we *don't* want to pass library info!  unlinked bytecode is better!
      specializations: {
        libraries: jsonInput.settings.libraries,
        constructorArguments: result.contructorArguments,
      },
    },
  };
}

export function processVyperResult(result: UnifiedSourceResponse): SourceInfo {
  const filename = makeFilename(result.contractName, '.vy');
  // note: this means filename will always be Vyper_contract.vy
  return {
    explorerResult: result,
    sources: {
      [filename]: result.sourceCode,
    },
    options: {
      language: 'Vyper',
      version: result.compilerVersion.replace(/^vyper:/, ''),
      settings: extractVyperSettings(result),
      specializations: {
        constructorArguments: result.contructorArguments,
      },
    },
  };
}
function extractVyperSettings(result: UnifiedSourceResponse): VyperSettings {
  const evmVersion =
    result.evmVersion === 'Default' ? undefined : result.evmVersion;
  // the optimize flag is not currently supported by etherscan;
  // any Vyper contract currently verified on etherscan necessarily has
  // optimize flag left unspecified (and therefore effectively true).
  // do NOT look at OptimizationUsed for Vyper contracts; it will always
  // be "0" even though in fact optimization *was* used.  just leave
  // the optimize flag unspecified.
  if (evmVersion !== undefined) {
    return { evmVersion };
  }
  return {};
}

function extractSettings(result: UnifiedSourceResponse): SolcSettings {
  const evmVersion =
    result.evmVersion === 'Default' ? undefined : result.evmVersion;
  const optimizer = {
    enabled: result.optimizationEnabled,
    runs: result.optimizationRuns,
  };
  // old version got libraries here, but we don't actually want that!
  if (evmVersion !== undefined) {
    return {
      optimizer,
      evmVersion,
    };
  }
  return {
    optimizer,
  };
}

function processLibraries(
  librariesString: string | undefined,
): LibrarySettings {
  let libraries: Libraries;
  if (!librariesString || librariesString === '') {
    libraries = {};
  } else {
    libraries = Object.assign(
      {},
      ...librariesString.split(';').map(pair => {
        const [name, address] = pair.split(':');
        return { [name]: Web3Utils.toChecksumAddress(address) };
      }),
    );
  }
  return { '': libraries }; // empty string as key means it applies to all contracts
}

function processSources(sources: SolcSources): SourcesByPath {
  return Object.assign(
    {},
    ...Object.entries(sources).map(([path, { content: source }]) => ({
      [makeFilename(path)]: source,
    })),
  );
}

function makeFilename(name: string, extension: string = '.sol'): string {
  if (!name) {
    return `Contract${extension}`;
  }
  if (name.endsWith(extension)) {
    return name;
  }
  return name + extension;
}

function removeLibraries(
  settings: SolcSettings,
  alsoRemoveCompilationTarget: boolean = false,
): SolcSettings {
  const copySettings: SolcSettings = { ...settings };
  delete copySettings.libraries;
  if (alsoRemoveCompilationTarget) {
    delete copySettings.compilationTarget;
  }
  return copySettings;
}

export interface UnifiedTransactionResponse {
  blockHash: string;
  blockNumber: number;
  timestamp: string;
  txStatus: string;
  confirmations: number;
}

export interface UnifiedSourceResponse {
  sourceCode: string;
  abi: string;
  contractName: string;
  compilerVersion: string;
  optimizationEnabled: boolean;
  optimizationRuns: number;
  contructorArguments: string;
  evmVersion: string;
  libraries: string | undefined;
  proxy: boolean | undefined;
  implementation: string | undefined;
}

export interface SourceInfo {
  contractName?: string;
  sources: SourcesByPath;
  options: CompilerOptions;
  explorerResult: UnifiedSourceResponse;
}

interface SourcesByPath {
  [sourcePath: string]: string;
}

// apologies if reinventing the wheel here
type CompilerOptions = SolcOptions | VyperOptions; // note: only Solidity really supported atm

interface SolcOptions {
  language: 'Solidity' | 'Yul'; // again, only Solidity really supported atm
  version: string;
  settings: SolcSettings;
  specializations: SolcSpecializations;
}

interface VyperOptions {
  language: 'Vyper';
  version: string;
  settings: VyperSettings;
  specializations: VyperSpecializations;
}

// only including settings that would alter compiled result
// (no outputSelection, no modelChecker once that exists, no stopAfter)
interface SolcSettings {
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

interface VyperSettings {
  evmVersion?: string; // not gonna enumerate these
  optimize?: boolean; // warning: the Vyper compiler treats this as true if it's not specified!
  // also Etherscan currently doesn't support this flag; any Vyper contract currently
  // verified on Etherscan necessarily has this field unspecified (and thus effectively true)
}

interface SolcSpecializations {
  libraries?: LibrarySettings;
  constructorArguments?: string; // encoded, as hex string, w/o 0x in front
}

interface VyperSpecializations {
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

interface LibrarySettings {
  [contractPath: string]: Libraries;
}

interface Libraries {
  [libraryName: string]: string;
}

interface MetadataSettings {
  useLiteralContent?: boolean;
  bytecodeHash?: 'none' | 'ipfs' | 'bzzr1';
}

interface DebugSettings {
  revertStrings?: 'default' | 'strip' | 'debug' | 'verboseDebug';
}

interface OptimizerSettings {
  enabled?: boolean;
  runs?: number;
  details?: OptimizerDetails;
}

interface OptimizerDetails {
  peephole?: boolean;
  jumpdestRemover?: boolean;
  orderLiterals?: boolean;
  deduplicate?: boolean;
  cse?: boolean;
  constantOptimizer?: boolean;
  yul?: boolean;
  yulDetails?: YulDetails;
}

interface YulDetails {
  stackAllocation?: boolean;
  optimizerSteps?: string;
}
