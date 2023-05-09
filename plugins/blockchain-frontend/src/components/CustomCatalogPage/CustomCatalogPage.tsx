import React from 'react';
import {
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';

import { PageWithHeader } from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import {
  CatalogFilterLayout,
  EntityListProvider,
  EntityTagPicker,
  EntityTypePicker,
  UserListPicker,
} from '@backstage/plugin-catalog-react';

import {
  CatalogKindHeader,
  CatalogTable,
  DefaultCatalogPageProps,
  // catalogPlugin,
} from '@backstage/plugin-catalog';
import { EntitySecurityTierPicker } from './SecurityTierPicker';
import { useLocation } from 'react-router-dom';

export const CustomCatalogPage = ({
  columns,
  actions,
  initiallySelectedFilter = 'owned',
}: DefaultCatalogPageProps) => {
  // const createComponentLink = useRouteRef(
  //   catalogPlugin.externalRoutes.createComponent,
  // )!;

  const search = useLocation().search;
  const reportName = new URLSearchParams(search).get('report');

  const orgName =
    useApi(configApiRef).getOptionalString('organization.name') ?? 'Backstage';

  let title = `${orgName} Catalog`;

  if (reportName) {
    title += `: ${reportName}`;
  }

  return (
    <PageWithHeader title={title} themeId="home">
      <EntityListProvider key={title}>
        <Content>
          <ContentHeader titleComponent={<CatalogKindHeader />}>
            {/* <CreateButton title="Create Component" to={createComponentLink()} /> */}
            <SupportButton>All your software catalog entities</SupportButton>
          </ContentHeader>
          <CatalogFilterLayout>
            <CatalogFilterLayout.Filters>
              <EntityTypePicker />
              <UserListPicker initialFilter={initiallySelectedFilter} />
              <EntitySecurityTierPicker />
              <EntityTagPicker />
            </CatalogFilterLayout.Filters>
            <CatalogFilterLayout.Content>
              <CatalogTable columns={columns} actions={actions} />
            </CatalogFilterLayout.Content>
          </CatalogFilterLayout>
        </Content>
      </EntityListProvider>
    </PageWithHeader>
  );
};
