import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  // La portada sí va eager: es la primera pantalla y la ve todo el mundo.
  { path: '', component: HomeComponent },
  // El panel y el login van **diferidos**. No es cosmético: con las rutas
  // eager, el visitante anónimo de la portada se bajaba el panel entero y
  // `supabase-js` sin poder usarlos (320.90 kB -> 567.27 kB medidos). Lo marcó
  // la revisión nativa (R4-4) y empeora con cada sección de edición que entra.
  //
  // El login va listado antes que el panel a propósito: se lee en el orden en
  // que se usa ("primero entro, después edito").
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./pages/admin/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/panel/panel.component').then((m) => m.AdminPanelComponent),
    canActivate: [adminGuard],
  },
  { path: '**', redirectTo: '' },
];
