import { lazy } from 'react';

const DataCenterManage = lazy(() => import('./pages/DataCenterManage'));
const DataRoom = lazy(() => import('./pages/DataRoom'));

export const dcRoutes = [
  { path: 'dc-manage', element: DataCenterManage },
  { path: 'data-room', element: DataRoom },
];
