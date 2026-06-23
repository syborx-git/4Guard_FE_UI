/**
 * @file shipping-list.component.ts
 * @description Gestión de despacho de salidas en 4GUARD WMS.
 */

import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransferOrder, TransferOrderType, TransferOrderStatus } from '@4guard/shared-core';

interface Operator {
  id: string;
  name: string;
}

@Component({
  selector: 'fg-shipping-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shipping-list.component.html',
  styleUrl: './shipping-list.component.css'
})
export class ShippingListComponent {
  protected readonly filterText = signal('');
  protected readonly selectedStatus = signal('');
  protected readonly selectedPriority = signal('');

  protected readonly operators = signal<Operator[]>([
    { id: 'op-01', name: 'Juan Manuel' },
    { id: 'op-02', name: 'Laura Restrepo' },
    { id: 'op-03', name: 'Pedro Infante' },
    { id: 'op-04', name: 'Gabriela Mistral' }
  ]);

  protected readonly orders = signal<TransferOrder[]>([
    {
      id: 'to-001',
      orderNumber: 'TO-2026-00045',
      type: TransferOrderType.OUTBOUND,
      status: TransferOrderStatus.READY_TO_SHIP,
      clientId: 'cli-01',
      clientName: 'Lala S.A.',
      branchId: '1',
      assignedOperatorId: 'op-01',
      assignedOperatorName: 'Juan Manuel',
      priority: 1, // Critical
      dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Overdue
      startedAt: '2026-06-22T08:00:00Z',
      completedAt: '2026-06-22T09:30:00Z',
      clientOrderReference: 'REF-MILK-990',
      lines: [],
      notes: 'Despacho prioritario cadena de frío',
      createdAt: '2026-06-22T07:00:00Z',
      updatedAt: '2026-06-22T09:30:00Z'
    },
    {
      id: 'to-002',
      orderNumber: 'TO-2026-00046',
      type: TransferOrderType.OUTBOUND,
      status: TransferOrderStatus.ASSIGNED,
      clientId: 'cli-02',
      clientName: 'Nestlé México',
      branchId: '1',
      assignedOperatorId: 'op-02',
      assignedOperatorName: 'Laura Restrepo',
      priority: 2, // High
      dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // Due soon
      startedAt: '2026-06-22T11:00:00Z',
      completedAt: null,
      clientOrderReference: 'REF-COF-112',
      lines: [],
      notes: null,
      createdAt: '2026-06-22T10:00:00Z',
      updatedAt: '2026-06-22T11:00:00Z'
    },
    {
      id: 'to-003',
      orderNumber: 'TO-2026-00047',
      type: TransferOrderType.INTERNAL,
      status: TransferOrderStatus.PENDING,
      clientId: 'cli-03',
      clientName: 'Bimbo de México',
      branchId: '1',
      assignedOperatorId: null,
      assignedOperatorName: null,
      priority: 3, // Medium
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      startedAt: null,
      completedAt: null,
      clientOrderReference: null,
      lines: [],
      notes: 'Reubicación por optimización de racks',
      createdAt: '2026-06-22T12:00:00Z',
      updatedAt: '2026-06-22T12:00:00Z'
    }
  ]);

  protected readonly overdueCount = computed(() => {
    return this.orders().filter(o => 
      o.status !== TransferOrderStatus.DISPATCHED && 
      o.status !== TransferOrderStatus.CANCELLED &&
      this.isOverdue(o.dueDate)
    ).length;
  });

  protected readonly filteredOrders = computed(() => {
    const query = this.filterText().toLowerCase().trim();
    const status = this.selectedStatus();
    const priority = this.selectedPriority();

    return this.orders().filter(o => {
      // Search
      if (query && !o.orderNumber.toLowerCase().includes(query) && !o.clientName.toLowerCase().includes(query)) {
        return false;
      }
      // Status filter
      if (status) {
        if (status === 'UNASSIGNED') {
          if (o.assignedOperatorId !== null || o.status === TransferOrderStatus.DISPATCHED) return false;
        } else if (o.status !== status) {
          return false;
        }
      }
      // Priority filter
      if (priority && o.priority !== Number(priority)) {
        return false;
      }
      return true;
    });
  });

  protected onFilterChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.filterText.set(input.value);
    }
  }

  protected onStatusChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select) {
      this.selectedStatus.set(select.value);
    }
  }

  protected onPriorityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select) {
      this.selectedPriority.set(select.value);
    }
  }

  protected isOverdue(dueDateStr: string): boolean {
    return new Date(dueDateStr).getTime() < Date.now();
  }

  protected getOrderTypeLabel(type: TransferOrderType): string {
    switch (type) {
      case TransferOrderType.OUTBOUND:
        return 'Salida (Outbound)';
      case TransferOrderType.INTERNAL:
        return 'Interno';
      case TransferOrderType.RETURN:
        return 'Devolución';
      default:
        return type;
    }
  }

  protected getStatusLabel(status: TransferOrderStatus): string {
    switch (status) {
      case TransferOrderStatus.PENDING:
        return 'Pendiente Asignar';
      case TransferOrderStatus.ASSIGNED:
        return 'Asignada (Picking)';
      case TransferOrderStatus.IN_PICKING:
        return 'En Picking';
      case TransferOrderStatus.READY_TO_SHIP:
        return 'Listo Despacho';
      case TransferOrderStatus.DISPATCHED:
        return 'Despachado';
      case TransferOrderStatus.CANCELLED:
        return 'Cancelado';
      default:
        return status;
    }
  }

  protected getStatusClass(status: TransferOrderStatus): string {
    switch (status) {
      case TransferOrderStatus.PENDING:
        return 'status-pending';
      case TransferOrderStatus.ASSIGNED:
        return 'status-assigned';
      case TransferOrderStatus.IN_PICKING:
        return 'status-picking';
      case TransferOrderStatus.READY_TO_SHIP:
        return 'status-ready';
      case TransferOrderStatus.DISPATCHED:
        return 'status-dispatched';
      default:
        return 'status-pending';
    }
  }

  protected getOperatorName(id: string | null): string {
    if (!id) return '';
    return this.operators().find(op => op.id === id)?.name || '';
  }

  protected onAssignOperator(order: TransferOrder, event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (!select) return;

    const opId = select.value || null;
    const opName = this.getOperatorName(opId) || null;

    this.orders.update(list => list.map(o => 
      o.id === order.id ? { 
        ...o, 
        assignedOperatorId: opId, 
        assignedOperatorName: opName,
        status: opId ? TransferOrderStatus.ASSIGNED : TransferOrderStatus.PENDING
      } : o
    ));

    if (opId) {
      alert(`Orden ${order.orderNumber} asignada a ${opName} para picking.`);
    } else {
      alert(`Orden ${order.orderNumber} desasignada.`);
    }
  }

  protected dispatchOrder(order: TransferOrder): void {
    if (confirm(`¿Confirmar despacho físico de la orden ${order.orderNumber}?`)) {
      this.orders.update(list => list.map(o => 
        o.id === order.id ? { 
          ...o, 
          status: TransferOrderStatus.DISPATCHED,
          completedAt: new Date().toISOString()
        } : o
      ));
      alert(`Orden ${order.orderNumber} despachada correctamente. Se ha actualizado el inventario.`);
    }
  }
}
