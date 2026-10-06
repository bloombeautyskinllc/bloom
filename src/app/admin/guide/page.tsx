import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/admin/ui';
import { requireStaff } from '@/lib/auth/session';
import adminActivity from '@/assets/guide/admin-activity.jpg';
import adminBookingDetail from '@/assets/guide/admin-booking-detail.jpg';
import adminBookingNew from '@/assets/guide/admin-booking-new.jpg';
import adminBookings from '@/assets/guide/admin-bookings.jpg';
import adminCalendar from '@/assets/guide/admin-calendar.jpg';
import adminCatalog from '@/assets/guide/admin-catalog.jpg';
import adminClientDetail from '@/assets/guide/admin-client-detail.jpg';
import adminClients from '@/assets/guide/admin-clients.jpg';
import adminHome from '@/assets/guide/admin-home.jpg';
import adminSettings from '@/assets/guide/admin-settings.jpg';
import adminTeam from '@/assets/guide/admin-team.jpg';
import booking1 from '@/assets/guide/booking-1-category.jpg';
import booking2 from '@/assets/guide/booking-2-treatment.jpg';
import booking3 from '@/assets/guide/booking-3-next.jpg';
import booking5 from '@/assets/guide/booking-5-confirm.jpg';
import clientDashboard from '@/assets/guide/client-dashboard.jpg';
import mobileAdmin from '@/assets/guide/mobile-admin.jpg';
import mobileHome from '@/assets/guide/mobile-home.jpg';
import mobileTreatment from '@/assets/guide/mobile-treatment.jpg';
import publicHomeHero from '@/assets/guide/public-home-hero.jpg';
import publicHome from '@/assets/guide/public-home.jpg';
import publicSignin from '@/assets/guide/public-signin-modal.jpg';
import publicTerms from '@/assets/guide/public-terms.jpg';
import publicFacials from '@/assets/guide/public-treatment-facials.jpg';

export const metadata = { title: 'Guide' };

// The user guide for the owner and the team, written in Spanish at their request.
// Screenshots use sample client data (names, emails and phones are not real).

const TOC: { part: string; items: [string, string][] }[] = [
  { part: 'La página pública', items: [['inicio', 'Inicio y tratamientos'], ['legales', 'Términos y privacidad']] },
  { part: 'Tus clientas', items: [['cuenta', 'Crear cuenta'], ['reservar', 'Reservar y pagar'], ['mi-cuenta', 'Mi cuenta'], ['correos', 'Correos automáticos']] },
  {
    part: 'El panel interno',
    items: [
      ['entrar', 'Entrar al panel'],
      ['dashboard', 'Dashboard'],
      ['calendario', 'Calendario'],
      ['reservas', 'Reservas'],
      ['detalle', 'Detalle de una reserva'],
      ['nueva', 'Nueva reserva'],
      ['clientas', 'Clientas'],
      ['catalogo', 'Catálogo'],
      ['testimonios', 'Testimonios'],
      ['equipo', 'Equipo y horarios'],
      ['settings', 'Configuración'],
      ['actividad', 'Registro de actividad'],
    ],
  },
  { part: 'Referencia', items: [['estados', 'Estados de una cita'], ['tareas', 'Tareas frecuentes']] },
];

function Section({ id, title, adminOnly, children }: { id: string; title: string; adminOnly?: boolean; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h3 className="mt-12 flex flex-wrap items-center gap-3 font-serif text-[28px] leading-tight text-ink">
        {title}
        {adminOnly && <span className="rounded-full border border-stone px-2.5 py-0.5 font-sans text-xs font-semibold text-muted">Admin</span>}
      </h3>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-ink [&_li]:max-w-[68ch] [&_p]:max-w-[68ch] [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </section>
  );
}

function Part({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mt-16 border-t border-stone pt-8 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="font-serif text-[40px] leading-tight text-ink">{title}</h2>
      {intro && <p className="mt-1 max-w-[68ch] text-sm text-muted">{intro}</p>}
    </div>
  );
}

/** A screenshot; tall ones scroll inside their frame. Clicking opens the full-size image. */
function Shot({ src, alt, caption, tall, width }: { src: StaticImageData; alt: string; caption?: ReactNode; tall?: boolean; width?: number }) {
  return (
    <figure className="my-2" style={width ? { maxWidth: width } : undefined}>
      <a href={src.src} target="_blank" rel="noreferrer" className={`block overflow-hidden rounded-xl border border-stone bg-sand ${tall ? 'max-h-[620px] overflow-y-auto' : ''}`}>
        <Image src={src} alt={alt} sizes="(min-width: 1280px) 780px, 100vw" className="h-auto w-full" placeholder="blur" />
      </a>
      {caption && <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}

const Ui = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap font-semibold">{children}</span>;
const Pill = ({ children }: { children: ReactNode }) => (
  <span className="inline-block whitespace-nowrap rounded-full border border-stone px-2.5 py-0.5 text-xs font-semibold">{children}</span>
);

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="grid max-w-[68ch] grid-cols-[28px_minmax(0,1fr)] gap-3">
          <span className="text-right font-serif text-xl leading-tight text-bronze">{i + 1}</span>
          <div>{item}</div>
        </li>
      ))}
    </ol>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone bg-white/60">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-stone px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-stone last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="border-b border-stone py-3">
      <summary className="cursor-pointer font-semibold">{q}</summary>
      <p className="mt-2">{children}</p>
    </details>
  );
}

export default async function GuidePage() {
  await requireStaff('/admin/guide');

  return (
    <>
      <PageHeader
        title="Guía de uso"
        intro="Todo lo que hace la página: lo que ven tus clientas, cómo reservan y pagan, y cómo manejas citas, clientas, precios, horarios y pagos desde este panel. Las capturas usan datos de ejemplo."
      />

      <div className="grid gap-10 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Contenido" className="rounded-2xl border border-stone bg-cream p-4 text-sm xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:self-start xl:overflow-y-auto">
          {TOC.map((group) => (
            <div key={group.part} className="mb-4 last:mb-0">
              <p className="mb-1 font-serif text-lg text-ink">{group.part}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 xl:flex-col">
                {group.items.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-muted hover:text-ink">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0 max-w-[800px]">
          <Part title="La página pública" intro="Lo que ve cualquier persona que entra al sitio, sin iniciar sesión." />

          <Section id="inicio" title="Inicio y tratamientos">
            <p>
              La página de inicio presenta el estudio: la imagen principal con el botón <Ui>Book your skin consultation</Ui>, las categorías de tratamientos, el método,
              testimonios, preguntas frecuentes y el pie de página con dirección, teléfono, redes y enlaces legales. Arriba a la derecha están el ícono de cuenta y el botón{' '}
              <Ui>Book now</Ui>, que llevan a reservar.
            </p>
            <Shot
              src={publicHomeHero}
              alt="Parte superior de la página de inicio"
              caption={
                <>
                  Inicio, primera pantalla.{' '}
                  <a href={publicHome.src} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    Ver la página completa
                  </a>
                </>
              }
            />
            <p>
              Cada categoría tiene su página con la lista de tratamientos, precios y duraciones: <em>Facials &amp; skin care</em>, <em>Brows &amp; lips</em>, <em>Diode laser</em> e{' '}
              <em>Intimate care</em>. Desde cualquier tratamiento se puede reservar y la clienta llega al flujo de reserva con ese tratamiento ya elegido.
            </p>
            <p>
              Los precios, duraciones y descripciones que se ven al reservar salen del <a href="#catalogo" className="underline underline-offset-2">Catálogo</a>: si cambias un precio ahí, cambia
              en el flujo de reserva.
            </p>
            <Shot src={publicFacials} alt="Página de la categoría Facials" tall caption="Página de una categoría (Facials). Se desplaza dentro del recuadro." />
            <p>El sitio se adapta al celular, que es desde donde reserva la mayoría de las clientas:</p>
            <div className="flex flex-wrap gap-4">
              <Shot src={mobileHome} alt="Inicio en celular" width={260} />
              <Shot src={mobileTreatment} alt="Tratamientos en celular" width={260} />
            </div>
          </Section>

          <Section id="legales" title="Términos, privacidad y formulario de admisión">
            <p>
              En el pie de página están <Ui>Terms of service</Ui>, <Ui>Privacy policy</Ui> y <Ui>Client intake form</Ui>. Los términos publican automáticamente la política de
              cancelación de <a href="#settings" className="underline underline-offset-2">Configuración</a> (horas de anticipación, porcentaje de reembolso, número de reprogramaciones). Si
              cambias esos valores, los términos se actualizan solos.
            </p>
            <Shot src={publicTerms} alt="Términos del servicio" tall caption="Términos del servicio." />
          </Section>

          <Part title="Tus clientas" intro="Cómo crea cuenta una clienta, cómo reserva y paga, y qué puede hacer después con su cita." />

          <Section id="cuenta" title="Crear cuenta e iniciar sesión">
            <p>
              Para reservar, la clienta necesita una cuenta. Se entra solo con Google: al pulsar <Ui>Book now</Ui> aparece esta ventana y basta con <Ui>Continue with Google</Ui>. No hay
              contraseñas que recordar ni que tú tengas que gestionar.
            </p>
            <Shot src={publicSignin} alt="Ventana de inicio de sesión con Google" caption="Paso 1 de 2: inicio de sesión con Google." />
            <p>
              La primera vez hay un paso 2 corto: nombre, teléfono (con código de país) y si quiere recibir recordatorios. Con eso la cuenta queda lista y sigue directo a la reserva que había
              empezado.
            </p>
          </Section>

          <Section id="reservar" title="Reservar y pagar">
            <p>La reserva tiene cuatro pasos y un resumen fijo a la derecha con el tratamiento, la fecha, la duración y el total.</p>
            <Steps
              items={[
                <>
                  <strong>Categoría.</strong> Elige entre las cuatro categorías.
                </>,
                <>
                  <strong>Tratamiento.</strong> Ve los tratamientos de esa categoría con precio y duración. Si el tratamiento tiene opciones (por ejemplo, zonas del láser) aparece un paso extra
                  para elegirlas.
                </>,
                <>
                  <strong>Fecha y hora.</strong> Solo se muestran horas libres según tus horarios, bloqueos, citas existentes, el aviso mínimo y hasta cuántos días adelante se puede reservar.
                  Las horas están en hora de Nueva York.
                </>,
                <>
                  <strong>Confirmar.</strong> Al elegir una hora, el horario queda apartado unos minutos (10 por defecto) mientras confirma. Puede dejar notas, ve la política de cancelación y
                  elige cómo pagar.
                </>,
              ]}
            />
            <Shot src={booking1} alt="Paso 1, categoría" caption="Paso 1: categoría." />
            <Shot src={booking2} alt="Paso 2, tratamiento" caption="Paso 2: tratamiento." />
            <Shot src={booking3} alt="Paso 3, fecha y hora" caption="Paso 3: fecha y hora. Los días con puntito tienen horas libres." />
            <Shot src={booking5} alt="Paso 4, confirmar y elegir pago" tall caption="Paso 4: revisar, elegir depósito o pago completo y continuar al pago." />
            <h4 className="mt-4 font-semibold">Cómo funciona el pago</h4>
            <ul>
              <li>
                La clienta elige <Ui>Pay the deposit</Ui> (el depósito del tratamiento) o <Ui>Pay in full</Ui> (todo ahora).
              </li>
              <li>
                Con <Ui>Continue to payment</Ui> va al checkout seguro de Square: tarjeta, Apple Pay o Google Pay.
              </li>
              <li>
                Cuando el pago entra, la cita pasa a <Pill>Confirmed</Pill>, vuelve a la página y le llega el correo de confirmación.
              </li>
              <li>Si no paga a tiempo, la hora se libera sola para otras clientas.</li>
              <li>
                El resto se paga después del tratamiento, en el estudio o en línea con <Ui>Pay balance</Ui> desde su cuenta.
              </li>
            </ul>
            <p className="rounded-xl bg-sand px-4 py-3 text-sm">
              Si en Configuración apagas el cobro en línea, las reservas se confirman al instante sin pasar por Square y todo se paga en el estudio.
            </p>
          </Section>

          <Section id="mi-cuenta" title="Mi cuenta">
            <p>Desde el ícono de cuenta la clienta ve sus próximas citas y su historial. En cada cita puede:</p>
            <ul>
              <li>
                <Ui>Reschedule</Ui>: mover la cita a otra hora libre, dentro de las horas de anticipación y el número de veces que permita tu política.
              </li>
              <li>
                <Ui>Cancel</Ui>: cancelar. A tiempo recibe el reembolso configurado sobre lo que pagó; tarde, el de cancelación tardía.
              </li>
              <li>
                <Ui>Complete payment</Ui> o <Ui>Pay balance</Ui>: pagar el depósito pendiente o el saldo.
              </li>
              <li>
                <Ui>Add to Google Calendar</Ui> o <Ui>Download .ics</Ui>: guardar la cita en su calendario.
              </li>
            </ul>
            <p>
              Cuando ya pasó el plazo para cambios en línea, la cita muestra un enlace para escribirte por WhatsApp. También puede editar su perfil, apagar recordatorios o borrar su cuenta (se
              cancelan sus citas futuras y sus datos personales se eliminan; el historial queda anónimo).
            </p>
            <Shot src={clientDashboard} alt="Panel de la clienta con próximas citas" tall caption="Mi cuenta: próximas citas, pagos y perfil." />
          </Section>

          <Section id="correos" title="Correos automáticos">
            <p>La página envía estos correos sola, con el logo de BLOOM y un archivo de calendario adjunto cuando aplica:</p>
            <Table
              head={['Cuándo', 'A la clienta', 'Al equipo']}
              rows={[
                ['Se confirma una cita', 'Confirmación con detalles y pago', 'Aviso de cita nueva'],
                ['Se mueve una cita', 'Nueva fecha y hora', 'Aviso del cambio'],
                ['Se cancela una cita', 'Cancelación y reembolso, si hay', 'Aviso de cancelación'],
                ['Antes de la cita', 'Recordatorios (24 h y 2 h antes, si los aceptó)', '—'],
                ['Después de la visita', 'Pedido de reseña en Google (si configuras el enlace)', '—'],
              ]}
            />
            <p>
              Los avisos al equipo van a los correos de <Ui>Staff alert emails</Ui> en Configuración; si lo dejas vacío, van a todas las cuentas admin.
            </p>
          </Section>

          <Part title="El panel interno" intro="Donde manejas el día a día. Solo entran las cuentas con acceso de equipo (staff) o administración (admin)." />

          <Section id="entrar" title="Entrar al panel">
            <p>
              Abre <Ui>www.bloombeautyskinllc.com/admin</Ui> e inicia sesión con Google con una cuenta autorizada. El menú de la izquierda lleva a cada sección; abajo están{' '}
              <Ui>View website</Ui> y <Ui>Sign out</Ui>.
            </p>
            <Table
              head={['Rol', 'Puede']}
              rows={[
                [<Pill key="s">Staff</Pill>, 'Dashboard, calendario, reservas, nueva reserva, clientas y esta guía.'],
                [<Pill key="a">Admin</Pill>, 'Todo lo anterior, más catálogo, equipo y horarios, configuración, registro de actividad y reembolsos.'],
              ]}
            />
            <p>El panel también funciona en el celular, con el menú plegado.</p>
            <Shot src={mobileAdmin} alt="Panel en celular" width={260} />
          </Section>

          <Section id="dashboard" title="Dashboard">
            <ul>
              <li>
                <strong>Hoy y esta semana</strong>: citas, ingreso estimado, cobrado, cancelaciones, ausencias (no-shows) y clientas nuevas.
              </li>
              <li>
                <strong>Today’s schedule</strong>: las citas del día en orden.
              </li>
              <li>
                <strong>Past appointments to close</strong>: citas que ya pasaron y siguen abiertas. Márcalas con <Ui>Mark completed</Ui> o <Ui>Mark no-show</Ui> para que los números sean
                correctos.
              </li>
              <li>
                <strong>Most booked this month</strong>: los tratamientos más reservados del mes.
              </li>
            </ul>
            <Shot src={adminHome} alt="Dashboard del panel" caption="Dashboard." />
          </Section>

          <Section id="calendario" title="Calendario">
            <p>
              Muestra las citas por <Ui>Day</Ui>, <Ui>Week</Ui> o <Ui>Month</Ui>. Las flechas y <Ui>Today</Ui> cambian de fecha; el punto <Ui>Live</Ui> indica que se actualiza solo cuando
              entra una reserva.
            </p>
            <ul>
              <li>El color de cada cita es el de su categoría (lo eliges en el Catálogo).</li>
              <li>Las citas completadas se ven más claras; las rayadas están esperando pago.</li>
              <li>Haz clic en una cita para abrir su detalle.</li>
              <li>
                <strong>Arrastra una cita</strong> a otra hora para moverla; pide confirmación y la clienta recibe el aviso.
              </li>
              <li>Las zonas sombreadas son horas cerradas o bloqueadas.</li>
            </ul>
            <Shot src={adminCalendar} alt="Calendario semanal" caption="Calendario en vista semanal." />
          </Section>

          <Section id="reservas" title="Reservas">
            <p>
              La lista completa de citas con fecha de reserva, fecha de la cita, clienta, servicio, total, estado, pago y código de referencia (el mismo que recibe la clienta en sus correos).
            </p>
            <ul>
              <li>Busca por nombre, email, teléfono o código.</li>
              <li>
                Filtra por fechas, estado, pago y tratamiento, y ordena. <Ui>Filter</Ui> aplica y <Ui>Clear</Ui> quita los filtros.
              </li>
              <li>
                <Ui>Export CSV</Ui> descarga la lista filtrada para Excel o contabilidad.
              </li>
            </ul>
            <Shot src={adminBookings} alt="Lista de reservas" tall caption="Lista de reservas con filtros." />
          </Section>

          <Section id="detalle" title="Detalle de una reserva">
            <h4 className="font-semibold">Acciones</h4>
            <ul>
              <li>
                <Ui>Reschedule</Ui>: moverla a otra fecha y hora. Puedes saltarte las reglas de horario (fuera de horas, tiempo bloqueado, poco aviso) marcando la casilla y escribiendo el
                motivo; queda registrado.
              </li>
              <li>
                <Ui>Cancel booking</Ui>: cancelarla. Si había pagos en línea eliges el reembolso: completo (recomendado cuando cancela el negocio), según la política, o ninguno.
              </li>
              <li>
                Según el estado también aparecen <Ui>Confirm (paid at studio)</Ui>, <Ui>Mark completed</Ui> y <Ui>Mark no-show</Ui>.
              </li>
            </ul>
            <h4 className="font-semibold">Pagos</h4>
            <ul>
              <li>Lo que se debe en línea, lo pagado y lo reembolsado, con cada pago de Square y su recibo.</li>
              <li>
                <Ui>Create payment link</Ui> genera un enlace de pago de Square por el monto que indiques (por ejemplo, el precio final tras la consulta) para enviárselo a la clienta.
              </li>
              <li>
                <Ui>Refund</Ui> (solo admin) devuelve dinero por Square: todo o una parte.
              </li>
            </ul>
            <h4 className="font-semibold">Lo demás</h4>
            <ul>
              <li>
                <strong>Internal notes</strong>: notas que solo ve el equipo.
              </li>
              <li>
                <strong>Emails</strong>: qué correos salieron y si se entregaron.
              </li>
              <li>
                <strong>Google Calendar</strong>: si la cita está sincronizada con el calendario del negocio.
              </li>
              <li>
                <strong>Timeline</strong>: cada cambio, quién lo hizo y cuándo.
              </li>
            </ul>
            <Shot src={adminBookingDetail} alt="Detalle de una reserva" tall caption="Detalle de una reserva confirmada con depósito pagado." />
          </Section>

          <Section id="nueva" title="Nueva reserva">
            <p>Para citas por teléfono, WhatsApp o en persona:</p>
            <Steps
              items={[
                <>
                  <strong>Clienta.</strong> Busca una existente por nombre, email o teléfono, o crea una nueva con <Ui>New client</Ui> (no necesita cuenta de Google).
                </>,
                <>
                  <strong>Servicio.</strong> Un tratamiento del catálogo (con sus opciones) o un <Ui>Custom service</Ui> con nombre, duración y precio libres.
                </>,
                <>
                  <strong>Fecha y hora.</strong> Marca la casilla de saltarse las reglas si necesitas ponerla fuera del horario normal.
                </>,
                <>
                  <strong>Precio.</strong> Deja el del catálogo, pon un precio manual o un descuento. Las notas de esta caja sí las ve la clienta.
                </>,
                <>
                  <strong>Crear.</strong> Con <Ui>Email the client about this change</Ui> marcado le llega la confirmación. Estas reservas quedan confirmadas al momento, sin cobro en línea.
                </>,
              ]}
            />
            <Shot src={adminBookingNew} alt="Formulario de nueva reserva" caption="Nueva reserva desde el panel." />
          </Section>

          <Section id="clientas" title="Clientas">
            <p>
              La lista de clientas con contacto, visitas, última y próxima visita, gasto total y etiquetas. Busca por nombre, email o teléfono. Un número rojo junto a las visitas indica
              ausencias.
            </p>
            <Shot src={adminClients} alt="Lista de clientas" caption="Lista de clientas." />
            <p>La ficha de cada clienta reúne:</p>
            <ul>
              <li>Resumen: visitas, ausencias, gasto total y próxima visita.</li>
              <li>
                Contacto, con <Ui>Edit details</Ui> para corregirlo.
              </li>
              <li>
                <strong>Tags</strong>: etiquetas libres (por ejemplo “VIP” o “piel sensible”).
              </li>
              <li>
                <strong>Notes</strong>: preferencias, alergias y lo que el equipo deba saber; se pueden fijar arriba.
              </li>
              <li>
                <strong>Consent forms &amp; documents</strong>: consentimientos firmados, formularios o fotos (PDF o imagen, hasta 10 MB). Son privados y cada vez que alguien los abre queda
                registrado.
              </li>
              <li>
                Sus citas y el botón <Ui>New booking for this client</Ui>.
              </li>
            </ul>
            <Shot src={adminClientDetail} alt="Ficha de una clienta" tall caption="Ficha de una clienta." />
          </Section>

          <Section id="catalogo" title="Catálogo" adminOnly>
            <p>Todos los tratamientos por categoría, con duración, depósito y precio. Haz clic en la flecha de un tratamiento para editarlo:</p>
            <ul>
              <li>Nombre, descripción, precio fijo o “desde” (precio inicial), duración y tiempo de preparación o limpieza antes y después.</li>
              <li>Depósito: un monto fijo o un porcentaje que se cobra al reservar.</li>
              <li>Opciones con su precio y minutos extra (por ejemplo, zonas del láser).</li>
              <li>
                Marcar como <em>Best seller</em>. Un tratamiento sin duración no se puede reservar en línea.
              </li>
            </ul>
            <p>
              Cada categoría tiene su <Ui>Calendar color</Ui> y <Ui>+ Add treatment</Ui>. Los cambios aplican a reservas nuevas; las existentes conservan su precio.
            </p>
            <Shot src={adminCatalog} alt="Catálogo de tratamientos" tall caption="Catálogo." />
          </Section>

          <Section id="testimonios" title="Testimonios" adminOnly>
            <p>Las historias de clientas que se ven en la página de inicio y en cada página de tratamiento.</p>
            <ul>
              <li>
                Con <Ui>Edit</Ui> cambias la frase destacada, el texto, la etiqueta del tratamiento, las estrellas y la foto (<Ui>Replace photo</Ui>). La foto se reduce sola antes de
                subirse.
              </li>
              <li>
                En <Ui>Show on</Ui> eliges en qué páginas aparece: <em>Home</em> y cualquier tratamiento. Una misma historia puede salir en varias páginas.
              </li>
              <li>
                Las flechas cambian el orden; el sitio muestra las historias en ese orden. Los filtros de arriba muestran solo las de una página.
              </li>
              <li>
                Quita <Ui>Visible on the website</Ui> para ocultar una historia sin borrarla. <Ui>+ Add testimonial</Ui> agrega una nueva.
              </li>
            </ul>
          </Section>

          <Section id="equipo" title="Equipo y horarios" adminOnly>
            <ul>
              <li>
                <strong>Specialists</strong>: el nombre que ven las clientas, bio, color en el calendario, si está activa y qué tratamientos hace. Con <Ui>+ Add specialist</Ui> agregas más
                personas, cada una con su agenda.
              </li>
              <li>
                <strong>Opening hours</strong>: el horario por día. Puedes poner dos franjas en un día (por ejemplo, con pausa para almorzar) con <Ui>+ Add hours</Ui> o cerrar un día.
              </li>
              <li>
                <strong>Time off &amp; blocks</strong>: feriados, vacaciones o cualquier rato en que no se pueda reservar. Los bloqueos del Google Calendar conectado también aparecen aquí.
              </li>
              <li>
                <strong>Staff access</strong>: da acceso al panel buscando a la persona por su email (debe haber entrado al sitio con Google una vez) y eligiendo staff o admin. También
                puedes quitar el acceso.
              </li>
            </ul>
            <Shot src={adminTeam} alt="Equipo, horarios, bloqueos y accesos" tall caption="Equipo y horarios." />
          </Section>

          <Section id="settings" title="Configuración" adminOnly>
            <Table
              head={['Sección', 'Qué controla']}
              rows={[
                ['Business', 'Nombre comercial y legal, dirección, teléfono, WhatsApp, email de contacto y email de privacidad.'],
                ['Online booking', 'Cada cuántos minutos se ofrecen horas, aviso mínimo, hasta cuántos días adelante se reserva y cuánto se aparta una hora mientras la clienta confirma.'],
                ['Cancellation policy', 'Horas antes para cancelar o mover, cuántas veces se puede mover, reembolso a tiempo y tardío, y si menores pueden reservar con un adulto. Se publica en los Términos.'],
                ['Notifications', 'Horas de los recordatorios, correos que reciben los avisos, enlace de reseña de Google y cuándo pedirla.'],
                ['Payments', 'Cobro en línea con Square encendido o apagado, modo de Square y porcentaje de depósito por defecto.'],
              ]}
            />
            <h4 className="font-semibold">Modo de Square</h4>
            <p>
              <Ui>Test (sandbox)</Ui> sirve para probar sin dinero real, con las tarjetas de prueba de Square. <Ui>Live (production)</Ui> cobra de verdad. Debajo de cada opción se indica si
              sus credenciales están configuradas. Para operar con clientas reales debe estar en <strong>Live</strong>.
            </p>
            <h4 className="font-semibold">Integraciones</h4>
            <p>
              A la derecha están la conexión con Google Calendar del negocio (cada cita se crea, mueve o borra sola en ese calendario) y <strong>Integration health</strong>: tareas
              programadas, reintentos, errores de sincronización y correos no entregados en la última semana. Si un número aparece en rojo, revisa el detalle debajo.
            </p>
            <Shot
              src={adminSettings}
              alt="Configuración"
              tall
              caption={
                <>
                  Configuración. Pulsa <Ui>Save</Ui>, fijo abajo, para guardar.
                </>
              }
            />
          </Section>

          <Section id="actividad" title="Registro de actividad" adminOnly>
            <p>
              Cada cambio en el sistema, quién lo hizo y cuándo: reservas, pagos, precios, accesos, documentos abiertos. Los registros no se pueden editar ni borrar. Filtra por persona,
              acción, tipo de registro y fechas, y expórtalo con <Ui>Export CSV</Ui>. Sirve para aclarar qué pasó con una cita o un pago.
            </p>
            <Shot src={adminActivity} alt="Registro de actividad" caption="Registro de actividad." />
          </Section>

          <Part title="Referencia" />

          <Section id="estados" title="Estados de una cita">
            <Table
              head={['Estado', 'Significa']}
              rows={[
                [<Pill key="h">Held</Pill>, 'La clienta eligió hora y está confirmando; el horario está apartado unos minutos.'],
                [<Pill key="p">Pending payment</Pill>, 'Esperando el pago en Square. Si no paga a tiempo pasa a Expired.'],
                [<Pill key="c">Confirmed</Pill>, 'Cita confirmada.'],
                [<Pill key="d">Completed</Pill>, 'La clienta vino.'],
                [<Pill key="n">No-show</Pill>, 'No vino.'],
                [<Pill key="x">Cancelled</Pill>, 'Cancelada por la clienta o el negocio.'],
                [<Pill key="e">Expired</Pill>, 'No se completó la reserva o el pago a tiempo; la hora se liberó.'],
              ]}
            />
            <p>
              El pago tiene su propio estado: <em>Unpaid</em> (se paga en el estudio), <em>Pending</em>, <em>Partially paid</em> (depósito pagado), <em>Paid</em> y <em>Refunded</em>.
            </p>
          </Section>

          <Section id="tareas" title="Tareas frecuentes">
            <div>
              <Faq q="Cerrar el estudio un día o irme de vacaciones">
                Equipo y horarios → Time off &amp; blocks → marca Whole day(s), elige las fechas, escribe el motivo y pulsa Add block. Nadie podrá reservar en esas fechas. Las citas que ya
                existan no se cancelan solas.
              </Faq>
              <Faq q="Cambiar un precio o una duración">Catálogo → abre el tratamiento → cambia el precio o la duración → Save. Aplica a reservas nuevas.</Faq>
              <Faq q="Una clienta llama para reservar">
                Nueva reserva → busca o crea la clienta → elige el tratamiento, la fecha y la hora → Create booking. Le llega la confirmación por correo.
              </Faq>
              <Faq q="Mover una cita">En el Calendario, arrástrala a la nueva hora y confirma. O abre la reserva y usa Reschedule.</Faq>
              <Faq q="Devolver dinero">
                Abre la reserva → Payments → Refund → indica el monto. Si además cancelas la cita, al usar Cancel booking eliges el reembolso ahí mismo. El dinero vuelve a la tarjeta por
                Square en unos días.
              </Faq>
              <Faq q="Cobrar el resto después del tratamiento">
                Si paga en el estudio, márcala como completada. Si prefiere pagar en línea, ella misma puede usar Pay balance desde su cuenta, o tú puedes crear un enlace con Create payment
                link en la reserva y enviárselo.
              </Faq>
              <Faq q="La clienta no vino">Abre la reserva o usa el Dashboard → Mark no-show. Queda contada como ausencia en el Dashboard y en su ficha.</Faq>
              <Faq q="Dar acceso al panel a una empleada">
                Pídele que entre una vez al sitio con su cuenta de Google. Luego, en Equipo y horarios → Staff access, busca su email y pulsa Make staff.
              </Faq>
              <Faq q="Un correo no le llegó a la clienta">
                Abre la reserva → Emails. Si dice sent, pídele que revise spam o promociones. Si dice failed o bounced, revisa que su email esté bien escrito en su ficha.
              </Faq>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
