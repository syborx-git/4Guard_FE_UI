import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DriverSubmittedPass } from '../security-gate/security-gate.component';

@Component({
  selector: 'rf-incoming-pass-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './incoming-pass-card.component.html',
  styleUrls: ['./incoming-pass-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingPassCardComponent {
  @Input({ required: true }) pass!: DriverSubmittedPass;
  @Input() isLoaded = false;

  @Output() selectPass = new EventEmitter<DriverSubmittedPass>();
  @Output() rejectPass = new EventEmitter<DriverSubmittedPass>();

  get driverInitials(): string {
    if (!this.pass?.driverName) return 'CH';
    const parts = this.pass.driverName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  get formattedStay(): string {
    if (!this.pass?.submittedAt) return 'Reciente';
    const diffMs = Math.max(0, Date.now() - new Date(this.pass.submittedAt).getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  }

  onCardClick(): void {
    this.selectPass.emit(this.pass);
  }

  onReject(event: MouseEvent): void {
    event.stopPropagation();
    this.rejectPass.emit(this.pass);
  }

  onActionClick(event: MouseEvent): void {
    event.stopPropagation();
    this.selectPass.emit(this.pass);
  }
}
