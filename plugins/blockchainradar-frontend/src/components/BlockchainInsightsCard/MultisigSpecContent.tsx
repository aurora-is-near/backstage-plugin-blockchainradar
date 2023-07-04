import { Entity } from '@backstage/catalog-model';
import { Grid } from '@material-ui/core';
import { MultisigSpec } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import React from 'react';

import { DiscoveredStateField } from './DiscoveredStateField';

/**
 * Props for {@link AboutContent}.
 *
 * @public
 */
export interface MultisigSpecContentProps {
  entity: Entity;
}

/** @public */
export function MultisigSpecContent(props: MultisigSpecContentProps) {
  const multisig = props.entity?.spec?.multisig as MultisigSpec;
  if (!multisig || Object.keys(multisig).length === 0) {
    return null;
  }
  const { owners, threshold } = multisig.policy;

  return (
    <Grid container>
      <>
        {multisig.version && (
          <DiscoveredStateField
            label="Multisig state"
            gridSizes={{ xs: 12 }}
            description="Extracted by calling Safe API (Gnosis, AstroDAO)"
            state={{
              owners: owners.toString(),
              threshold: threshold.toString(),
              version: multisig.version,
            }}
            date={multisig.fetchDate}
            renderCallback={(method, value) => (
              <p>
                <strong>{method}</strong>
                <div>{value}</div>
              </p>
            )}
          />
        )}
      </>
    </Grid>
  );
}
