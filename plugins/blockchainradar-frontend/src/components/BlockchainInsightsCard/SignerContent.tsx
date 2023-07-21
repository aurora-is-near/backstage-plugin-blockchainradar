import { Grid } from '@material-ui/core';
import React from 'react';
import { AboutContentProps } from '@backstage/plugin-catalog';
import { isSigner } from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { DiscoveredStateField } from './DiscoveredStateField';

/** @public */
export function SignerContent(props: AboutContentProps) {
  return (
    <Grid container>
      {isSigner(props.entity) && (
        <>
          <DiscoveredStateField
            label="Signer metadata"
            gridSizes={{ xs: 12 }}
            description="Extracted by calling Explorer API (Etherscan, Blockscout)"
            state={{
              lastSigned: new Date(props.entity.spec.lastSigned).toString(),
            }}
            date={new Date().getTime()}
            renderCallback={(method, value) => (
              <p>
                <strong>{method}</strong>
                <div>{value}</div>
              </p>
            )}
          />
        </>
      )}
    </Grid>
  );
}
