import { Entity } from '@backstage/catalog-model';
import { Grid } from '@material-ui/core';
import React from 'react';

import {
  NearKeysSpec,
  isFullAccessKey,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { DiscoveredStateField } from './DiscoveredStateField';

/**
 * Props for {@link AboutContent}.
 *
 * @public
 */
export interface NearKeysContentProps {
  entity: Entity;
}

/** @public */
export function NearKeysContent(props: NearKeysContentProps) {
  // const { entity } = props;
  const nearKeys = props.entity?.spec?.nearKeys as NearKeysSpec;
  const groupedKeys = groupKeys(nearKeys);

  function groupKeys(keys?: NearKeysSpec) {
    if (!keys) return {};
    const grouped: Record<string, Record<string, string>> = {};

    Object.entries(keys.keys).forEach(([k, v]) => {
      let group = 'FullAccess';
      let perm: any = 'FullAccess';
      if (!isFullAccessKey(v)) {
        perm = JSON.parse(v);
        group = (perm.FunctionCall.method_names as string[]).join(', ');
      }

      grouped[group] ||= {};
      grouped[group][k] = perm;
    });
    const groupedJson: Record<string, string> = {};
    Object.entries(grouped).forEach(([k, v]) => {
      groupedJson[k] = JSON.stringify(v, null, 2);
    });
    return groupedJson;
  }

  return (
    <Grid container>
      {nearKeys && (
        <>
          <DiscoveredStateField
            label="Near Access Keys"
            gridSizes={{ xs: 12, md: 12 }}
            description="Extracted by calling Near API"
            state={groupedKeys}
            date={nearKeys.fetchDate}
            asJson
            renderCallback={(key, permissions) => (
              <p>
                <strong>Permissions: {key}</strong>
                <div>{permissions}</div>
              </p>
            )}
          />
        </>
      )}
    </Grid>
  );
}
