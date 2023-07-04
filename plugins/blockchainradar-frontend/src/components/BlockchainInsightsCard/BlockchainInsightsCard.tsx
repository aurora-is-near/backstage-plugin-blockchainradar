import { InfoCardVariants } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  makeStyles,
} from '@material-ui/core';

import React from 'react';
import { AboutContent } from './AboutContent';
import { ContractSpecContent } from './ContractSpecContent';
import { MultisigSpecContent } from './MultisigSpecContent';
import { NearKeysContent } from './NearKeysContent';

const useStyles = makeStyles({
  gridItemCard: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100% - 10px)', // for pages without content header
    marginBottom: '10px',
  },
  fullHeightCard: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  gridItemCardContent: {
    flex: 1,
  },
  fullHeightCardContent: {
    flex: 1,
  },
});

export interface BlockchainInsightsCardProps {
  variant?: InfoCardVariants;
}

export function BlockchainInsightsCard(props: BlockchainInsightsCardProps) {
  const { variant } = props;
  const classes = useStyles();
  const { entity } = useEntity();

  let cardClass = '';
  if (variant === 'gridItem') {
    cardClass = classes.gridItemCard;
  } else if (variant === 'fullHeight') {
    cardClass = classes.fullHeightCard;
  }

  let cardContentClass = '';
  if (variant === 'gridItem') {
    cardContentClass = classes.gridItemCardContent;
  } else if (variant === 'fullHeight') {
    cardContentClass = classes.fullHeightCardContent;
  }

  return (
    <Card className={cardClass}>
      <CardHeader title="On-Chain Insights" />
      <Divider />
      <CardContent className={cardContentClass}>
        <AboutContent entity={entity} />
        <ContractSpecContent entity={entity} />
        <MultisigSpecContent entity={entity} />
        <NearKeysContent entity={entity} />
      </CardContent>
    </Card>
  );
}
