import { getTranslations } from 'next-intl/server';
import { BlocksEditor, HoursEditor, SpecialistEditor, StaffAccess, type BlockRow, type StaffRow } from '@/components/admin/TeamPanels';
import { PageHeader, Panel } from '@/components/admin/ui';
import { localDate, toLocal } from '@/lib/availability/timezone';
import { requireAdmin } from '@/lib/auth/session';
import { formatDateShort, formatTime } from '@/lib/booking/format';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Team & hours' };

function parseRange(r: unknown) {
  const m = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(String(r));
  return m ? { start: new Date(m[1]).toISOString(), end: new Date(m[2]).toISOString() } : null;
}

export default async function TeamPage() {
  const { profile: me } = await requireAdmin('/admin/team');
  const [t, settings] = await Promise.all([getTranslations('bo'), getPublicSettings()]);
  const tz = settings.timezone;
  const supabase = await createClient();

  const [{ data: specialists }, { data: links }, { data: treatments }, { data: categories }, { data: hours }, { data: blocks }, { data: staff }] = await Promise.all([
    supabase.from('specialists').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('specialist_treatments').select('specialist_id, treatment_id'),
    supabase.from('treatments').select('id, name, category_id, sort_order').is('deleted_at', null).order('sort_order'),
    supabase.from('service_categories').select('id, name, sort_order').order('sort_order'),
    supabase.from('working_hours').select('specialist_id, iso_weekday, start_time, end_time').order('iso_weekday').order('start_time'),
    supabase.from('availability_blocks').select('id, specialist_id, range, source, reason').is('deleted_at', null).overlaps('range', `[${new Date().toISOString()},infinity)`),
    supabase.from('profiles').select('id, full_name, email, role').in('role', ['staff', 'admin']).is('deleted_at', null).order('full_name'),
  ]);

  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const catOrder = new Map((categories ?? []).map((c) => [c.id, c.sort_order]));
  const treatmentList = (treatments ?? [])
    .sort((a, b) => (catOrder.get(a.category_id) ?? 0) - (catOrder.get(b.category_id) ?? 0) || a.sort_order - b.sort_order)
    .map((x) => ({ id: x.id, name: x.name, category: catName.get(x.category_id) ?? '' }));
  const specialistName = new Map((specialists ?? []).map((s) => [s.id, s.display_name]));
  const hhmm = (time: string) => time.slice(0, 5);

  const blockRows: BlockRow[] = (blocks ?? [])
    .map((b) => ({ b, r: parseRange(b.range) }))
    .filter((x) => x.r)
    .sort((a, z) => a.r!.start.localeCompare(z.r!.start))
    .map(({ b, r }) => {
      const sameDay = localDate(Date.parse(r!.start), tz) === localDate(Date.parse(r!.end) - 1, tz);
      // Whole days (local midnight to midnight) read as dates, not as 12:00 AM – 12:00 AM
      const midnight = (iso: string) => {
        const l = toLocal(Date.parse(iso), tz);
        return l.hour === 0 && l.minute === 0;
      };
      const allDay = midnight(r!.start) && midnight(r!.end);
      const lastDay = new Date(Date.parse(r!.end) - 1).toISOString();
      const label = allDay
        ? sameDay
          ? `${formatDateShort(r!.start, tz)} · ${t('team.allDayLabel')}`
          : `${formatDateShort(r!.start, tz)} → ${formatDateShort(lastDay, tz)} · ${t('team.allDayLabel')}`
        : sameDay
        ? `${formatDateShort(r!.start, tz)} · ${formatTime(r!.start, tz)} – ${formatTime(r!.end, tz)}`
        : `${formatDateShort(r!.start, tz)} ${formatTime(r!.start, tz)} → ${formatDateShort(r!.end, tz)} ${formatTime(r!.end, tz)}`;
      return { id: b.id, label, source: b.source, reason: b.reason, appliesTo: b.specialist_id ? (specialistName.get(b.specialist_id) ?? '') : t('team.everyone') };
    });

  return (
    <>
      <PageHeader title={t('team.title')} />
      <div className="flex flex-col gap-4">
        <Panel title={t('team.specialists')}>
          <div className="flex flex-col gap-4">
            {(specialists ?? []).map((s) => (
              <SpecialistEditor
                key={s.id}
                treatments={treatmentList}
                specialist={{
                  id: s.id,
                  displayName: s.display_name,
                  bio: s.bio,
                  color: s.color,
                  isActive: s.is_active,
                  treatmentIds: (links ?? []).filter((l) => l.specialist_id === s.id).map((l) => l.treatment_id),
                }}
              />
            ))}
            <details className="rounded-xl border border-dashed border-taupe p-3">
              <summary className="cursor-pointer text-sm font-medium text-ink">+ {t('team.addSpecialist')}</summary>
              <div className="mt-3">
                <SpecialistEditor treatments={treatmentList} />
              </div>
            </details>
          </div>
        </Panel>

        <Panel title={t('team.hours')}>
          <p className="mb-3 text-sm text-muted">{t('team.hoursIntro')}</p>
          <HoursEditor
            specialistId={null}
            initial={(hours ?? []).filter((h) => h.specialist_id === null).map((h) => ({ isoWeekday: h.iso_weekday, start: hhmm(h.start_time), end: hhmm(h.end_time) }))}
          />
        </Panel>

        <Panel title={t('team.blocks')}>
          <p className="mb-3 text-sm text-muted">{t('team.blocksIntro')}</p>
          <BlocksEditor blocks={blockRows} specialists={(specialists ?? []).map((s) => ({ id: s.id, name: s.display_name }))} timeZone={tz} today={localDate(Date.now(), tz)} />
        </Panel>

        <Panel title={t('team.users')}>
          <p className="mb-3 text-sm text-muted">{t('team.usersIntro')}</p>
          <StaffAccess people={(staff ?? []).map((p) => ({ id: p.id, name: p.full_name, email: p.email, role: p.role as StaffRow['role'] }))} meId={me.id} />
        </Panel>
      </div>
    </>
  );
}
