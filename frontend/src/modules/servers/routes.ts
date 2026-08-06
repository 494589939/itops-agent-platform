import { lazy } from 'react';

const Servers = lazy(() => import('./pages/Servers'));
const SSHKeys = lazy(() => import('./pages/SSHKeys'));
const TerminalPage = lazy(() => import('./pages/TerminalPage'));
const RemoteDesktop = lazy(() => import('./pages/RemoteDesktop'));

export const serverRoutes = [
  { path: 'servers', element: Servers },
  { path: 'ssh-keys', element: SSHKeys },
  { path: 'terminal', element: TerminalPage },
  { path: 'remote-desktop', element: RemoteDesktop },
  { path: 'remote-desktop/:serverId', element: RemoteDesktop },
];
