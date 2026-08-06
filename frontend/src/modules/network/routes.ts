import { lazy } from 'react';

const NetworkDevices = lazy(() => import('./pages/NetworkDevices'));
const Topology = lazy(() => import('./pages/Topology'));
const SNMPPage = lazy(() => import('./pages/SNMP'));
const NetworkDiscoveryPage = lazy(() => import('./pages/NetworkDiscovery'));
const Networks = lazy(() => import('./pages/Networks'));

export const networkRoutes = [
  { path: 'network-devices', element: NetworkDevices },
  { path: 'topology', element: Topology },
  { path: 'snmp', element: SNMPPage },
  { path: 'network-discovery', element: NetworkDiscoveryPage },
  { path: 'networks', element: Networks },
];
