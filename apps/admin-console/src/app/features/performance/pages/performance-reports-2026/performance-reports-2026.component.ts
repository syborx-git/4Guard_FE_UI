import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerformanceExcelExportService, KpiReportType } from '../../services/performance-excel-export.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-performance-reports-2026',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './performance-reports-2026.component.html',
  styleUrl: './performance-reports-2026.component.css'
})
export class PerformanceReports2026Component {
  private readonly excelService = inject(PerformanceExcelExportService);
  private readonly toast = inject(ToastService);

  // Pestaña activa
  protected readonly activeTab = signal<KpiReportType>('descarga');

  // Sub-pestaña para Carga (Embalajes vs Culinarios)
  protected readonly cargaSubTab = signal<'embalajes' | 'culinarios'>('embalajes');

  // Período activo para Inventarios (6 hojas)
  protected readonly activePeriod = signal<string>('01 ABR 26 AL 31 ABR 26');

  // Estado de descarga
  protected readonly isDownloading = signal<boolean>(false);
  protected readonly lastDownloadedName = signal<string>('');

  // ── DATOS ANALÍTICOS DE LAS GRÁFICAS (AUDITADOS DE LOS EXCEL) ──

  // 1. Gráfica Descarga: Promedio Mensual
  protected readonly descargaMonthly = [
    { label: 'oct-25', time: '01:34 hrs', minutes: 94, isMeta: true },
    { label: 'nov-25', time: '02:59 hrs', minutes: 179, isMeta: false },
    { label: 'dic-25', time: '02:09 hrs', minutes: 129, isMeta: false },
    { label: 'ene-26', time: '02:06 hrs', minutes: 126, isMeta: false },
    { label: 'feb-26', time: '01:23 hrs', minutes: 83, isMeta: true }
  ];

  // Gráfica Descarga: Ranking por Línea Transportista
  protected readonly descargaCarriers = [
    { name: 'ANGELES', time: '01:10 hrs', minutes: 70, status: 'optimal', width: '25%' },
    { name: 'CALMO', time: '01:17 hrs', minutes: 77, status: 'optimal', width: '28%' },
    { name: 'ARPAPEL', time: '01:20 hrs', minutes: 80, status: 'optimal', width: '30%' },
    { name: 'TUM', time: '01:31 hrs', minutes: 91, status: 'regular', width: '42%' },
    { name: 'CHAPA', time: '01:32 hrs', minutes: 92, status: 'regular', width: '43%' },
    { name: 'DIAZ', time: '01:45 hrs', minutes: 105, status: 'regular', width: '50%' },
    { name: 'BARRERA', time: '04:35 hrs', minutes: 275, status: 'critical', width: '80%' },
    { name: 'CANALEX', time: '06:55 hrs', minutes: 415, status: 'critical', width: '100%' }
  ];

  // 2. Gráfica Carga: Semanas Culinarios
  protected readonly cargaSemanas = [
    { sem: 'sem.46', time: '02:38 hrs', minutes: 158 },
    { sem: 'sem.47', time: '02:24 hrs', minutes: 144 },
    { sem: 'sem.48', time: '02:21 hrs', minutes: 141 },
    { sem: 'sem.49', time: '04:11 hrs', minutes: 251 },
    { sem: 'sem.50', time: '01:49 hrs', minutes: 109 },
    { sem: 'sem.1', time: '01:28 hrs', minutes: 88 },
    { sem: 'sem.2', time: '01:42 hrs', minutes: 102 },
    { sem: 'sem.3', time: '02:20 hrs', minutes: 140 }
  ];

  // 3. Gráfica Montacarguistas: Eficiencia & Rango
  protected readonly montacarguistas = [
    { name: 'ALEJANDRO MARTINEZ REYES', avg: 226, total: 7015, pct: '113.1%', status: 'green', label: 'Alta Eficiencia (211-233)' },
    { name: 'SALVADOR MARTINEZ REYES', avg: 230, total: 7150, pct: '115.3%', status: 'green', label: 'Alta Eficiencia (211-233)' },
    { name: 'JOSE LUIS ROJAS CHAVEZ', avg: 186, total: 5780, pct: '93.2%', status: 'yellow', label: 'Meta Estándar (100-200)' },
    { name: 'DANTE LOZANO GARCIA', avg: 272, total: 2448, pct: '136.0%', status: 'green', label: 'Alta Eficiencia (>233)' },
    { name: 'ALEJANDRO CARRIZOSA', avg: 153, total: 4770, pct: '76.9%', status: 'yellow', label: 'Meta Estándar (100-200)' }
  ];

  // 4. Gráfica Inventarios: Capacidad y Ocupación
  protected readonly periodosInventario = [
    { name: '16 NOV 25 AL 15 DIC 25', fijos: 18000, ocupacion: 17546, pct: '97.5%', status: 'warning' },
    { name: '16 DIC 25 AL 15 ENE 26', fijos: 18000, ocupacion: 16828, pct: '93.5%', status: 'good' },
    { name: '16 ENE 26 AL 15 DE FEB 26', fijos: 18000, ocupacion: 13072, pct: '72.6%', status: 'good' },
    { name: '16 FEB 26 AL 28 FEB 26', fijos: 18000, ocupacion: 10863, pct: '60.4%', status: 'good' },
    { name: '01 MAR 26 AL 31 MAR 26', fijos: 13500, ocupacion: 10580, pct: '78.4%', status: 'good' },
    { name: '01 ABR 26 AL 31 ABR 26', fijos: 13500, ocupacion: 13125, pct: '97.2%', status: 'warning' }
  ];

  protected setTab(tab: KpiReportType): void {
    this.activeTab.set(tab);
  }

  protected setCargaSubTab(subTab: 'embalajes' | 'culinarios'): void {
    this.cargaSubTab.set(subTab);
  }

  protected setPeriod(period: string): void {
    this.activePeriod.set(period);
  }

  // ── DESCARGA MAESTRA CON FECHA DINÁMICA & GRÁFICOS OFICIALES ──
  protected async downloadCurrentReport(): Promise<void> {
    const tab = this.activeTab();
    this.isDownloading.set(true);

    try {
      const downloadedFilename = await this.excelService.downloadOfficialReport(tab);
      this.lastDownloadedName.set(downloadedFilename);
      this.toast.success(`⚡ Libro "${downloadedFilename}" descargado con éxito con todas sus hojas y gráficos oficiales.`, 5000);
    } catch (err) {
      console.error('Error al generar Excel:', err);
      this.toast.error('Ocurrió un error al preparar el archivo Excel.', 4000);
    } finally {
      this.isDownloading.set(false);
    }
  }

  protected async downloadSpecific(tab: KpiReportType, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.activeTab.set(tab);
    await this.downloadCurrentReport();
  }
}
