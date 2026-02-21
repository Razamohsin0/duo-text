import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lama-header',
  standalone: true, // Crucial for standalone architecture
  imports: [CommonModule],
  templateUrl: './lama-header.html',
  styleUrl: './lama-header.css',
})
export class LamaHeader {}