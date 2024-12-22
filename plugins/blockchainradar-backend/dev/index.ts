import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();
// backend.add(import('@backstage/plugin-app-backend'));

backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-catalog-backend-module-github'));
backend.add(import('../src'));

// backend.add(import('@backstage/plugin-auth-backend'));
// backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));

// backend.add(import('@backstage/plugin-search-backend'));
// backend.add(import('@backstage/plugin-search-backend-module-catalog'));

// backend.add(import('@backstage/plugin-proxy-backend'));

// backend.add(import('@backstage/plugin-events-backend'));

// backend.add(import('@backstage/plugin-devtools-backend'));

backend.start();
