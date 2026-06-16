"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
import { supabase } from "@/lib/supabase";

type SupabaseRegistrationRow = {
  id: string | number;
  client_id: string | number | null;
  event_id: string | number | null;
  status: "confirmed" | "waitlist" | "pending" | "cancelled" | null;
  created_at: string | null;
};

type SupabaseClientRow = {
  id: string | number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type SupabaseEventRow = {
  id: string | number;
  title: string | null;
  slug: string | null;
};

type CommunityGroupRow = {
  id: string;
  name: string;
  created_at: string | null;
};

type CommunityGroupMemberRow = {
  id: string;
  group_id: string;
  registration_id: string | number;
  created_at: string | null;
};

type ContactView = {
  registrationId: string;
  clientId: string | null;
  fullName: string;
  email: string;
  phone: string;
  eventTitle: string;
  eventSlug: string | null;
  status: "confirmed" | "waitlist" | "pending" | "cancelled" | "unknown";
  createdAt: string | null;
};

type GroupWithCount = CommunityGroupRow & { memberCount: number };

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-ES", { year: "numeric", month: "short", day: "2-digit" }).format(
    date,
  );
}

function getRegistrationStatusLabel(status: ContactView["status"]): string {
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

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function AdminCommunityPage() {
  const [activeTab, setActiveTab] = useState<"contacts" | "groups">("contacts");

  const [contacts, setContacts] = useState<ContactView[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "waitlist" | "pending" | "cancelled">(
    "all",
  );

  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [addingToGroup, setAddingToGroup] = useState(false);
  const [addToGroupMessage, setAddToGroupMessage] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);
  const [groupMembersError, setGroupMembersError] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<ContactView[]>([]);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  async function fetchContacts() {
    setContactsLoading(true);
    setContactsError(null);

    const { data: registrationsData, error: registrationsError } = await supabase
      .from("registrations")
      .select("id,client_id,event_id,status,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (registrationsError) {
      setContactsError("No se pudieron cargar los contactos.");
      setContacts([]);
      setContactsLoading(false);
      return;
    }

    const registrations = (registrationsData as SupabaseRegistrationRow[] | null) ?? [];
    const clientIds = Array.from(
      new Set(
        registrations
          .map((registration) => registration.client_id)
          .filter((clientId): clientId is string | number => Boolean(clientId))
          .map(String),
      ),
    );
    const eventIds = Array.from(
      new Set(
        registrations
          .map((registration) => registration.event_id)
          .filter((eventId): eventId is string | number => Boolean(eventId))
          .map(String),
      ),
    );

    let clientsById: Record<string, SupabaseClientRow> = {};
    if (clientIds.length > 0) {
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id,full_name,email,phone")
        .in("id", clientIds);

      if (clientsError) {
        setContactsError("No se pudieron cargar los datos de contacto.");
        setContacts([]);
        setContactsLoading(false);
        return;
      }

      clientsById = ((clientsData as SupabaseClientRow[] | null) ?? []).reduce(
        (acc, client) => {
          acc[String(client.id)] = client;
          return acc;
        },
        {} as Record<string, SupabaseClientRow>,
      );
    }

    let eventsById: Record<string, SupabaseEventRow> = {};
    if (eventIds.length > 0) {
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("id,title,slug")
        .in("id", eventIds);

      if (eventsError) {
        setContactsError("No se pudieron cargar los datos del evento.");
        setContacts([]);
        setContactsLoading(false);
        return;
      }

      eventsById = ((eventsData as SupabaseEventRow[] | null) ?? []).reduce(
        (acc, event) => {
          acc[String(event.id)] = event;
          return acc;
        },
        {} as Record<string, SupabaseEventRow>,
      );
    }

    const mapped = registrations.map((registration) => {
      const client = registration.client_id ? clientsById[String(registration.client_id)] : null;
      const event = registration.event_id ? eventsById[String(registration.event_id)] : null;
      const status = registration.status ?? "unknown";
      return {
        registrationId: String(registration.id),
        clientId: registration.client_id ? String(registration.client_id) : null,
        fullName: client?.full_name ?? "Asistente desconocido",
        email: client?.email ?? "Sin email",
        phone: client?.phone ?? "-",
        eventTitle: event?.title ?? event?.slug ?? "Evento",
        eventSlug: event?.slug ?? null,
        status,
        createdAt: registration.created_at ?? null,
      } satisfies ContactView;
    });

    setContacts(mapped);
    setContactsLoading(false);
  }

  async function fetchGroupsAndCounts() {
    setGroupsLoading(true);
    setGroupsError(null);

    const [{ data: groupsData, error: groupsError }, { data: membersData, error: membersError }] =
      await Promise.all([
        supabase.from("community_groups").select("id,name,created_at").order("created_at", { ascending: false }),
        supabase.from("community_group_members").select("group_id"),
      ]);

    if (groupsError) {
      setGroupsError("No se pudieron cargar los grupos.");
      setGroups([]);
      setGroupsLoading(false);
      return;
    }

    if (membersError) {
      setGroupsError("No se pudieron cargar los recuentos de grupos.");
      setGroups([]);
      setGroupsLoading(false);
      return;
    }

    const countsByGroupId: Record<string, number> = {};
    ((membersData as Array<{ group_id: string }> | null) ?? []).forEach((row) => {
      countsByGroupId[row.group_id] = (countsByGroupId[row.group_id] ?? 0) + 1;
    });

    const groupsRows = (groupsData as CommunityGroupRow[] | null) ?? [];
    setGroups(groupsRows.map((group) => ({ ...group, memberCount: countsByGroupId[group.id] ?? 0 })));
    setGroupsLoading(false);
  }

  async function fetchMembersForGroup(groupId: string) {
    setGroupMembersLoading(true);
    setGroupMembersError(null);
    setGroupMembers([]);

    const { data: membersData, error: membersError } = await supabase
      .from("community_group_members")
      .select("id,group_id,registration_id,created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (membersError) {
      setGroupMembersError("No se pudieron cargar los miembros del grupo.");
      setGroupMembersLoading(false);
      return;
    }

    const memberRows = (membersData as CommunityGroupMemberRow[] | null) ?? [];
    const registrationIds = memberRows.map((member) => member.registration_id);
    if (registrationIds.length === 0) {
      setGroupMembers([]);
      setGroupMembersLoading(false);
      return;
    }

    const { data: registrationsData, error: registrationsError } = await supabase
      .from("registrations")
      .select("id,client_id,event_id,status,created_at")
      .in("id", registrationIds);

    if (registrationsError) {
      setGroupMembersError("No se pudieron cargar las inscripciones de los miembros.");
      setGroupMembersLoading(false);
      return;
    }

    const registrations = (registrationsData as SupabaseRegistrationRow[] | null) ?? [];
    const registrationById = registrations.reduce(
      (acc, row) => {
        acc[String(row.id)] = row;
        return acc;
      },
      {} as Record<string, SupabaseRegistrationRow>,
    );

    const clientIds = Array.from(
      new Set(
        registrations
          .map((registration) => registration.client_id)
          .filter((clientId): clientId is string | number => Boolean(clientId))
          .map(String),
      ),
    );
    const eventIds = Array.from(
      new Set(
        registrations
          .map((registration) => registration.event_id)
          .filter((eventId): eventId is string | number => Boolean(eventId))
          .map(String),
      ),
    );

    let clientsById: Record<string, SupabaseClientRow> = {};
    if (clientIds.length > 0) {
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id,full_name,email,phone")
        .in("id", clientIds);

      if (clientsError) {
        setGroupMembersError("No se pudieron cargar los datos de los miembros.");
        setGroupMembersLoading(false);
        return;
      }

      clientsById = ((clientsData as SupabaseClientRow[] | null) ?? []).reduce(
        (acc, client) => {
          acc[String(client.id)] = client;
          return acc;
        },
        {} as Record<string, SupabaseClientRow>,
      );
    }

    let eventsById: Record<string, SupabaseEventRow> = {};
    if (eventIds.length > 0) {
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("id,title,slug")
        .in("id", eventIds);

      if (eventsError) {
        setGroupMembersError("No se pudieron cargar los datos del evento.");
        setGroupMembersLoading(false);
        return;
      }

      eventsById = ((eventsData as SupabaseEventRow[] | null) ?? []).reduce(
        (acc, event) => {
          acc[String(event.id)] = event;
          return acc;
        },
        {} as Record<string, SupabaseEventRow>,
      );
    }

    const mappedMembers = memberRows
      .map((member) => {
        const registration = registrationById[String(member.registration_id)];
        if (!registration) return null;
        const client = registration.client_id ? clientsById[String(registration.client_id)] : null;
        const event = registration.event_id ? eventsById[String(registration.event_id)] : null;
        const status = registration.status ?? "unknown";
        return {
          registrationId: String(registration.id),
          clientId: registration.client_id ? String(registration.client_id) : null,
          fullName: client?.full_name ?? "Asistente desconocido",
          email: client?.email ?? "Sin email",
          phone: client?.phone ?? "-",
          eventTitle: event?.title ?? event?.slug ?? "Evento",
          eventSlug: event?.slug ?? null,
          status,
          createdAt: registration.created_at ?? null,
        } satisfies ContactView;
      })
      .filter((value): value is ContactView => Boolean(value));

    setGroupMembers(mappedMembers);
    setGroupMembersLoading(false);
  }

  useEffect(() => {
    void fetchContacts();
    void fetchGroupsAndCounts();
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    void fetchMembersForGroup(selectedGroupId);
  }, [selectedGroupId]);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (statusFilter !== "all" && contact.status !== statusFilter) return false;
      if (!query) return true;
      return (
        contact.fullName.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query) ||
        contact.phone.toLowerCase().includes(query) ||
        contact.eventTitle.toLowerCase().includes(query)
      );
    });
  }, [contacts, searchQuery, statusFilter]);

  const selectedCount = selectedRegistrationIds.size;

  function toggleSelected(registrationId: string) {
    setSelectedRegistrationIds((current) => {
      const next = new Set(current);
      if (next.has(registrationId)) next.delete(registrationId);
      else next.add(registrationId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedRegistrationIds(new Set());
  }

  async function handleAddSelectedToGroup() {
    if (addingToGroup) return;
    setAddToGroupMessage(null);

    const groupId = targetGroupId || selectedGroupId || "";
    if (!groupId) {
      setAddToGroupMessage("Selecciona un grupo primero.");
      return;
    }

    const registrationIds = Array.from(selectedRegistrationIds);
    if (registrationIds.length === 0) {
      setAddToGroupMessage("Selecciona al menos un asistente.");
      return;
    }

    setAddingToGroup(true);
    try {
      const payload = registrationIds.map((registrationId) => ({
        group_id: groupId,
        registration_id: Number.isFinite(Number(registrationId)) ? Number(registrationId) : registrationId,
      }));

      const { error } = await supabase
        .from("community_group_members")
        .upsert(payload, { onConflict: "group_id,registration_id", ignoreDuplicates: true });

      if (error) {
        setAddToGroupMessage("No se pudieron añadir miembros al grupo.");
        return;
      }

      setAddToGroupMessage(
        `Se ${registrationIds.length === 1 ? "añadió" : "añadieron"} ${registrationIds.length} miembro${registrationIds.length === 1 ? "" : "s"} al grupo.`,
      );
      clearSelection();
      await fetchGroupsAndCounts();
      if (selectedGroupId === groupId) {
        await fetchMembersForGroup(groupId);
      }
    } finally {
      setAddingToGroup(false);
      window.setTimeout(() => setAddToGroupMessage(null), 2200);
    }
  }

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name || creatingGroup) return;

    setCreatingGroup(true);
    setGroupsError(null);
    try {
      const { data, error } = await supabase
        .from("community_groups")
        .insert({ name })
        .select("id,name,created_at")
        .single();

      if (error || !data) {
        setGroupsError("No se pudo crear el grupo.");
        return;
      }

      setNewGroupName("");
      await fetchGroupsAndCounts();
      setSelectedGroupId(String((data as CommunityGroupRow).id));
      setActiveTab("groups");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (deletingGroupId) return;
    setDeletingGroupId(groupId);
    setGroupsError(null);

    try {
      const { error } = await supabase.from("community_groups").delete().eq("id", groupId);
      if (error) {
        setGroupsError("No se pudo eliminar el grupo.");
        return;
      }

      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
        setGroupMembers([]);
      }

      await fetchGroupsAndCounts();
    } finally {
      setDeletingGroupId(null);
    }
  }

  async function handleRemoveMember(groupId: string, registrationId: string) {
    if (removingMemberId) return;
    setRemovingMemberId(registrationId);
    setGroupMembersError(null);

    try {
      const candidateId = Number.isFinite(Number(registrationId)) ? Number(registrationId) : registrationId;
      const { error } = await supabase
        .from("community_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("registration_id", candidateId);

      if (error) {
        setGroupMembersError("No se pudo quitar al miembro.");
        return;
      }

      await fetchGroupsAndCounts();
      await fetchMembersForGroup(groupId);
    } finally {
      setRemovingMemberId(null);
    }
  }

  const groupOptions = useMemo(() => groups.map((group) => ({ id: group.id, name: group.name })), [groups]);

  const selectedGroup = useMemo(
    () => (selectedGroupId ? groups.find((group) => group.id === selectedGroupId) ?? null : null),
    [groups, selectedGroupId],
  );

  return (
    <AdminShell
      title="Comunidad"
      subtitle="Crea grupos y organiza asistentes a partir de las inscripciones."
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("contacts")}
            className={classNames(
              "rounded-lg border px-3 py-2 text-sm font-medium transition",
              activeTab === "contacts"
                ? "border-zinc-300 bg-white text-zinc-900"
                : "border-transparent bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
            )}
          >
            Todos los contactos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("groups")}
            className={classNames(
              "rounded-lg border px-3 py-2 text-sm font-medium transition",
              activeTab === "groups"
                ? "border-zinc-300 bg-white text-zinc-900"
                : "border-transparent bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
            )}
          >
            Grupos
          </button>
        </div>
      }
    >
      {activeTab === "contacts" ? (
        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-zinc-900">Todos los contactos</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Selecciona asistentes (inscripciones) y añádelos a grupos.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 outline-none ring-[color:var(--accent-ring)] focus:ring-2"
                >
                  <option value="all">Todos los estados</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="waitlist">Lista de espera</option>
                  <option value="pending">Pendiente de pago</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nombre, email o evento…"
                  className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2 sm:w-72"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-zinc-200 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-zinc-700">
                  {selectedCount === 0 ? "Sin selección" : `${selectedCount} seleccionado${selectedCount === 1 ? "" : "s"}`}
                </p>
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Limpiar
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <select
                  value={targetGroupId}
                  onChange={(event) => setTargetGroupId(event.target.value)}
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 outline-none ring-[color:var(--accent-ring)] focus:ring-2"
                >
                  <option value="">Añadir a grupo…</option>
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddSelectedToGroup}
                  disabled={addingToGroup || selectedCount === 0 || groups.length === 0}
                  className="h-10 rounded-lg bg-[var(--accent-button)] px-4 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)] disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {addingToGroup ? "Añadiendo..." : "Añadir"}
                </button>
              </div>
            </div>
            {addToGroupMessage ? <p className="mt-2 text-sm text-zinc-600">{addToGroupMessage}</p> : null}
          </div>

          <div className="overflow-x-auto">
            {contactsLoading ? (
              <p className="px-5 py-6 text-sm text-zinc-600">Cargando contactos…</p>
            ) : contactsError ? (
              <p className="px-5 py-6 text-sm text-rose-600">{contactsError}</p>
            ) : filteredContacts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-600">Ningún contacto coincide con los filtros.</p>
            ) : (
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="w-[40px] px-5 py-3 font-medium">
                      <span className="sr-only">Seleccionar</span>
                    </th>
                    <th className="w-[28%] min-w-[260px] px-4 py-3 font-medium">Asistente</th>
                    <th className="w-[28%] min-w-[260px] px-4 py-3 font-medium">Evento</th>
                    <th className="w-[120px] px-4 py-3 font-medium">Estado</th>
                    <th className="w-[140px] px-5 py-3 font-medium">Registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => {
                    const isChecked = selectedRegistrationIds.has(contact.registrationId);
                    return (
                      <tr key={contact.registrationId} className="border-t border-zinc-100">
                        <td className="px-5 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelected(contact.registrationId)}
                            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                            aria-label={`Seleccionar ${contact.fullName}`}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-zinc-900">{contact.fullName}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {contact.email}
                            {contact.phone !== "-" ? ` · ${contact.phone}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-zinc-900">{contact.eventTitle}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={classNames(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              contact.status === "confirmed"
                                ? "bg-emerald-50 text-emerald-700"
                                : contact.status === "waitlist"
                                  ? "bg-amber-50 text-amber-700"
                                  : contact.status === "pending"
                                    ? "bg-blue-50 text-blue-700"
                                    : contact.status === "cancelled"
                                      ? "bg-zinc-100 text-zinc-700"
                                      : "bg-zinc-100 text-zinc-700",
                            )}
                          >
                            {getRegistrationStatusLabel(contact.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 align-top text-zinc-700">{formatDate(contact.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Grupos</h2>
              <p className="mt-1 text-sm text-zinc-600">Crea y gestiona grupos de asistentes.</p>
            </div>

            <div className="border-b border-zinc-200 px-5 py-4">
              <label className="block text-sm font-medium text-zinc-700">Nuevo grupo</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="p. ej. Emprendedoras de Lisboa"
                  className="h-10 flex-1 rounded-lg border border-zinc-300 px-3 text-sm outline-none ring-[color:var(--accent-ring)] transition focus:ring-2"
                />
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={creatingGroup || newGroupName.trim().length === 0}
                  className="h-10 rounded-lg bg-[var(--accent-button)] px-4 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-button-hover)] active:bg-[var(--accent-button-pressed)] disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {creatingGroup ? "Creando..." : "Crear"}
                </button>
              </div>
              {groupsError ? <p className="mt-2 text-sm text-rose-600">{groupsError}</p> : null}
            </div>

            <div className="px-2 py-2">
              {groupsLoading ? (
                <p className="px-3 py-4 text-sm text-zinc-600">Cargando grupos…</p>
              ) : groups.length === 0 ? (
                <p className="px-3 py-4 text-sm text-zinc-600">
                  Aún no hay grupos. Crea uno para empezar.
                </p>
              ) : (
                <ul className="space-y-1">
                  {groups.map((group) => {
                    const isActive = selectedGroupId === group.id;
                    return (
                      <li key={group.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedGroupId(group.id)}
                          className={classNames(
                            "w-full rounded-xl px-3 py-3 text-left transition",
                            isActive ? "bg-zinc-100" : "hover:bg-zinc-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-zinc-900">{group.name}</p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {group.memberCount} miembro{group.memberCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            <span className="text-xs text-zinc-400">{formatDate(group.created_at)}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    {selectedGroup ? selectedGroup.name : "Selecciona un grupo"}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    {selectedGroup
                      ? "Gestiona los miembros de este grupo."
                      : "Elige un grupo a la izquierda para ver y gestionar sus miembros."}
                  </p>
                </div>
                {selectedGroup ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetGroupId(selectedGroup.id);
                        setActiveTab("contacts");
                      }}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Añadir miembros
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(selectedGroup.id)}
                      disabled={Boolean(deletingGroupId)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingGroupId === selectedGroup.id ? "Eliminando..." : "Eliminar grupo"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="px-5 py-6">
              {!selectedGroup ? null : groupMembersLoading ? (
                <p className="text-sm text-zinc-600">Cargando miembros…</p>
              ) : groupMembersError ? (
                <p className="text-sm text-rose-600">{groupMembersError}</p>
              ) : groupMembers.length === 0 ? (
                <div>
                  <p className="text-sm font-medium text-zinc-800">Aún no hay miembros</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Usa «Añadir miembros» para seleccionar asistentes de las inscripciones.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {groupMembers.map((member) => (
                    <li key={member.registrationId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{member.fullName}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {member.email}
                          {member.phone !== "-" ? ` · ${member.phone}` : ""}
                          {" · "}
                          {member.eventTitle}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectedGroupId && handleRemoveMember(selectedGroupId, member.registrationId)}
                        disabled={removingMemberId === member.registrationId}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingMemberId === member.registrationId ? "Quitando..." : "Quitar"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
