import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { LeftSidebarComponent } from './components/left-sidebar/left-sidebar.component';
import { ContentHeaderComponent } from './components/content-header/content-header.component';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { ToastContainerComponent } from './components/toast/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    LeftSidebarComponent,
    ContentHeaderComponent,
    AppHeaderComponent,
    ToastContainerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
