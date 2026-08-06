import { lazy } from 'react';

const Kubernetes = lazy(() => import('./pages/Kubernetes'));

export const kubernetesRoutes = [
  { path: 'kubernetes', element: Kubernetes },
];
