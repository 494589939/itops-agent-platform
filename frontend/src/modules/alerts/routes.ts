import { lazy } from 'react';

const Alerts = lazy(() => import('./pages/Alerts'));
const AlertMappings = lazy(() => import('./pages/AlertMappings'));
const AlertNoiseManagement = lazy(() => import('./pages/AlertNoiseManagement'));
const AlertAutoAnalysis = lazy(() => import('./pages/AlertAutoAnalysis'));
const InspectionCenter = lazy(() => import('./pages/InspectionCenter'));
const AlertCorrelationGroupsPage = lazy(() => import('./pages/AlertCorrelationGroups'));
const AlertProviders = lazy(() => import('./pages/AlertProviders'));

export const alertRoutes = [
  { path: 'alerts', element: Alerts },
  { path: 'alerts/providers', element: AlertProviders },
  { path: 'alert-mappings', element: AlertMappings },
  { path: 'alert-noise', element: AlertNoiseManagement },
  { path: 'alert-auto-analysis', element: AlertAutoAnalysis },
  { path: 'inspection-center', element: InspectionCenter },
  { path: 'alert-correlation-groups', element: AlertCorrelationGroupsPage },
];
