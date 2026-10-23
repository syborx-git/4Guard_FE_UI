/**
 * @file clients-catalog.models.ts
 * @description Modelos e interfaces para el Catálogo de Clientes en 4GUARD WMS.
 * Incluye gestión de contactos dinámicos y destinos físicos vinculados.
 */

export interface ClientContact {
  id: string;
  name: string;
  department: string;
  phone: string;
  email: string;
}

export interface PhysicalDestination {
  id: string;
  plantName: string;
  fullAddress: string;
  contactPerson: string;
  phone: string;
  destinationCode: string;
  status: 'ACTIVO' | 'INACTIVO';
}

export interface CatalogClient {
  id: string;
  code: string;
  businessName: string;
  rfc: string;
  phone: string;
  address: string;
  webPortalPassword?: string;
  status: 'ACTIVO' | 'INACTIVO';
  contacts: ClientContact[];
  destinations: PhysicalDestination[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  businessName: string;
  rfc: string;
  phone: string;
  address: string;
  webPortalPassword?: string;
  contacts: Omit<ClientContact, 'id'>[];
  destinations: Omit<PhysicalDestination, 'id' | 'status'>[];
}
