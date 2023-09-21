import { Entity } from '@backstage/catalog-model';
import {
  BlockchainAddressEntity,
  ContractDeploymentEntity,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { BlockchainProcessor } from '../processors/BlockchainProcessor';
import { BlockchainAddress } from '../entities/BlockchainAddress';
import { ContractDeployment } from '../entities/ContractDeployment';
import { MultisigDeployment } from '../entities/MultisigDeployment';

// https://stackoverflow.com/questions/29998343/limiting-the-times-that-split-splits-rather-than-truncating-the-resulting-ar
// function javaSplit(string: string, separator: string, n: number) {
//   const split = string.split(separator);
//   if (split.length <= n) return split;
//   const out = split.slice(0, n - 1);
//   out.push(split.slice(n - 1).join(separator));
//   return out;
// }
//
export class BlockchainFactory {
  // this function is not reliable and deprecated because the entity name
  // could contain hashed + bs58-encoded address instead of the real one
  // instead of doing it just use spec.address
  // static parseAddressEntityName(entityName: string) {
  //   const [network, type, address] = javaSplit(entityName, '-', 3);
  //   return { network, type, address };
  // }

  /**
   * Parses address that is passed in the deployedAt/interactsWith contract spec
   * the format is role:network/type/address
   * It also detects if the address represents a contract or a normal account
   * @returns The contract deployment or blockchain address entity
   */
  static async fromUserSpecifiedAddress<T = BlockchainAddress>(
    processor: BlockchainProcessor,
    humanSpecifiedAddress: string,
    parent: Entity,
  ) {
    const [role, compositeAddress] = humanSpecifiedAddress.split(':');
    const [network, networkType, address] = compositeAddress.split('/');

    return BlockchainFactory.contractOrAccount(
      processor,
      parent,
      role,
      address,
      network,
      networkType,
    ) as T;
  }

  /**
   * Will automatically detect if the address is a contract or a normal account
   */
  static async fromEntity<T = BlockchainAddress>(
    processor: BlockchainProcessor,
    parent: BlockchainAddressEntity | ContractDeploymentEntity,
    role = 'admin',
    newAddress?: string,
  ) {
    return BlockchainFactory.contractOrAccount(
      processor,
      parent,
      role,
      newAddress || parent.spec.address,
      parent.spec.network,
      parent.spec.networkType,
    ) as T;
  }

  static async fromBlockchainAddress(
    blockchainAddress: BlockchainAddress,
    role = 'admin',
    newAddress: string,
    newNetwork?: string,
  ) {
    return BlockchainFactory.contractOrAccount(
      blockchainAddress.processor,
      blockchainAddress.toEntity(),
      role,
      newAddress,
      newNetwork || blockchainAddress.network,
      blockchainAddress.networkType,
    );
  }

  static async contractOrAccount(
    processor: BlockchainProcessor,
    parent: Entity,
    role: string,
    address: string,
    network: string,
    networkType: string,
  ): Promise<BlockchainAddress | ContractDeployment | MultisigDeployment> {
    const adapter = AdapterFactory.adapter(processor, network, networkType);

    if (await adapter.isContract(address)) {
      if (role === 'multisig') {
        return new MultisigDeployment(
          processor,
          parent,
          role,
          network,
          networkType,
          address,
        );
      }
      return new ContractDeployment(
        processor,
        parent,
        role,
        network,
        networkType,
        address,
      );
    }
    return new BlockchainAddress(
      processor,
      parent,
      role,
      network,
      networkType,
      address,
    );
  }
}
