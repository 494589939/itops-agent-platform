import { lazy } from 'react';

const DbConnections = lazy(() => import('./pages/DbConnections'));

export const databaseRoutes = [
  { path: 'db-connections', element: DbConnections },
];
