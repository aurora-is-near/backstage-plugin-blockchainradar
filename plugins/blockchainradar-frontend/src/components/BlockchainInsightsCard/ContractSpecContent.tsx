import { Entity } from '@backstage/catalog-model';
import { Grid } from '@material-ui/core';
import { ContractDeploymentSpec } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import React from 'react';
import { AboutField } from './AboutField';

import { DiscoveredStateField } from './DiscoveredStateField';

/**
 * Props for {@link AboutContent}.
 *
 * @public
 */
export interface ContractSpecContentProps {
  entity: Entity;
}

/** @public */
export function ContractSpecContent(props: ContractSpecContentProps) {
  const deployment = props.entity.spec?.deployment as ContractDeploymentSpec;

  return (
    <Grid container>
      <>
        {deployment?.state && (
          <DiscoveredStateField
            label="Addresses"
            gridSizes={{ xs: 12, md: 6 }}
            description="Extracted by calling read-only contract methods that return addresses"
            state={deployment.state.interactsWith}
            date={deployment.state.fetchDate}
            renderCallback={(role, addr) => (
              <AboutField label={role} gridSizes={{ xs: 12 }}>
                {addr}
              </AboutField>
            )}
          />
        )}

        {deployment?.source && (
          <DiscoveredStateField
            // label={`Discovered Source Code (${deployment.source.contractName})`}
            label="Source Code"
            gridSizes={{ xs: 12, md: 6 }}
            description="Extracted by fetching verified source code from Etherscan API"
            state={deployment.source.sourceFiles}
            date={deployment.source.fetchDate}
            renderCallback={(file, _) => <>{file.split('/').pop()}</>}
          />
        )}

        {deployment?.state && (
          <DiscoveredStateField
            label="Contract state"
            gridSizes={{ xs: 12 }}
            description="Extracted by calling read-only methods"
            state={deployment.state.methods}
            date={deployment.state.fetchDate}
            asJson
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
