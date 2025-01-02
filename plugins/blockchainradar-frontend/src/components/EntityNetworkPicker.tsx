import {
  EntityFilter,
  DefaultEntityFilters,
  useEntityList,
} from '@backstage/plugin-catalog-react';

import { Entity } from '@backstage/catalog-model';
import React from 'react';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  Typography,
} from '@material-ui/core';

class EntityNetworkFilter implements EntityFilter {
  constructor(readonly values: string[]) {}
  filterEntity(entity: Entity): boolean {
    const network = entity.spec?.network;
    return (
      network !== undefined &&
      typeof network === 'string' &&
      this.values.includes(network)
    );
  }
}
export type CustomFilters = DefaultEntityFilters & {
  networks?: EntityNetworkFilter;
};

export const EntityNetworkPicker = () => {
  // The securityTiers key is recognized due to the CustomFilter generic
  const {
    filters: { networks },
    updateFilters,
  } = useEntityList<CustomFilters>();

  // Toggles the value, depending on whether it's already selected
  function onChange(value: string) {
    const newNetworks = networks?.values.includes(value)
      ? networks.values.filter(tier => tier !== value)
      : [...(networks?.values ?? []), value];
    updateFilters({
      networks: newNetworks.length
        ? new EntityNetworkFilter(newNetworks)
        : undefined,
    });
  }

  const tierOptions = ['aurora', 'ethereum', 'near'];
  return (
    <FormControl component="fieldset">
      <Typography variant="button">Network</Typography>
      <FormGroup>
        {tierOptions.map(tier => (
          <FormControlLabel
            key={tier}
            control={
              <Checkbox
                checked={networks?.values.includes(tier)}
                onChange={() => onChange(tier)}
              />
            }
            label={`${tier}`}
          />
        ))}
      </FormGroup>
    </FormControl>
  );
};
