import { Routes } from '@angular/router';

export const syncRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./sync-monitor/sync-monitor.component').then(
        (m) => m.SyncMonitorComponent
      ),
    title: '4GUARD Terminal — Monitor de Sync',
  },
];
