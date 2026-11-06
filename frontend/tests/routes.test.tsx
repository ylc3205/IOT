import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../src/app/routes';

// Mock health service để bài test UI không gửi HTTP request thực tế trong môi trường jsdom
vi.mock('../src/services/health.service', () => ({
  healthService: {
    getLiveness: vi.fn().mockResolvedValue({
      success: true,
      data: { status: 'ok', service: 'smart-parking-api' }
    }),
    getReadiness: vi.fn().mockResolvedValue({
      success: true,
      data: {
        status: 'ready',
        database: 'connected',
        mqtt: 'connected',
        timestamp: new Date().toISOString()
      }
    })
  }
}));

function renderWithRouter(initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const testRouter = createMemoryRouter(routes, {
    initialEntries: [initialEntry]
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={testRouter} />
    </QueryClientProvider>
  );
}

describe('CMS Shell & Route Rendering Smoke Tests', () => {
  it('should render the CMS sidebar and Dashboard brand header', () => {
    renderWithRouter('/');
    expect(screen.getByText('SMART PARKING')).toBeInTheDocument();
    expect(screen.getByText('CMS OPERATOR')).toBeInTheDocument();
    expect(screen.getByText('Quản lý Bãi đỗ')).toBeInTheDocument();
  });

  it('should render Parking Management placeholder page on /parking', () => {
    renderWithRouter('/parking');
    expect(screen.getByText(/Quản lý Bãi đỗ xe & Vị trí đỗ/i)).toBeInTheDocument();
    expect(screen.getByText(/MOD-PARKING-01/i)).toBeInTheDocument();
  });

  it('should render IoT Devices placeholder page on /devices', () => {
    renderWithRouter('/devices');
    expect(screen.getByText(/Quản lý Thiết bị IoT & Node Biên ESP32/i)).toBeInTheDocument();
    expect(screen.getByText(/MOD-DEVICES-05/i)).toBeInTheDocument();
  });

  it('should render 404 page when navigating to an unknown route', () => {
    renderWithRouter('/unknown-route-test');
    expect(screen.getByText(/404 — Không tìm thấy trang/i)).toBeInTheDocument();
    expect(screen.getByText(/Quay lại Dashboard/i)).toBeInTheDocument();
  });
});
