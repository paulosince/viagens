import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0'
import { pipeline } from 'npm:@supabase/middleware@^0.5.0'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@^1.6.0'
import { z } from 'npm:zod@^4.3.6'

const AUTH_SCHEMES = [{ type: 'oauth2', scopes: ['openid', 'email', 'profile'] }] as const

const activityInput = z.object({
  title: z.string().min(1).max(240),
  start_time: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/).optional(),
  description: z.string().max(4000).nullable().optional(),
  place_name: z.string().max(300).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  ticket_required: z.boolean().optional(),
  meal: z.string().max(120).nullable().optional(),
  transport: z.string().max(240).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
})

const dayPlanInput = z.object({
  title: z.string().max(240).nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  activities: z.array(activityInput).max(80).optional(),
})

const passengerInput = z.object({
  name: z.string().min(1).max(160),
  birth_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
})

function toolConfig(config: Record<string, unknown>) {
  return {
    ...config,
    securitySchemes: AUTH_SCHEMES,
    _meta: {
      ...((config._meta as Record<string, unknown>) || {}),
      securitySchemes: AUTH_SCHEMES,
    },
  } as any
}

function ok(data: unknown, message?: string) {
  const payload = message ? { message, data } : data
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  }
}

function fail(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  }
}

function addDays(date: string, offset: number) {
  const [y, m, d] = date.split('-').map(Number)
  const value = new Date(Date.UTC(y, m - 1, d + offset, 12))
  return value.toISOString().slice(0, 10)
}

function periodFromTime(time?: string | null) {
  if (!time) return 'morning'
  const hour = Number(time.slice(0, 2))
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'night'
}

function jwtPayload(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\\s+/i, '')
    if (!token) return {}
    const part = token.split('.')[1]
    if (!part) return {}
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return {}
  }
}

async function currentUser(supabase: any) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error(error?.message || 'Usuário não autenticado.')
  return data.user
}

async function ensureBaseline(supabase: any, tripId: string) {
  const { error } = await supabase.rpc('ensure_trip_baseline_snapshot', { p_trip_id: tripId })
  if (error) throw new Error(error.message)
}

async function recordChange(
  supabase: any,
  req: Request,
  tripId: string,
  entityType: string,
  entityId: string | null,
  action: string,
  summary: string,
  beforeState: unknown = null,
  afterState: unknown = null,
) {
  const snapshotId = crypto.randomUUID()
  const { error: snapshotError } = await supabase.rpc('capture_trip_snapshot', {
    p_snapshot_id: snapshotId,
    p_trip_id: tripId,
    p_label: summary,
  })
  if (snapshotError) throw new Error(snapshotError.message)

  const user = await currentUser(supabase)
  const payload: any = jwtPayload(req)
  const { error: logError } = await supabase.from('change_log').insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    trip_id: tripId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
    before_state: beforeState,
    after_state: afterState,
    snapshot_id: snapshotId,
    source: 'chatgpt',
    client_id: payload?.client_id || null,
  })
  if (logError) throw new Error(logError.message)
  return snapshotId
}

async function getTrip(supabase: any, tripId: string) {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).single()
  if (error || !data) throw new Error(error?.message || 'Viagem não encontrada.')
  return data
}

async function getDay(supabase: any, dayId: string) {
  const { data, error } = await supabase.from('trip_days').select('*').eq('id', dayId).single()
  if (error || !data) throw new Error(error?.message || 'Dia não encontrado.')
  return data
}

async function getActivity(supabase: any, activityId: string) {
  const { data, error } = await supabase.from('activities').select('*').eq('id', activityId).single()
  if (error || !data) throw new Error(error?.message || 'Atividade não encontrada.')
  return data
}

async function tripIdForActivity(supabase: any, activityId: string) {
  const activity = await getActivity(supabase, activityId)
  const day = await getDay(supabase, activity.day_id)
  return { activity, day, tripId: day.trip_id }
}

async function tripIdForLocation(supabase: any, locationId: string) {
  const { data, error } = await supabase.from('day_locations').select('*').eq('id', locationId).single()
  if (error || !data) throw new Error(error?.message || 'Local não encontrado.')
  const day = await getDay(supabase, data.day_id)
  return { location: data, day, tripId: day.trip_id }
}

async function nextPosition(supabase: any, table: string, column: string, id: string) {
  const { data, error } = await supabase
    .from(table)
    .select('position')
    .eq(column, id)
    .order('position', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  return (data?.[0]?.position ?? -1) + 1
}

async function setTripDurationInternal(supabase: any, tripId: string, dayCount: number) {
  const trip = await getTrip(supabase, tripId)
  const { data: days, error } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('position')
  if (error) throw new Error(error.message)

  const existing = days || []

  for (const day of existing) {
    if (day.position >= dayCount && !day.is_hidden) {
      const { error: hideError } = await supabase
        .from('trip_days')
        .update({ is_hidden: true })
        .eq('id', day.id)
      if (hideError) throw new Error(hideError.message)
    }
  }

  const occupied = new Set(existing.filter((d: any) => d.position < dayCount).map((d: any) => d.position))
  const missing: any[] = []
  for (let position = 0; position < dayCount; position += 1) {
    if (!occupied.has(position)) {
      missing.push({
        trip_id: tripId,
        position,
        is_hidden: false,
        status: 'empty',
      })
    }
  }
  if (missing.length) {
    const { error: insertError } = await supabase.from('trip_days').insert(missing)
    if (insertError) throw new Error(insertError.message)
  }

  const { data: updated, error: updateError } = await supabase
    .from('trips')
    .update({ day_count: dayCount })
    .eq('id', tripId)
    .select()
    .single()
  if (updateError) throw new Error(updateError.message)
  return { before: trip, after: updated }
}

async function getFullTrip(supabase: any, tripId: string) {
  const trip = await getTrip(supabase, tripId)

  const { data: days, error: dayError } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('position')
  if (dayError) throw new Error(dayError.message)

  const dayIds = (days || []).map((d: any) => d.id)
  let activities: any[] = []
  let locations: any[] = []

  if (dayIds.length) {
    const [activityResult, locationResult] = await Promise.all([
      supabase.from('activities').select('*').in('day_id', dayIds).order('position'),
      supabase.from('day_locations').select('*').in('day_id', dayIds).order('position'),
    ])
    if (activityResult.error) throw new Error(activityResult.error.message)
    if (locationResult.error) throw new Error(locationResult.error.message)
    activities = activityResult.data || []
    locations = locationResult.data || []
  }

  const [passengerResult, checklistResult, budgetResult] = await Promise.all([
    supabase.from('passengers').select('*').eq('trip_id', tripId).order('created_at'),
    supabase.from('checklist_items').select('*').eq('trip_id', tripId),
    supabase.from('budget_items').select('*').eq('trip_id', tripId),
  ])
  if (passengerResult.error) throw new Error(passengerResult.error.message)
  if (checklistResult.error) throw new Error(checklistResult.error.message)
  if (budgetResult.error) throw new Error(budgetResult.error.message)

  const enrichedDays = (days || []).map((day: any) => ({
    ...day,
    day_number: day.position + 1,
    date: trip.start_date ? addDays(trip.start_date, day.position) : null,
    activities: activities.filter((a: any) => a.day_id === day.id),
    locations: locations.filter((l: any) => l.day_id === day.id),
  }))

  return {
    trip: {
      ...trip,
      end_date: trip.start_date ? addDays(trip.start_date, trip.day_count - 1) : null,
    },
    passengers: passengerResult.data || [],
    days: enrichedDays,
    checklist_items: checklistResult.data || [],
    budget_items: budgetResult.data || [],
  }
}

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase({ auth: 'user' })],
    async (req, { supabase }) => {
      const handler = createMcpHandler(() => {
        const server = new McpServer({
          name: 'Viaggio',
          version: '1.0.0',
          instructions:
            'Viaggio manages trips. Calendar dates are derived from trip.start_date plus each day position. ' +
            'Use IDs returned by read tools for mutations. Before destructive changes, prefer reading the trip first. ' +
            'Every ChatGPT mutation creates a restorable snapshot in the Viaggio change log.',
        })

        server.registerTool(
          'get_profile',
          toolConfig({
            title: 'Get Viaggio profile',
            description: 'Return the Viaggio profile represented by the authenticated account.',
            inputSchema: z.object({}),
            outputSchema: z.object({
              id: z.string(),
              name: z.string().optional(),
              email: z.string().optional(),
              nickname: z.string().optional(),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
            _meta: { 'openai/profile': true },
          }),
          async () => {
            const user = await currentUser(supabase)
            const { data: profile } = await supabase
              .from('passenger_profiles')
              .select('name,birth_date')
              .eq('user_id', user.id)
              .maybeSingle()

            const result = {
              id: user.id,
              name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || undefined,
              email: user.email || undefined,
              nickname: profile?.name ? profile.name + ' · Viaggio' : 'Viaggio',
            }
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result) }],
              structuredContent: result,
            }
          },
        )

        server.registerTool(
          'update_profile',
          toolConfig({
            title: 'Update Viaggio profile',
            description: 'Change the signed-in user profile name and/or birth date. Does not delete the account.',
            inputSchema: z.object({
              name: z.string().min(1).max(160).optional(),
              birth_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable().optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async (args) => {
            const user = await currentUser(supabase)
            const patch: any = {}
            if (args.name !== undefined) patch.name = args.name
            if (args.birth_date !== undefined) patch.birth_date = args.birth_date
            const { data, error } = await supabase
              .from('passenger_profiles')
              .upsert({ user_id: user.id, ...patch })
              .select()
              .single()
            if (error) throw new Error(error.message)
            return ok(data, 'Perfil atualizado.')
          },
        )

        server.registerTool(
          'list_trips',
          toolConfig({
            title: 'List trips',
            description: 'List Viaggio trips available to the signed-in user. Dates shown are derived from start_date and day_count.',
            inputSchema: z.object({
              include_deleted: z.boolean().default(false),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          }),
          async ({ include_deleted }) => {
            let query = supabase.from('trips').select('*').order('start_date', { ascending: true })
            if (!include_deleted) query = query.is('deleted_at', null)
            const { data, error } = await query
            if (error) throw new Error(error.message)
            const trips = (data || []).map((trip: any) => ({
              ...trip,
              end_date: trip.start_date ? addDays(trip.start_date, trip.day_count - 1) : null,
            }))
            return ok(trips)
          },
        )

        server.registerTool(
          'get_trip',
          toolConfig({
            title: 'Get complete trip',
            description: 'Read a complete trip including passengers, ordered days, derived dates, agenda activities, locations, checklist, and budget.',
            inputSchema: z.object({ trip_id: z.string().uuid() }),
            annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          }),
          async ({ trip_id }) => ok(await getFullTrip(supabase, trip_id)),
        )

        server.registerTool(
          'create_trip',
          toolConfig({
            title: 'Create trip',
            description:
              'Create a Viaggio trip. Can also create passengers and a complete day-by-day agenda in one call. ' +
              'The trip stores only start_date and day_count; each day date is derived from its position.',
            inputSchema: z.object({
              name: z.string().min(1).max(240),
              destination: z.string().min(1).max(240),
              start_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
              day_count: z.number().int().min(1).max(365),
              arrival_method: z.string().max(160).nullable().optional(),
              location_label: z.string().max(240).nullable().optional(),
              cover_url: z.string().url().nullable().optional(),
              secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
              passengers: z.array(passengerInput).max(30).optional(),
              days: z.array(dayPlanInput).max(365).optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async (args) => {
            const user = await currentUser(supabase)
            const { data: trip, error: tripError } = await supabase
              .from('trips')
              .insert({
                user_id: user.id,
                name: args.name,
                destination: args.destination,
                start_date: args.start_date,
                day_count: args.day_count,
                arrival_method: args.arrival_method ?? null,
                location_label: args.location_label ?? null,
                cover_url: args.cover_url ?? null,
                secondary_color: args.secondary_color || '#b89d63',
              })
              .select()
              .single()
            if (tripError) throw new Error(tripError.message)

            const { error: memberError } = await supabase.from('trip_members').insert({
              trip_id: trip.id,
              user_id: user.id,
              role: 'owner',
            })
            if (memberError) throw new Error(memberError.message)

            const dayRows = Array.from({ length: args.day_count }, (_, position) => ({
              trip_id: trip.id,
              position,
              is_hidden: false,
              status: 'empty',
            }))
            const { data: days, error: dayError } = await supabase
              .from('trip_days')
              .insert(dayRows)
              .select()
            if (dayError) throw new Error(dayError.message)

            if (args.passengers?.length) {
              const { error } = await supabase.from('passengers').insert(
                args.passengers.map((p) => ({
                  trip_id: trip.id,
                  name: p.name,
                  birth_date: p.birth_date ?? null,
                  photo_url: p.photo_url ?? null,
                })),
              )
              if (error) throw new Error(error.message)
            }

            if (args.days?.length) {
              const orderedDays = [...(days || [])].sort((a: any, b: any) => a.position - b.position)
              for (let i = 0; i < Math.min(args.days.length, orderedDays.length); i += 1) {
                const plan = args.days[i]
                const day = orderedDays[i]
                const patch: any = {}
                if (plan.title !== undefined) patch.title = plan.title
                if (plan.summary !== undefined) patch.summary = plan.summary
                if (plan.photo_url !== undefined) patch.photo_url = plan.photo_url
                if (Object.keys(patch).length) {
                  patch.status = 'planned'
                  const { error } = await supabase.from('trip_days').update(patch).eq('id', day.id)
                  if (error) throw new Error(error.message)
                }
                if (plan.activities?.length) {
                  const rows = plan.activities.map((a, position) => ({
                    day_id: day.id,
                    period: periodFromTime(a.start_time),
                    position,
                    title: a.title,
                    description: a.description ?? null,
                    place_name: a.place_name ?? null,
                    address: a.address ?? null,
                    latitude: a.latitude ?? null,
                    longitude: a.longitude ?? null,
                    photo_url: a.photo_url ?? null,
                    ticket_required: a.ticket_required ?? false,
                    meal: a.meal ?? null,
                    transport: a.transport ?? null,
                    notes: a.notes ?? null,
                    start_time: a.start_time ? a.start_time + ':00' : null,
                  }))
                  const { error } = await supabase.from('activities').insert(rows)
                  if (error) throw new Error(error.message)
                }
              }
            }

            const snapshotId = await recordChange(
              supabase, req, trip.id, 'trip', trip.id, 'create',
              'Viagem “' + trip.name + '” criada via ChatGPT',
              null,
              { name: trip.name, start_date: trip.start_date, day_count: trip.day_count },
            )
            return ok({ trip_id: trip.id, snapshot_id: snapshotId }, 'Viagem criada.')
          },
        )

        server.registerTool(
          'update_trip',
          toolConfig({
            title: 'Update trip settings',
            description: 'Update owner-controlled trip settings. Use set_trip_duration to change the number of days.',
            inputSchema: z.object({
              trip_id: z.string().uuid(),
              name: z.string().min(1).max(240).optional(),
              destination: z.string().min(1).max(240).optional(),
              start_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
              arrival_method: z.string().max(160).nullable().optional(),
              location_label: z.string().max(240).nullable().optional(),
              cover_url: z.string().url().nullable().optional(),
              secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ trip_id, ...patch }) => {
            const before = await getTrip(supabase, trip_id)
            await ensureBaseline(supabase, trip_id)
            const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
            const { data, error } = await supabase.from('trips').update(clean).eq('id', trip_id).select().single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, trip_id, 'trip', trip_id, 'update',
              'Configurações da viagem “' + data.name + '” alteradas via ChatGPT',
              before, data,
            )
            return ok({ trip: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'set_trip_duration',
          toolConfig({
            title: 'Change trip duration',
            description:
              'Set trip day_count. Shortening hides excess days without deleting them. Expanding reveals previously hidden days as recoverable, preserving their content.',
            inputSchema: z.object({
              trip_id: z.string().uuid(),
              day_count: z.number().int().min(1).max(365),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ trip_id, day_count }) => {
            await ensureBaseline(supabase, trip_id)
            const result = await setTripDurationInternal(supabase, trip_id, day_count)
            const snapshotId = await recordChange(
              supabase, req, trip_id, 'trip', trip_id, 'update',
              'Duração da viagem alterada para ' + day_count + ' dias via ChatGPT',
              { day_count: result.before.day_count },
              { day_count },
            )
            return ok({ day_count, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'delete_trip',
          toolConfig({
            title: 'Delete trip',
            description: 'Soft-delete a trip. The record remains recoverable; this does not delete the user account.',
            inputSchema: z.object({ trip_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
          }),
          async ({ trip_id }) => {
            const trip = await getTrip(supabase, trip_id)
            await ensureBaseline(supabase, trip_id)
            const deletedAt = new Date().toISOString()
            const { error } = await supabase.from('trips').update({ deleted_at: deletedAt }).eq('id', trip_id)
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, trip_id, 'trip', trip_id, 'delete',
              'Viagem “' + trip.name + '” movida para excluídas via ChatGPT',
              { deleted_at: trip.deleted_at },
              { deleted_at: deletedAt },
            )
            return ok({ deleted_at: deletedAt, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'restore_trip',
          toolConfig({
            title: 'Restore deleted trip',
            description: 'Restore a soft-deleted trip.',
            inputSchema: z.object({ trip_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ trip_id }) => {
            const trip = await getTrip(supabase, trip_id)
            await ensureBaseline(supabase, trip_id)
            const { error } = await supabase.from('trips').update({ deleted_at: null }).eq('id', trip_id)
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, trip_id, 'trip', trip_id, 'restore',
              'Viagem “' + trip.name + '” restaurada via ChatGPT',
              { deleted_at: trip.deleted_at },
              { deleted_at: null },
            )
            return ok({ restored: true, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'update_day',
          toolConfig({
            title: 'Update day',
            description: 'Edit a day title, summary, or cover image. A day has no stored calendar date; its date follows its trip position.',
            inputSchema: z.object({
              day_id: z.string().uuid(),
              title: z.string().max(240).nullable().optional(),
              summary: z.string().max(4000).nullable().optional(),
              photo_url: z.string().url().nullable().optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ day_id, ...patch }) => {
            const before = await getDay(supabase, day_id)
            await ensureBaseline(supabase, before.trip_id)
            const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
            const { data, error } = await supabase
              .from('trip_days')
              .update({ ...clean, status: 'planned' })
              .eq('id', day_id)
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, before.trip_id, 'trip_day', day_id, 'update',
              'Dia ' + (before.position + 1) + ' alterado via ChatGPT',
              before, data,
            )
            return ok({ day: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'move_day',
          toolConfig({
            title: 'Move day',
            description: 'Move one day to a new 1-based day number. All agenda content moves with the day.',
            inputSchema: z.object({
              day_id: z.string().uuid(),
              target_day_number: z.number().int().min(1),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ day_id, target_day_number }) => {
            const day = await getDay(supabase, day_id)
            const trip = await getTrip(supabase, day.trip_id)
            const target = Math.min(target_day_number - 1, trip.day_count - 1)
            await ensureBaseline(supabase, day.trip_id)

            const { data: days, error } = await supabase
              .from('trip_days')
              .select('id,position')
              .eq('trip_id', day.trip_id)
              .is('deleted_at', null)
              .lt('position', trip.day_count)
              .order('position')
            if (error) throw new Error(error.message)

            const ordered = [...(days || [])]
            const from = ordered.findIndex((item: any) => item.id === day_id)
            if (from < 0) throw new Error('Dia não encontrado na ordem ativa.')
            const [moved] = ordered.splice(from, 1)
            ordered.splice(target, 0, moved)

            const base = 100000
            for (let i = 0; i < ordered.length; i += 1) {
              const { error: tempError } = await supabase
                .from('trip_days')
                .update({ position: base + i })
                .eq('id', ordered[i].id)
              if (tempError) throw new Error(tempError.message)
            }
            for (let i = 0; i < ordered.length; i += 1) {
              const { error: finalError } = await supabase
                .from('trip_days')
                .update({ position: i })
                .eq('id', ordered[i].id)
              if (finalError) throw new Error(finalError.message)
            }

            const snapshotId = await recordChange(
              supabase, req, day.trip_id, 'trip_day', day_id, 'reorder',
              'Dia ' + (from + 1) + ' movido para o dia ' + (target + 1) + ' via ChatGPT',
              { position: from },
              { position: target },
            )
            return ok({ from_day_number: from + 1, to_day_number: target + 1, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'recover_day',
          toolConfig({
            title: 'Recover hidden day',
            description: 'Recover a day that was hidden when the trip duration was shortened.',
            inputSchema: z.object({ day_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ day_id }) => {
            const day = await getDay(supabase, day_id)
            await ensureBaseline(supabase, day.trip_id)
            const { data, error } = await supabase
              .from('trip_days')
              .update({ is_hidden: false, status: day.status === 'hidden' ? 'planned' : day.status })
              .eq('id', day_id)
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, day.trip_id, 'trip_day', day_id, 'restore',
              'Dia ' + (day.position + 1) + ' recuperado via ChatGPT',
              { is_hidden: true },
              { is_hidden: false },
            )
            return ok({ day: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'delete_day',
          toolConfig({
            title: 'Delete day',
            description:
              'Soft-delete a day into Recently Deleted and create a blank replacement in the same trip position. ' +
              'The deleted day remains recoverable for 30 days.',
            inputSchema: z.object({ day_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
          }),
          async ({ day_id }) => {
            const day = await getDay(supabase, day_id)
            await ensureBaseline(supabase, day.trip_id)
            const deletedAt = new Date().toISOString()
            const { error: deleteError } = await supabase
              .from('trip_days')
              .update({ deleted_at: deletedAt, is_hidden: true })
              .eq('id', day_id)
            if (deleteError) throw new Error(deleteError.message)

            const { data: replacement, error: replacementError } = await supabase
              .from('trip_days')
              .insert({
                trip_id: day.trip_id,
                position: day.position,
                is_hidden: false,
                status: 'empty',
              })
              .select()
              .single()
            if (replacementError) throw new Error(replacementError.message)

            const snapshotId = await recordChange(
              supabase, req, day.trip_id, 'trip_day', day_id, 'delete',
              'Dia ' + (day.position + 1) + ' movido para Apagados recentemente via ChatGPT',
              { deleted_at: null },
              { deleted_at: deletedAt, replacement_day_id: replacement.id },
            )
            return ok({ deleted_at: deletedAt, replacement_day_id: replacement.id, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'add_activity',
          toolConfig({
            title: 'Add activity',
            description: 'Add an agenda activity to a day. Time is HH:MM and does not contain a calendar date.',
            inputSchema: z.object({ day_id: z.string().uuid(), activity: activityInput }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ day_id, activity }) => {
            const day = await getDay(supabase, day_id)
            await ensureBaseline(supabase, day.trip_id)
            const position = await nextPosition(supabase, 'activities', 'day_id', day_id)
            const { data, error } = await supabase
              .from('activities')
              .insert({
                day_id,
                position,
                period: periodFromTime(activity.start_time),
                title: activity.title,
                description: activity.description ?? null,
                place_name: activity.place_name ?? null,
                address: activity.address ?? null,
                latitude: activity.latitude ?? null,
                longitude: activity.longitude ?? null,
                photo_url: activity.photo_url ?? null,
                ticket_required: activity.ticket_required ?? false,
                meal: activity.meal ?? null,
                transport: activity.transport ?? null,
                notes: activity.notes ?? null,
                start_time: activity.start_time ? activity.start_time + ':00' : null,
              })
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, day.trip_id, 'activity', data.id, 'create',
              'Atividade “' + data.title + '” adicionada ao dia ' + (day.position + 1) + ' via ChatGPT',
              null, data,
            )
            return ok({ activity: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'update_activity',
          toolConfig({
            title: 'Update activity',
            description: 'Edit an agenda activity, including time, text, place data, photo, and optionally move it to another day in the same trip.',
            inputSchema: z.object({
              activity_id: z.string().uuid(),
              target_day_id: z.string().uuid().optional(),
              title: z.string().min(1).max(240).optional(),
              start_time: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/).nullable().optional(),
              description: z.string().max(4000).nullable().optional(),
              place_name: z.string().max(300).nullable().optional(),
              address: z.string().max(500).nullable().optional(),
              latitude: z.number().min(-90).max(90).nullable().optional(),
              longitude: z.number().min(-180).max(180).nullable().optional(),
              photo_url: z.string().url().nullable().optional(),
              ticket_required: z.boolean().optional(),
              meal: z.string().max(120).nullable().optional(),
              transport: z.string().max(240).nullable().optional(),
              notes: z.string().max(4000).nullable().optional(),
              position: z.number().int().min(0).optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ activity_id, target_day_id, start_time, ...patch }) => {
            const { activity: before, day, tripId } = await tripIdForActivity(supabase, activity_id)
            await ensureBaseline(supabase, tripId)
            const clean: any = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))

            if (target_day_id) {
              const targetDay = await getDay(supabase, target_day_id)
              if (targetDay.trip_id !== tripId) throw new Error('A atividade só pode ser movida para outro dia da mesma viagem.')
              clean.day_id = target_day_id
              if (clean.position === undefined) clean.position = await nextPosition(supabase, 'activities', 'day_id', target_day_id)
            }
            if (start_time !== undefined) {
              clean.start_time = start_time ? start_time + ':00' : null
              clean.period = periodFromTime(start_time)
            }

            const { data, error } = await supabase
              .from('activities')
              .update(clean)
              .eq('id', activity_id)
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, tripId, 'activity', activity_id, 'update',
              'Atividade “' + data.title + '” alterada via ChatGPT',
              before, data,
            )
            return ok({ activity: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'delete_activity',
          toolConfig({
            title: 'Delete activity',
            description: 'Delete an agenda activity. The trip snapshot keeps the action undoable.',
            inputSchema: z.object({ activity_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
          }),
          async ({ activity_id }) => {
            const { activity, tripId } = await tripIdForActivity(supabase, activity_id)
            await ensureBaseline(supabase, tripId)
            const { error } = await supabase.from('activities').delete().eq('id', activity_id)
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, tripId, 'activity', activity_id, 'delete',
              'Atividade “' + activity.title + '” excluída via ChatGPT',
              activity, null,
            )
            return ok({ deleted: true, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'add_location',
          toolConfig({
            title: 'Add day location',
            description: 'Add a mapped place to a day. Do not invent coordinates; omit latitude/longitude if unknown.',
            inputSchema: z.object({
              day_id: z.string().uuid(),
              name: z.string().min(1).max(300),
              formatted_address: z.string().max(500).nullable().optional(),
              latitude: z.number().min(-90).max(90).nullable().optional(),
              longitude: z.number().min(-180).max(180).nullable().optional(),
              photo_url: z.string().url().nullable().optional(),
              provider: z.string().max(80).nullable().optional(),
              provider_place_id: z.string().max(240).nullable().optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ day_id, ...input }) => {
            const day = await getDay(supabase, day_id)
            await ensureBaseline(supabase, day.trip_id)
            const position = await nextPosition(supabase, 'day_locations', 'day_id', day_id)
            const { data, error } = await supabase
              .from('day_locations')
              .insert({ day_id, position, ...input })
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, day.trip_id, 'day_location', data.id, 'create',
              'Local “' + data.name + '” adicionado ao dia ' + (day.position + 1) + ' via ChatGPT',
              null, data,
            )
            return ok({ location: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'update_location',
          toolConfig({
            title: 'Update day location',
            description: 'Edit a mapped place attached to a day.',
            inputSchema: z.object({
              location_id: z.string().uuid(),
              name: z.string().min(1).max(300).optional(),
              formatted_address: z.string().max(500).nullable().optional(),
              latitude: z.number().min(-90).max(90).nullable().optional(),
              longitude: z.number().min(-180).max(180).nullable().optional(),
              photo_url: z.string().url().nullable().optional(),
              provider: z.string().max(80).nullable().optional(),
              provider_place_id: z.string().max(240).nullable().optional(),
              position: z.number().int().min(0).optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ location_id, ...patch }) => {
            const { location: before, tripId } = await tripIdForLocation(supabase, location_id)
            await ensureBaseline(supabase, tripId)
            const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
            const { data, error } = await supabase
              .from('day_locations')
              .update(clean)
              .eq('id', location_id)
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, tripId, 'day_location', location_id, 'update',
              'Local “' + data.name + '” alterado via ChatGPT',
              before, data,
            )
            return ok({ location: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'delete_location',
          toolConfig({
            title: 'Delete day location',
            description: 'Delete a mapped place from a day. The trip snapshot keeps the action undoable.',
            inputSchema: z.object({ location_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
          }),
          async ({ location_id }) => {
            const { location, tripId } = await tripIdForLocation(supabase, location_id)
            await ensureBaseline(supabase, tripId)
            const { error } = await supabase.from('day_locations').delete().eq('id', location_id)
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, tripId, 'day_location', location_id, 'delete',
              'Local “' + location.name + '” excluído via ChatGPT',
              location, null,
            )
            return ok({ deleted: true, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'add_passenger',
          toolConfig({
            title: 'Add passenger',
            description: 'Add a passenger to a trip.',
            inputSchema: z.object({ trip_id: z.string().uuid(), passenger: passengerInput }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ trip_id, passenger }) => {
            await getTrip(supabase, trip_id)
            await ensureBaseline(supabase, trip_id)
            const { data, error } = await supabase
              .from('passengers')
              .insert({ trip_id, ...passenger })
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, trip_id, 'passenger', data.id, 'create',
              'Passageiro “' + data.name + '” adicionado via ChatGPT',
              null, data,
            )
            return ok({ passenger: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'update_passenger',
          toolConfig({
            title: 'Update passenger',
            description: 'Edit a passenger name, birth date, or photo URL.',
            inputSchema: z.object({
              passenger_id: z.string().uuid(),
              name: z.string().min(1).max(160).optional(),
              birth_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable().optional(),
              photo_url: z.string().url().nullable().optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ passenger_id, ...patch }) => {
            const { data: before, error: beforeError } = await supabase
              .from('passengers')
              .select('*')
              .eq('id', passenger_id)
              .single()
            if (beforeError) throw new Error(beforeError.message)
            await ensureBaseline(supabase, before.trip_id)
            const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
            const { data, error } = await supabase
              .from('passengers')
              .update(clean)
              .eq('id', passenger_id)
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, before.trip_id, 'passenger', passenger_id, 'update',
              'Passageiro “' + data.name + '” alterado via ChatGPT',
              before, data,
            )
            return ok({ passenger: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'delete_passenger',
          toolConfig({
            title: 'Delete passenger',
            description: 'Remove a passenger from a trip. The trip snapshot keeps the action undoable.',
            inputSchema: z.object({ passenger_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
          }),
          async ({ passenger_id }) => {
            const { data: passenger, error: beforeError } = await supabase
              .from('passengers')
              .select('*')
              .eq('id', passenger_id)
              .single()
            if (beforeError) throw new Error(beforeError.message)
            await ensureBaseline(supabase, passenger.trip_id)
            const { error } = await supabase.from('passengers').delete().eq('id', passenger_id)
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, passenger.trip_id, 'passenger', passenger_id, 'delete',
              'Passageiro “' + passenger.name + '” removido via ChatGPT',
              passenger, null,
            )
            return ok({ deleted: true, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'list_change_log',
          toolConfig({
            title: 'List change history',
            description: 'List recent Viaggio changes and restorable snapshot IDs for the signed-in user.',
            inputSchema: z.object({
              trip_id: z.string().uuid().optional(),
              limit: z.number().int().min(1).max(150).default(50),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          }),
          async ({ trip_id, limit }) => {
            let query = supabase
              .from('change_log')
              .select('id,trip_id,entity_type,entity_id,action,summary,snapshot_id,source,client_id,created_at')
              .order('created_at', { ascending: false })
              .limit(limit)
            if (trip_id) query = query.eq('trip_id', trip_id)
            const { data, error } = await query
            if (error) throw new Error(error.message)
            return ok(data || [])
          },
        )

        server.registerTool(
          'restore_snapshot',
          toolConfig({
            title: 'Restore trip snapshot',
            description:
              'Restore an entire trip to a previous snapshot ID. This replaces current trip content with the snapshot state. ' +
              'A safety snapshot of the current state is created automatically first, so the restore itself can be undone.',
            inputSchema: z.object({ snapshot_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
          }),
          async ({ snapshot_id }) => {
            const { data, error } = await supabase.rpc('restore_trip_snapshot', {
              p_snapshot_id: snapshot_id,
            })
            if (error) throw new Error(error.message)
            return ok(data, 'Viagem restaurada para o snapshot solicitado.')
          },
        )

        server.registerTool(
          'add_checklist_item',
          toolConfig({
            title: 'Add checklist item',
            description: 'Add a checklist item to a trip, optionally linked to an activity.',
            inputSchema: z.object({
              trip_id: z.string().uuid(),
              label: z.string().min(1).max(300),
              activity_id: z.string().uuid().nullable().optional(),
              due_at: z.string().datetime().nullable().optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ trip_id, ...input }) => {
            await getTrip(supabase, trip_id)
            await ensureBaseline(supabase, trip_id)
            const { data, error } = await supabase
              .from('checklist_items')
              .insert({ trip_id, ...input })
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, trip_id, 'checklist_item', data.id, 'create',
              'Item de checklist “' + data.label + '” criado via ChatGPT',
              null, data,
            )
            return ok({ item: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'update_checklist_item',
          toolConfig({
            title: 'Update checklist item',
            description: 'Edit or complete a checklist item.',
            inputSchema: z.object({
              item_id: z.string().uuid(),
              label: z.string().min(1).max(300).optional(),
              due_at: z.string().datetime().nullable().optional(),
              completed: z.boolean().optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ item_id, ...patch }) => {
            const { data: before, error: beforeError } = await supabase
              .from('checklist_items')
              .select('*')
              .eq('id', item_id)
              .single()
            if (beforeError) throw new Error(beforeError.message)
            await ensureBaseline(supabase, before.trip_id)
            const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
            const { data, error } = await supabase
              .from('checklist_items')
              .update(clean)
              .eq('id', item_id)
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, before.trip_id, 'checklist_item', item_id, 'update',
              'Checklist “' + data.label + '” alterado via ChatGPT',
              before, data,
            )
            return ok({ item: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'delete_checklist_item',
          toolConfig({
            title: 'Delete checklist item',
            description: 'Delete a checklist item. The trip snapshot keeps the action undoable.',
            inputSchema: z.object({ item_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
          }),
          async ({ item_id }) => {
            const { data: before, error: beforeError } = await supabase
              .from('checklist_items')
              .select('*')
              .eq('id', item_id)
              .single()
            if (beforeError) throw new Error(beforeError.message)
            await ensureBaseline(supabase, before.trip_id)
            const { error } = await supabase.from('checklist_items').delete().eq('id', item_id)
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, before.trip_id, 'checklist_item', item_id, 'delete',
              'Checklist “' + before.label + '” excluído via ChatGPT',
              before, null,
            )
            return ok({ deleted: true, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'add_budget_item',
          toolConfig({
            title: 'Add budget item',
            description: 'Add a budget item to a trip, optionally linked to an activity.',
            inputSchema: z.object({
              trip_id: z.string().uuid(),
              label: z.string().min(1).max(300),
              activity_id: z.string().uuid().nullable().optional(),
              category: z.string().max(120).nullable().optional(),
              currency: z.string().length(3).default('BRL'),
              planned_amount: z.number().nonnegative().nullable().optional(),
              actual_amount: z.number().nonnegative().nullable().optional(),
              purchase_status: z.string().max(80).optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ trip_id, ...input }) => {
            await getTrip(supabase, trip_id)
            await ensureBaseline(supabase, trip_id)
            const { data, error } = await supabase
              .from('budget_items')
              .insert({ trip_id, ...input })
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, trip_id, 'budget_item', data.id, 'create',
              'Orçamento “' + data.label + '” criado via ChatGPT',
              null, data,
            )
            return ok({ item: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'update_budget_item',
          toolConfig({
            title: 'Update budget item',
            description: 'Edit a trip budget item.',
            inputSchema: z.object({
              item_id: z.string().uuid(),
              label: z.string().min(1).max(300).optional(),
              category: z.string().max(120).nullable().optional(),
              currency: z.string().length(3).optional(),
              planned_amount: z.number().nonnegative().nullable().optional(),
              actual_amount: z.number().nonnegative().nullable().optional(),
              purchase_status: z.string().max(80).optional(),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
          }),
          async ({ item_id, ...patch }) => {
            const { data: before, error: beforeError } = await supabase
              .from('budget_items')
              .select('*')
              .eq('id', item_id)
              .single()
            if (beforeError) throw new Error(beforeError.message)
            await ensureBaseline(supabase, before.trip_id)
            const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
            const { data, error } = await supabase
              .from('budget_items')
              .update(clean)
              .eq('id', item_id)
              .select()
              .single()
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, before.trip_id, 'budget_item', item_id, 'update',
              'Orçamento “' + data.label + '” alterado via ChatGPT',
              before, data,
            )
            return ok({ item: data, snapshot_id: snapshotId })
          },
        )

        server.registerTool(
          'delete_budget_item',
          toolConfig({
            title: 'Delete budget item',
            description: 'Delete a trip budget item. The trip snapshot keeps the action undoable.',
            inputSchema: z.object({ item_id: z.string().uuid() }),
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
          }),
          async ({ item_id }) => {
            const { data: before, error: beforeError } = await supabase
              .from('budget_items')
              .select('*')
              .eq('id', item_id)
              .single()
            if (beforeError) throw new Error(beforeError.message)
            await ensureBaseline(supabase, before.trip_id)
            const { error } = await supabase.from('budget_items').delete().eq('id', item_id)
            if (error) throw new Error(error.message)
            const snapshotId = await recordChange(
              supabase, req, before.trip_id, 'budget_item', item_id, 'delete',
              'Orçamento “' + before.label + '” excluído via ChatGPT',
              before, null,
            )
            return ok({ deleted: true, snapshot_id: snapshotId })
          },
        )

        return server
      })

      try {
        return await handler.fetch(req)
      } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
    },
  ),
)
