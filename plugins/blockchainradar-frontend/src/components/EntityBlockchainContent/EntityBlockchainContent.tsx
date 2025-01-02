import React, { PropsWithChildren } from 'react';
import {
  EntityAboutCard,
  EntityHasSubcomponentsCard,
  EntityLinksCard,
} from '@backstage/plugin-catalog';
import { EntityCatalogGraphCard } from '@backstage/plugin-catalog-graph';
import { Grid } from '@material-ui/core';
import { EntityBlockchainInsightsCard } from '../EntityBlockchainInsightsCard';
import { entityWarningContent } from '../common';
import { DefaultRenderNode } from './DefaultRenderNode';

export const EntityBlockchainContent = ({
  children,
}: PropsWithChildren<{}>) => (
  <Grid container spacing={3} alignItems="stretch">
    {entityWarningContent}
    <Grid item md={12}>
      <EntityAboutCard variant="gridItem" />
    </Grid>
    <Grid item md={12}>
      <EntityCatalogGraphCard
        renderNode={DefaultRenderNode}
        variant="gridItem"
        height={400}
      />
    </Grid>

    <Grid item lg={6} sm={12}>
      <EntityLinksCard />
    </Grid>
    <Grid item lg={6} sm={12}>
      <EntityHasSubcomponentsCard variant="gridItem" />
    </Grid>
    <Grid item xs={12}>
      <EntityBlockchainInsightsCard />
    </Grid>
    {children}
  </Grid>
);
