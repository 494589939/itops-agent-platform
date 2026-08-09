import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const AccessControlPage = lazy(() => import('./pages/AccessControl'));

export const accessControlRoutes: RouteObject[] = [
  {
    path: 'access-control',
    element: <AccessControlPage />,
  },
];
