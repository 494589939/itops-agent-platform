import { lazy } from 'react';

const Login = lazy(() => import('./pages/Login'));
const ForcePasswordChange = lazy(() => import('./pages/ForcePasswordChange'));
const Users = lazy(() => import('./pages/Users'));

export const authRoutes = [
  { path: 'users', element: Users },
];

export const publicRoutes = [
  { path: '/login', element: Login },
  { path: '/force-password-change', element: ForcePasswordChange },
];
