import React from 'react';
import {
  EntityOrphanWarning,
  EntityProcessingErrorsPanel,
  EntityRelationWarning,
  EntitySwitch,
  hasCatalogProcessingErrors,
  hasRelationWarnings,
  isOrphan,
} from '@backstage/plugin-catalog';
import {
  EntityPagerDutyCard,
  isPagerDutyAvailable,
} from '@backstage/plugin-pagerduty';
import { Grid } from '@material-ui/core';

export const entityWarningContent = (
  <>
    <EntitySwitch>
      <EntitySwitch.Case if={isOrphan}>
        <Grid item xs={12}>
          <EntityOrphanWarning />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={hasCatalogProcessingErrors}>
        <Grid item xs={12}>
          <EntityProcessingErrorsPanel />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={hasRelationWarnings}>
        <Grid item xs={12}>
          <EntityRelationWarning />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={isPagerDutyAvailable}>
        <Grid item md={6}>
          <EntityPagerDutyCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
  </>
);
