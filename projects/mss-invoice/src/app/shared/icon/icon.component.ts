import { Component, Input } from '@angular/core';

/**
 * Drop-in replacement for <mat-icon>name</mat-icon> that never depends on the Material
 * Icons web font loading. Add a new case in icon.component.html for any icon name not
 * yet listed.
 *
 * Usage: <app-icon name="add"></app-icon>
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [],
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.css',
})
export class IconComponent {
  @Input() name = '';
  @Input() size = 20;
}
