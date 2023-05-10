# Exporting the Backstage data

## Generating files from templates

Backstage's catalog does not keep history and sometimes it's just useful to
export the catalog to a more-easily consumable format.

We solve this problem by automatically exporting the data from the catalog to Github.

You can get templates from the [github-helpers repository](https://github.com/aurora-is-near/github-helpers/blob/main/templates/backstage/multisigs.md.hbs)
and store them in e.g. `backstage/templates`

There are two examples:

- Multisigs: list multisigs policies and signers
- Filtered entities: export a stripped down version of the catalog to a json
  blob

Once you have the templates in place, configure this github action:

```yaml
---
name: Backstage Exporter

on:
  workflow_dispatch:
  schedule:
    - cron: '0 */2 * * *'
jobs:
  backstage-exporter:
    name: Backstage Exporter
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - uses: aurora-is-near/github-helpers@main
        id: backstage-exporter
        with:
          helper: backstage-export
          github_token: ${{ secrets.GITHUB_TOKEN }}
          backstage_url: ${{ secrets.BACKSTAGE_URL }}
          template_path: backstage/templates
          output_path: .
```

When executed, it will generate and commit the exported files to the repository

## Metrics

There is a way to export the data (such as the
information about multisigs or access keys) to a monitoring system for alerting.

We solve this problem by sending the data to Datadog with this Github action:

```yaml
---
name: Backstage Metrics

on:
  workflow_dispatch:
  schedule:
    - cron: '0 */8 * * *'

jobs:
  backstage-exporter:
    name: Backstage Exporter
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - uses: aurora-is-near/github-helpers@main
        id: backstage-multisig-metrics
        env:
          DD_API_KEY: '***'
        with:
          helper: backstage-multisig-metrics
          backstage_url: ${{ secrets.BACKSTAGE_URL }}
```
