## Usage

### Contract discovery

Here is an example of `catalog-info.yaml` configuration that enables the
on-chain discovery:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: near-light-client-on-ethereum
  title: 'NEAR Light Client on Ethereum'
  description: |-
    Implementation of NEAR Light Client in Ethereum.
  tags:
    - contract
    - ethereum
  links: []
  annotations:
    aurora.dev/security-tier: '1'
    backstage.io/source-location: url:https://github.com/aurora-is-near/rainbow-bridge/blob/master/contracts/eth/nearbridge/contracts/NearBridge.sol
spec:
  owner: bridge-team
  type: contract
  lifecycle: production
  system: bridge-protocol
  deployedAt:
    - contract:ethereum/mainnet/0x3FEFc5A4B1c02f21cBc8D3613643ba0635b9a873
  interactsWith:
    - relayer:ethereum/mainnet/0x015e634c7c1311a9034220c28d3d12b7f710a3b1
  deprecated:
    - contract:ethereum/mainnet/0x3be7df8db39996a837041bb8ee0dadf60f767038
```

### Multisig discovery

Here is a real-world example of the definition of the multisig entities:

```yaml
apiVersion: backstage.io/v1alpha1
kind: System
metadata:
  name: bridge-multisigs
  title: 'Bridge Multisigs'
  description: |-
    Multisigs that control Rainbow Bridge
spec:
  domain: bridge
  owner: bridge-team
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: bridge-admin-multisigs
  title: 'Rainbow Bridge Admin Multisigs'
  description: |-
    Used by bridge team for rainbow bridge administration.
  annotations:
    aurora.dev/security-tier: '1'
spec:
  owner: bridge-team
  system: bridge-multisigs
  type: multisig
  lifecycle: production
  deployedAt:
    - multisig:ethereum/mainnet/0x2468603819Bf09Ed3Fb6f3EFeff24B1955f3CDE1
    - multisig:near/mainnet/rainbowbridge.sputnik-dao.near
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: bridge-validator-multisig
  title: 'Rainbow Bridge Validator Multisigs'
  description: |-
    Used by Eth2OnNearClient
  tags:
    - allow-unknown
  annotations:
    aurora.dev/security-tier: '1'
spec:
  owner: bridge-team
  system: bridge-multisigs
  type: multisig
  lifecycle: production
  deployedAt:
    - multisig:near/mainnet/bridge-validator.sputnik-dao.near
```

Once Backstage discovers the multisigs, it will also discover the multisig signers and will map them to User entities.
To define how the mapping is done, the User entities need to have the following
format:

```yaml
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: john.doe
  description: User that holds keys from multiple safes
  annotations:
    aurora.dev/security-tier: '1'
spec:
  profile:
    displayName: John Doe
    email: john.doe@aurora.dev
  interactsWith:
    - signer:ethereum/mainnet/0x655267412Aa297CC9fB69FD478139DfF7f0D851b
    - signer:near/mainnet/johndoe.near
  deprecated:
    - signer:ethereum/mainnet/0x4fE888551e70bb3335A387F3Aa3c33A712a14998
  keys:
    - ed25519:9uZBpK18MqJsMYdG51RfNoKkV1UNUCxQ1uP8is9yjpKA
  memberOf: []
```

One common use-case is when an employee is leaving the company to tag the User
entity with `retired` tag. In this case the plugins will mark all the keys that belong
to the user as deprecated.
