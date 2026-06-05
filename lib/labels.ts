import type { EventStatus } from "./types";

export const labels = {
  dashboard: "Panel",
  createEvent: "Crear evento",
  editEvent: "Editar evento",
  delete: "Eliminar",
  duplicate: "Duplicar",
  copyLink: "Copiar enlace",
  copied: "Copiado",
  recentRegistrations: "Registros recientes",
  fullName: "Nombre completo",
  email: "Email",
  phone: "Teléfono",
  register: "Registrarse",
  registerAndPay: "Registrarse y pagar",
  joinWaitlist: "Apuntarme a la lista de espera",
  eventDetails: "Detalles del evento",
  price: "Precio",
  location: "Ubicación",
  date: "Fecha",
  time: "Hora",
  category: "Categoría",
  capacity: "Capacidad",
  paidEvent: "Evento de pago",
  publish: "Publicar",
  draft: "Borrador",
  save: "Guardar",
  cancel: "Cancelar",
  status: "Estado",
  availability: "Disponibilidad",
  dateAndTime: "Fecha y hora",
  back: "Volver",
  viewDetails: "Ver detalles",
  saveChanges: "Guardar cambios",
  saving: "Guardando...",
  submitting: "Enviando...",
  deleteEvent: "Eliminar evento",
  deleting: "Eliminando...",
  duplicating: "Duplicando...",
  categories: "Categorías",
  community: "Comunidad",
  logout: "Cerrar sesión",
  confirmed: "Confirmados",
  waitlist: "Lista de espera",
  remaining: "Restantes",
  viewAttendees: "Ver asistentes",
  loading: "Cargando...",
  noEvents: "No hay eventos.",
  noRegistrations: "Aún no hay registros.",
  eventManagement: "Gestión de eventos",
  totalEvents: "Total de eventos",
  totalRegistrations: "Total de registros",
  confirmedAttendees: "Asistentes confirmados",
  waitlistCount: "En lista de espera",
  basicInfo: "Información básica",
  title: "Título",
  shortDescription: "Descripción breve",
  pricing: "Precios",
  settings: "Ajustes",
  waitlistEnabled: "Lista de espera activada",
  published: "Publicado",
  free: "Gratuito",
  paid: "De pago",
} as const;

export function getPublicEventStatusLabel(status: EventStatus): string {
  switch (status) {
    case "Open":
    case "Few spots left":
      return "Disponible";
    case "Waitlist only":
      return "Lista de espera";
    case "Sold out":
      return "Agotado";
  }
}

export function getAdminEventStatusLabel(status: EventStatus): string {
  switch (status) {
    case "Open":
      return "Disponible";
    case "Few spots left":
      return "Pocas plazas";
    case "Waitlist only":
      return "Lista de espera";
    case "Sold out":
      return "Agotado";
  }
}

export function getAdminSpotsLabel(remainingSpots: number, capacity: number): string {
  const confirmed = capacity - remainingSpots;
  return `${confirmed}/${capacity} plazas ocupadas`;
}
