import { Routes } from '@angular/router';

export const menuRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./task-menu/task-menu.component').then((m) => m.TaskMenuComponent),
    title: '4GUARD Terminal — Tareas',
  },
];
