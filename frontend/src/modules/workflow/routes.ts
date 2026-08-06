import { lazy } from 'react';

const Workflows = lazy(() => import('./pages/Workflows'));
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditor'));
const Tasks = lazy(() => import('./pages/Tasks'));
const ScheduledTasks = lazy(() => import('./pages/ScheduledTasks'));
const WorkflowProviders = lazy(() => import('./pages/WorkflowProviders'));

export const workflowRoutes = [
  { path: 'workflows', element: Workflows },
  { path: 'workflows/providers', element: WorkflowProviders },
  { path: 'workflows/:id', element: WorkflowEditor },
  { path: 'tasks', element: Tasks },
  { path: 'scheduled-tasks', element: ScheduledTasks },
];
