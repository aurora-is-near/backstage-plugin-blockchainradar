# @aurora-is-near/backstage-plugin-blockchain-backend

## 1.0.39

### Patch Changes

- 7db5d92: feat: implement rpc scoped mutex
- 3b7d31e: feat: use fastnear public rpc
- ff7d857: feat: remove entity level caching

## 1.0.38

### Patch Changes

- 1662cfb: feat: track full access keys only

## 1.0.37

### Patch Changes

- baf33b3: fix: skip unknown labeling for deprecated contracts

## 1.0.36

### Patch Changes

- 4b7b109: feat: support configurable rps and api key for nearblocks

## 1.0.35

### Patch Changes

- dc4eb45: feat: support team-owned access-keys
- Updated dependencies [5521fd5]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@1.0.35

## 1.0.34

### Patch Changes

- 0ff5f4d: fix: add subsequent request throttling to nearblocks/subgraphs

## 1.0.33

### Patch Changes

- 96e5dc0: fix: near multisig links
- ceec049: refactor: update near-contract-parser

## 1.0.32

### Patch Changes

- 3587f5f: fix: aurora vc rbac

## 1.0.31

### Patch Changes

- 98045d7: feat: add turbo support
- 9431b35: feat: add longer keyscheme support

## 1.0.30

### Patch Changes

- fff3d90: fix: source dao version from chain instead of API

## 1.0.29

### Patch Changes

- bbbba03: fix: aurora contract state digestion

## 1.0.28

### Patch Changes

- 57a1544: fix: correct rbac endpoint

## 1.0.27

### Patch Changes

- 2186945: feat: add rbac endpoint config support

## 1.0.26

### Patch Changes

- 21b964b: fix: ensure rbac member entity titles are more deterministic

## 1.0.25

### Patch Changes

- 1266555: feat: use static source location for RoleGroup entities

## 1.0.24

### Patch Changes

- a5be4c3: feat: accept aurora tld for near addresses

## 1.0.23

### Patch Changes

- 11cfe9c: fix: aurora mainnet explorer endpoint

## 1.0.22

### Patch Changes

- 06c63da: fix: patch deprecated signers

## 1.0.21

### Patch Changes

- 9b9fa92: feat: add generalized silo support

## 1.0.20

### Patch Changes

- 93e01dd: feat: add scoped cache support
- 3cc9b1e: feat: add prelim support for silos
- 18a32b7: refactor: cleanup backend types

## 1.0.19

### Patch Changes

- 6c759dc: perf: add delays between source requests

## 1.0.18

### Patch Changes

- 4d421c2: feat: add inheritable lifecycle for contracts

## 1.0.17

### Patch Changes

- 324ec19: feat: add super admins role group

## 1.0.16

### Patch Changes

- ab3bc8c: feat: add group owned address support
- Updated dependencies [ab3bc8c]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@1.0.16

## 1.0.15

### Patch Changes

- 672fa38: refactor: near deploy tx fetch

## 1.0.14

### Patch Changes

- 6f1b3ff: refactor: creation tx for aurora contract addresses

## 1.0.13

### Patch Changes

- 4f3c895: chore: make api key config secret

## 1.0.12

### Patch Changes

- fb72b7e: chore: fix config type for backend

## 1.0.11

### Patch Changes

- 9c13ca5: refactor: better type narrowing for blockchain adapters

## 1.0.10

### Patch Changes

- 16ee3db: fix: handle near deleted accounts

## 1.0.9

### Patch Changes

- c427e7b: feat: add goerli rbac support
- 83127d9: fix: goerli rbac subgraph endpoint
- 1ebcce4: refactor: cleanup etherscan types
- 567f4f3: fix: near signer last signature invalid timestamp

## 1.0.8

### Patch Changes

- 5db5491: fix: near source spec discovery

## 1.0.7

### Patch Changes

- b0628cf: feat: use correct near testnet multisig links
- f86a735: feat: add near testnet support
- 1c07664: feat: add testnet support in near api connectors
- f7dfec1: feat: generate multisig spec from chain
- Updated dependencies [f7dfec1]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@1.0.7

## 1.0.6

### Patch Changes

- 5fb2ce3: feat: add startBlock to contract deployments
- Updated dependencies [5fb2ce3]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@1.0.6

## 1.0.5

### Patch Changes

- 9180aff: refactor: change oz subgraph endpoints
- 57cd8d1: fix: remove ak relations from role-groups

## 1.0.3

### Patch Changes

- 8fc8521: feat: enable unified rbac and tx fetching with adapters
- Updated dependencies [8fc8521]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@1.0.3

## 1.0.2

### Patch Changes

- 48266a1: feat: add eth rbac support

## 1.0.1

### Patch Changes

- 173bf9c: fix: unintended relation emit
- c7beba0: build: update backstage version
- Updated dependencies [c7beba0]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@1.0.1

## 1.0.0

### Minor Changes

- 01c4fb1: add rbac support to contracts

### Patch Changes

- Updated dependencies [01c4fb1]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@1.0.0

## 0.1.11

### Patch Changes

- 1318ef1: chore: add strong typed app-config
- e9a7584: refactor: use common exported types, add SignerProcessor
- Updated dependencies [a487982]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@0.1.11

## 0.1.10

### Patch Changes

- c843255: refactor: update backstage dependencies, cleanup component structure
- Updated dependencies [c843255]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@0.1.10

## 0.1.9

### Patch Changes

- 66846b4: fix: use new safe api domain

## 0.1.8

### Patch Changes

- c2cc588: ci: build packages on release
- Updated dependencies [c2cc588]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@0.1.8

## 0.1.7

### Patch Changes

- f9ee258: docs: update git repo links in packages
- Updated dependencies [f9ee258]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@0.1.7

## 0.1.6

### Patch Changes

- 1d9f34a: chore: rebrand to blockchainradar
- Updated dependencies [1d9f34a]
  - @aurora-is-near/backstage-plugin-blockchainradar-common@0.1.6

## 0.1.5

### Patch Changes

- 4da72cc: refactor: backend exports and cleanup
- Updated dependencies [0f0114d]
  - @aurora-is-near/backstage-plugin-blockchain-common@0.1.5

## 0.1.4

### Patch Changes

- b255410: build: remove unrelated plugins and cleanup

## 0.1.3

### Patch Changes

- f0a67d8: add dev server for plugin developent
- c451bda: add dev server with catalog for better DX
- Updated dependencies [f0a67d8]
- Updated dependencies [c451bda]
  - @aurora-is-near/backstage-plugin-blockchain-common@0.1.3
