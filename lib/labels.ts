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
  email: "Correo electrónico",
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
  backToDashboard: "Volver al panel",
  downloadAttendees: "Descargar asistentes",
  editingNow: "Editando evento",
  dangerZone: "Zona de riesgo",
  attendees: "Asistentes",
  preparing: "Preparando...",
  manageCategories: "Gestionar categorías",
  eventNotFound: "Evento no encontrado.",
  couldNotLoadEvent: "No se pudo cargar este evento.",
  sharePrivateLink:
    "Comparte este enlace privado con los invitados. Solo quienes tengan el enlace podrán registrarse.",
  deleteEventWarning: "Eliminar este evento también eliminará sus inscripciones.",
  deleteEventConfirm:
    "¿Seguro que quieres eliminar este evento? Esta acción no se puede deshacer.",
  couldNotDeleteEvent: "No se pudo eliminar este evento.",
  couldNotUpdateEvent: "No se pudo actualizar el evento.",
  couldNotLoadCategories: "No se pudieron cargar las categorías.",
  couldNotLoadAttendees: "No se pudieron cargar los asistentes.",
  couldNotLoadAttendeeDetails: "No se pudieron cargar los datos de los asistentes.",
  couldNotRefreshAttendees: "No se pudieron actualizar los asistentes.",
  couldNotCancelRegistration: "No se pudo cancelar la inscripción.",
  noAttendeesYet: "Aún no hay asistentes",
  noAttendeesHint: "Los asistentes aparecerán aquí cuando haya inscripciones.",
  cancelling: "Cancelando...",
  viewAttendeesSubtitle:
    "Consulta las inscripciones y el estado de los asistentes de cada evento.",
  cancelRegistrationDone: "Inscripción cancelada.",
  cancelRegistrationWaitlistPromoted:
    "Inscripción cancelada. Se ha confirmado la plaza para la primera persona en lista de espera.",
  cancelRegistrationWaitlistPaymentSent:
    "Inscripción cancelada. Se ha enviado un enlace de pago a la primera persona en lista de espera.",
  sendPaymentLink: "Enviar enlace de pago",
  sendingPaymentLink: "Enviando...",
  paymentLinkSent: "Se ha enviado un enlace de pago a la persona en lista de espera.",
  paymentLinkEmailFailed:
    "La plaza se ha liberado, pero no se pudo enviar el email de pago. Revisa la configuración de email.",
  couldNotSendPaymentLink: "No se pudo enviar el enlace de pago. Inténtalo de nuevo.",
  resendPaymentLink: "Reenviar enlace de pago",
  resendingPaymentLink: "Reenviando...",
  paymentLinkResent: "Se ha reenviado el enlace de pago.",
  noSpotsAvailablePending:
    "No hay plazas disponibles. Ya hay una persona pendiente de pago para esta plaza.",
  pendingReservesSpot: "Reserva una plaza temporalmente hasta completar el pago.",
  cancelRegistrationWaitlistPromotedEmailFailed:
    "Inscripción cancelada y plaza confirmada, pero no se pudo enviar el email de aviso.",
  paidEventWaitlistNote:
    "Al liberarse una plaza, se envía automáticamente un enlace de pago a la primera persona en lista de espera. Las personas pendientes de pago reservan plaza temporalmente.",
} as const;

export function getCancelRegistrationConfirmMessage(name: string) {
  return `¿Cancelar la inscripción de ${name}?`;
}

export function getRegistrationStatusLabel(
  status: "confirmed" | "waitlist" | "pending" | "cancelled" | "unknown" | string,
): string {
  switch (status) {
    case "confirmed":
      return "Confirmado";
    case "waitlist":
      return "Lista de espera";
    case "pending":
      return "Pendiente de pago";
    case "cancelled":
      return "Cancelado";
    default:
      return "Desconocido";
  }
}

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
