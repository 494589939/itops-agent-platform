import { lazy } from 'react';

const RemediationPolicies = lazy(() => import('./pages/RemediationPolicies'));
const RemediationPolicyEditor = lazy(() => import('./pages/RemediationPolicyEditor'));
const RemediationExecutions = lazy(() => import('./pages/RemediationExecutions'));
const RemediationDashboard = lazy(() => import('./pages/RemediationDashboard'));
const RemediationWorkbench = lazy(() => import('./pages/RemediationWorkbench'));
const AutoScale = lazy(() => import('./pages/AutoScale'));

export const autoRoutes = [
  { path: 'remediation-policies', element: RemediationPolicies },
  { path: 'remediation-policies/:id', element: RemediationPolicyEditor },
  { path: 'remediation-executions', element: RemediationExecutions },
  { path: 'remediation-dashboard', element: RemediationDashboard },
  { path: 'remediation-workbench', element: RemediationWorkbench },
  { path: 'auto-scale', element: AutoScale },
];
