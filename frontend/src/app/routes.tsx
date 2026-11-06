import { RouteObject } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ParkingManagementPage } from '../features/parking/ParkingManagementPage';
import { ParkingSessionsPage } from '../features/sessions/ParkingSessionsPage';
import { VehicleManagementPage } from '../features/vehicles/VehicleManagementPage';
import { RfidManagementPage } from '../features/rfid/RfidManagementPage';
import { DevicesPage } from '../features/devices/DevicesPage';
import { RevenueReportsPage } from '../features/reports/RevenueReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { NotFoundPage } from '../features/not-found/NotFoundPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'parking', element: <ParkingManagementPage /> },
      { path: 'sessions', element: <ParkingSessionsPage /> },
      { path: 'vehicles', element: <VehicleManagementPage /> },
      { path: 'rfid', element: <RfidManagementPage /> },
      { path: 'devices', element: <DevicesPage /> },
      { path: 'reports', element: <RevenueReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  }
];

