/**
 * @file clients-catalog.component.ts
 * @description Catálogo de Clientes en 4GUARD WMS.
 * Jerarquía de Pestañas: 1. Alta de Clientes -> 2. Consulta / Modificar.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { CatalogsService } from '../../services/catalogs.service';
import { CatalogClient, PhysicalDestination } from '../../models/clients-catalog.models';

type ClientSubTab = 'create' | 'consult';

@Component({
  selector: 'fg-clients-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clients-catalog.component.html',
  styleUrl: './clients-catalog.component.css',
})
export class ClientsCatalogComponent {
  protected readonly catalogsService = inject(CatalogsService);
  private readonly fb = inject(FormBuilder);

  // Jerarquía: Alta por defecto
  protected readonly activeTab = signal<ClientSubTab>('create');
  protected readonly searchTerm = signal<string>('');

  // Modal para detalle y gestión de Destinos Físicos
  protected readonly selectedClientForEdit = signal<CatalogClient | null>(null);

  // Toast alert
  protected readonly toastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario Reactivo Alta de Cliente con FormArrays
  protected readonly clientForm = this.fb.group({
    businessName: ['', [Validators.required, Validators.minLength(3)]],
    rfc: ['', [Validators.required, Validators.pattern(/^([A-ZÑ&]{3,4}) ?(?:[0-9]{2})(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01]) ?(?:[A-Z0-9]{3})$/i)]],
    phone: ['', [Validators.required]],
    address: ['', [Validators.required]],
    webPortalPassword: ['NestleWMS#2026', [Validators.required]],
    contacts: this.fb.array([]),
    destinations: this.fb.array([]),
  });

  get contactsFormArray(): FormArray {
    return this.clientForm.get('contacts') as FormArray;
  }

  get destinationsFormArray(): FormArray {
    return this.clientForm.get('destinations') as FormArray;
  }

  constructor() {
    this.addContactField();
    this.addDestinationField('Planta Toluca (Ejemplo)', 'Km 62.5 Carretera México-Toluca, Toluca, EdoMex', 'Ing. Fernando Ruiz', '722 279 1000');
  }

  protected readonly filteredClients = computed(() => {
    const list = this.catalogsService.clients();
    const query = this.searchTerm().toLowerCase().trim();

    if (!query) return list;

    return list.filter(
      (c) =>
        c.businessName.toLowerCase().includes(query) ||
        c.rfc.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query) ||
        c.address.toLowerCase().includes(query)
    );
  });

  addContactField(name = '', department = '', phone = '', email = ''): void {
    const contactGroup = this.fb.group({
      name: [name, [Validators.required]],
      department: [department, [Validators.required]],
      phone: [phone, [Validators.required]],
      email: [email, [Validators.required, Validators.email]],
    });
    this.contactsFormArray.push(contactGroup);
  }

  removeContactField(index: number): void {
    if (this.contactsFormArray.length > 1) {
      this.contactsFormArray.removeAt(index);
    }
  }

  addDestinationField(plantName = '', fullAddress = '', contactPerson = '', phone = ''): void {
    const destGroup = this.fb.group({
      plantName: [plantName, [Validators.required]],
      fullAddress: [fullAddress, [Validators.required]],
      contactPerson: [contactPerson, [Validators.required]],
      phone: [phone, [Validators.required]],
    });
    this.destinationsFormArray.push(destGroup);
  }

  removeDestinationField(index: number): void {
    this.destinationsFormArray.removeAt(index);
  }

  onSubmitCreateClient(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const val = this.clientForm.value;
    this.catalogsService.createClient({
      businessName: val.businessName!,
      rfc: val.rfc!,
      phone: val.phone!,
      address: val.address!,
      webPortalPassword: val.webPortalPassword!,
      contacts: (val.contacts || []) as any[],
      destinations: (val.destinations || []) as any[],
    });

    this.showToast('success', `Cliente ${val.businessName} registrado con sus Destinos Físicos.`);
    this.clientForm.reset();
    this.contactsFormArray.clear();
    this.destinationsFormArray.clear();
    this.addContactField();
    this.addDestinationField('Planta Querétaro', 'Av. 5 de Febrero 1325, Querétaro', 'Dra. Patricia Garza', '442 211 4000');
    this.activeTab.set('consult');
  }

  openClientModal(client: CatalogClient): void {
    this.selectedClientForEdit.set(client);
  }

  closeClientModal(): void {
    this.selectedClientForEdit.set(null);
  }

  addDestinationToSelectedClient(plantName: string, fullAddress: string, contactPerson: string, phone: string): void {
    const client = this.selectedClientForEdit();
    if (!client || !plantName || !fullAddress) return;

    const newDest: PhysicalDestination = {
      id: `DEST-${Date.now()}`,
      plantName,
      fullAddress,
      contactPerson,
      phone,
      destinationCode: `DEST-${Math.floor(100 + Math.random() * 900)}`,
      status: 'ACTIVO',
    };

    const updatedDestinations = [...client.destinations, newDest];
    this.catalogsService.updateClient(client.id, { destinations: updatedDestinations });
    this.selectedClientForEdit.set({ ...client, destinations: updatedDestinations });
    this.showToast('success', `Nuevo Destino Físico '${plantName}' asignado a ${client.businessName}.`);
  }

  private showToast(type: 'success' | 'error', text: string): void {
    this.toastMessage.set({ type, text });
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
