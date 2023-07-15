import { Entity } from '@backstage/catalog-model';
import { Grid, makeStyles, Typography } from '@material-ui/core';
import React from 'react';
import { AboutField } from '../AboutField';

const useStyles = makeStyles({
  description: {
    wordBreak: 'break-word',
  },
});

/**
 * Props for {@link AboutContent}.
 *
 * @public
 */
export interface AboutContentProps {
  entity: Entity;
}

/** @public */
export function AboutContent(_props: AboutContentProps) {
  // const { entity } = props;
  const classes = useStyles();

  // const isAPI = entity.kind.toLocaleLowerCase('en-US') === 'api';

  // const tier = entity.metadata.annotations?.['aurora.dev/security-tier'];

  return (
    <Grid container>
      <AboutField label="" gridSizes={{ xs: 12 }}>
        <Typography variant="body2" paragraph className={classes.description}>
          This information is periodically refreshed and could be delayed.
        </Typography>
      </AboutField>
      {/* <AboutField
        label="Owner"
        value="No Owner"
        gridSizes={{ xs: 12, sm: 6, lg: 4 }}
      >
        {ownedByRelations.length > 0 && (
          <EntityRefLinks entityRefs={ownedByRelations} defaultKind="group" />
        )}
      </AboutField>
      {(isSystem || partOfDomainRelations.length > 0) && (
        <AboutField
          label="Domain"
          value="No Domain"
          gridSizes={{ xs: 12, sm: 6, lg: 4 }}
        >
          {partOfDomainRelations.length > 0 && (
            <EntityRefLinks
              entityRefs={partOfDomainRelations}
              defaultKind="domain"
            />
          )}
        </AboutField>
      )}
      {(isAPI ||
        isComponent ||
        isResource ||
        partOfSystemRelations.length > 0) && (
        <AboutField
          label="System"
          value="No System"
          gridSizes={{ xs: 12, sm: 6, lg: 4 }}
        >
          {partOfSystemRelations.length > 0 && (
            <EntityRefLinks
              entityRefs={partOfSystemRelations}
              defaultKind="system"
            />
          )}
        </AboutField>
      )} */}

      {/* {isAPI && ( */}
      {/* <>
        <AboutField
          label="Security Tier"
          value={tier as string}
          //gridSizes={{ xs: 12, sm: 6, lg: 4 }}
        />
        <AboutField
          label="Contract address"
          value={'3be7Df8dB39996a837041bb8Ee0dAdf60F767038'}
          gridSizes={{ xs: 12, sm: 12, lg: 12 }}
        />
      </> */}
      {/* )} */}

      {/* <AboutField
        label="Tags"
        value="No Tags"
        gridSizes={{ xs: 12, sm: 6, lg: 4 }}
      >
        {(entity?.metadata?.tags || []).map(t => (
          <Chip key={t} size="small" label={t} />
        ))}
      </AboutField> */}
    </Grid>
  );
}
