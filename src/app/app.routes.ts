import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/admin/login/login.component';
import { AdminPanelComponent } from './pages/admin/panel/panel.component';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  // El login va listado antes que el panel a propósito: se lee en el orden en
  // que se usa ("primero entro, después edito").
  { path: 'admin/login', component: LoginComponent },
  { path: 'admin', component: AdminPanelComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' },
];
