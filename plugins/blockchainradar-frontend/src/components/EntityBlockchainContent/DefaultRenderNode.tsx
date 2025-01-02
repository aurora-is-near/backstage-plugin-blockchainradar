/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { DependencyGraphTypes } from '@backstage/core-components';
import { IconComponent } from '@backstage/core-plugin-api';
import { useEntityPresentation } from '@backstage/plugin-catalog-react';
import { makeStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { EntityIcon } from './EntityIcon';
import { EntityNodeData } from '@backstage/plugin-catalog-graph';
import {
  DEFAULT_NAMESPACE,
  Entity,
  RELATION_API_CONSUMED_BY,
  RELATION_CONSUMES_API,
  RELATION_OWNED_BY,
  RELATION_PROVIDES_API,
  parseEntityRef,
} from '@backstage/catalog-model';

/** @public */
export type CustomNodeClassKey = 'node' | 'text' | 'clickable';

const useStyles = makeStyles(
  theme => ({
    node: {
      fill: theme.palette.grey[300],
      stroke: theme.palette.grey[300],

      '&.primary': {
        fill: theme.palette.primary.light,
        stroke: theme.palette.primary.light,
      },
      '&.secondary': {
        fill: theme.palette.secondary.light,
        stroke: theme.palette.secondary.light,
      },
    },
    text: {
      fill: theme.palette.getContrastText(theme.palette.grey[300]),

      '&.primary': {
        fill: theme.palette.primary.contrastText,
      },
      '&.secondary': {
        fill: theme.palette.secondary.contrastText,
      },
      '&.focused': {
        fontWeight: 'bold',
      },
    },
    clickable: {
      cursor: 'pointer',
    },
  }),
  { name: 'PluginCatalogGraphCustomNode' },
);

export function DefaultRenderNode({
  node: { id, entity, color = 'default', focused, onClick },
}: DependencyGraphTypes.RenderNodeProps<EntityNodeData>) {
  const classes = useStyles();
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const idRef = useRef<SVGTextElement | null>(null);
  const entityRefPresentationSnapshot = useEntityPresentation(entity, {
    defaultNamespace: DEFAULT_NAMESPACE,
  });

  useLayoutEffect(() => {
    // set the width to the length of the ID
    if (idRef.current) {
      let { height: renderedHeight, width: renderedWidth } =
        idRef.current.getBBox();
      renderedHeight = Math.round(renderedHeight);
      renderedWidth = Math.round(renderedWidth);

      if (renderedHeight !== height || renderedWidth !== width) {
        setWidth(renderedWidth);
        setHeight(renderedHeight);
      }
    }
  }, [width, height]);

  const hasKindIcon = !!entityRefPresentationSnapshot.Icon;
  const padding = 10;
  const iconSize = height;
  const paddedIconWidth = hasKindIcon ? iconSize + padding : 0;
  const paddedWidth = paddedIconWidth + width + padding * 2;
  const paddedHeight = height + padding * 2;

  const displayTitle = entityRefPresentationSnapshot.primaryTitle ?? id;

  return (
    <g onClick={onClick} className={classNames(onClick && classes.clickable)}>
      <rect
        className={classNames(
          classes.node,
          color === 'primary' && 'primary',
          color === 'secondary' && 'secondary',
        )}
        width={paddedWidth}
        height={paddedHeight}
        rx={10}
      />
      {hasKindIcon && (
        <EntityIcon
          icon={entityRefPresentationSnapshot.Icon as IconComponent}
          y={padding}
          x={padding}
          width={iconSize}
          height={iconSize}
          className={classNames(
            classes.text,
            focused && 'focused',
            color === 'primary' && 'primary',
            color === 'secondary' && 'secondary',
          )}
        />
      )}
      <text
        ref={idRef}
        className={classNames(
          classes.text,
          focused && 'focused',
          color === 'primary' && 'primary',
          color === 'secondary' && 'secondary',
        )}
        y={paddedHeight / 2}
        x={paddedIconWidth + (width + padding * 2) / 2}
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {displayTitle} {renderBlockchainMetadata({ entity })}
      </text>
      <title>{entityRefPresentationSnapshot.entityRef}</title>
    </g>
  );
}

function renderBlockchainMetadata({ entity }: { entity: Entity }) {
  const isSigner = entity.spec?.type === 'signer-address';
  const isContract = entity.spec?.type === 'contract-deployment';
  const isMultisig = entity.spec?.type === 'multisig-deployment';
  const isAddress = entity.spec?.type === 'blockchain-address';
  const isAccessKey = entity.spec?.type === 'access-key';
  const relations = entity.relations || [];

  if (isSigner) {
    if (entity.metadata.namespace === 'stub') {
      const apiConsumedByRel = relations.find(
        r =>
          r.type === RELATION_API_CONSUMED_BY &&
          parseEntityRef(r.targetRef).kind.toLowerCase() === 'api',
      );
      const interactions = entity.spec?.interactions || {};
      if (apiConsumedByRel && entity.spec?.interactions) {
        const componentRef = parseEntityRef(apiConsumedByRel.targetRef);
        const relatedContract = (interactions as any)[componentRef.name];
        return relatedContract;
      }
    }
    if (entity.spec?.owner) {
      const ownerRef = parseEntityRef(entity.spec.owner as string);
      return ownerRef.name;
    }
  } else if (isContract || isMultisig || isAddress) {
    const providesApiRel = relations.find(
      r => r.type === RELATION_PROVIDES_API,
    );
    if (providesApiRel && entity.spec?.network !== 'near') {
      const componentRef = parseEntityRef(providesApiRel.targetRef);
      return componentRef.name;
    }

    const apiConsumedByRel = relations.find(
      r => r.type === RELATION_API_CONSUMED_BY,
    );
    if (entity.metadata.namespace === 'stub' && apiConsumedByRel) {
      return entity.spec?.role;
    }
  } else if (isAccessKey) {
    const ownerOfRel = relations.find(r => r.type === RELATION_OWNED_BY);
    if (ownerOfRel) {
      const ownerRef = parseEntityRef(ownerOfRel.targetRef);
      return ownerRef.kind.toLowerCase() === 'user'
        ? ownerRef.name
        : `${ownerRef.name} unknown`;
    }
    const consumesApiRel = relations.find(
      r => r.type === RELATION_CONSUMES_API,
    );
    if (consumesApiRel) {
      const componentRef = parseEntityRef(consumesApiRel.targetRef);
      return componentRef.name;
    }
  }

  return undefined;
}
