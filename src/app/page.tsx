import { getContent } from '@/lib/content';
import { publishedBySection, publicEvents, toPublic, type PublicMedia } from '@/lib/media';
import { Ambient, Nav, Reveal, WaveDivider } from '@/components/Effects';
import Visualizer from '@/components/Visualizer';
import SetsPlayer from '@/components/SetsPlayer';
import { Masonry, VideoCard } from '@/components/Gallery';
import { Pic, Placeholder } from '@/components/Pic';
import QuoteForm from '@/components/QuoteForm';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
function dateLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

function Head({ no, title, lead, id }: { no: string; title: string; lead: string; id?: string }) {
  return (
    <Reveal className="chapter-head">
      <span className="chapter-no" aria-hidden>
        {no}
      </span>
      <div>
        <h2 id={id}>{title}</h2>
        <p className="lead">{lead}</p>
      </div>
    </Reveal>
  );
}

export default async function Home() {
  const services = await safe(q<{ id: string; name: string; description: string | null }>('SELECT id, name, description FROM services WHERE active ORDER BY sort, created_at'), []);
  const [c, hero, historia, estudio, sets, eventosMedia, galeria, colabs, contacto, events] = await Promise.all([
    getContent(),
    safe(publishedBySection('hero', 3), []),
    safe(publishedBySection('historia', 6), []),
    safe(publishedBySection('estudio', 12), []),
    safe(publishedBySection('sets', 40), []),
    safe(publishedBySection('eventos', 24), []),
    safe(publishedBySection('galeria', 60), []),
    safe(publishedBySection('colaboraciones', 24), []),
    safe(publishedBySection('contacto', 10), []),
    safe(publicEvents(), []),
  ]);

  const heroAll = hero.map(toPublic);
  const heroItem: PublicMedia | undefined = heroAll[0];
  // Si el primer elemento es video, ocupa toda la portada. Con fotos: la primera es el retrato y la segunda el fondo.
  const heroVideo = heroItem?.kind === 'video';
  const heroImgs = heroAll.filter((m) => m.kind === 'image');
  // La foto cuyo título o nombre dice «estudio» va de fondo; si no hay, la segunda.
  const heroStudio = heroImgs.find((m) => /estudio|studio/i.test(`${m.title ?? ''} ${m.alt ?? ''}`)) ?? heroImgs[1];
  const heroPortrait: PublicMedia | undefined = heroVideo ? undefined : heroImgs.find((m) => m !== heroStudio) ?? heroImgs[0];
  const heroBg: PublicMedia | undefined = heroVideo ? heroItem : heroStudio;
  const pHistoria = historia.map(toPublic).filter((m) => m.kind === 'image').slice(0, 4);
  const pEstudio = estudio.map(toPublic).filter((m) => m.kind !== 'audio' && m.kind !== 'document');
  const pSets = sets.map(toPublic);
  const tracks = pSets.filter((m) => m.kind === 'audio');
  const setVideos = pSets.filter((m) => m.kind === 'video');
  const pEventos = eventosMedia.map(toPublic).filter((m) => m.kind === 'image' || m.kind === 'video');
  const pGaleria = galeria.map(toPublic).filter((m) => m.kind === 'image' || m.kind === 'video');
  const pColabs = colabs.map(toPublic).filter((m) => m.kind === 'image' || m.kind === 'video');
  const pressKit = contacto.map(toPublic).find((m) => m.kind === 'document');

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const past = events.filter((e) => e.event_date < today);
  const eventList = [...upcoming, ...past].slice(0, 8);

  const socials = (
    [
      ['Instagram', c.instagram],
      ['TikTok', c.tiktok],
      ['YouTube', c.youtube],
      ['Spotify', c.spotify],
      ['SoundCloud', c.soundcloud],
    ] as const
  ).filter(([, href]) => href);
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}` : '';

  return (
    <>
      <Ambient />
      <Nav artist={c.artist} />
      <main id="top">
        {/* ====== PRÓLOGO ====== */}
        <section className="hero" aria-label="Portada">
          {heroBg ? (
            <div className="hero-media">
              {heroBg.kind === 'video' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={`/api/media/${heroBg.id}`} poster={heroBg.hasPoster ? `/api/media/${heroBg.id}?v=poster` : undefined} autoPlay muted loop playsInline preload="metadata" />
              ) : (
                <Pic m={heroBg} sizes="100vw" priority />
              )}
            </div>
          ) : (
            <div className="hero-media fallback" />
          )}
          <div className={`hero-inner ${heroPortrait ? 'with-portrait' : ''}`}>
            <div className="hero-copy">
              <span className="eyebrow">{c.role}</span>
              <h1 className="wordmark" aria-label={c.artist}>
                {c.artist.slice(0, 1)}
                <span>{c.artist.slice(1, 2)}</span>
                {c.artist.slice(2)}
              </h1>
              <p className="hero-tag">{c.tagline}</p>
              <div className="hero-actions">
                <a className="btn solid" href="#sets">
                  {c.hero_cta}
                </a>
                <a className="btn magenta" href="#cotiza">
                  Contratar
                </a>
              </div>
            </div>
            {heroPortrait && (
              <figure className="hero-portrait">
                <div className="hp-frame">
                  <Pic m={heroPortrait} sizes="(max-width: 900px) 80vw, 34vw" priority />
                </div>
                <span className="hp-tick tl" aria-hidden />
                <span className="hp-tick br" aria-hidden />
              </figure>
            )}
          </div>
          <span className="scroll-cue">Desliza</span>
          <div className="hero-viz">
            <Visualizer bars={96} active />
          </div>
        </section>

        {/* ====== CAPÍTULO 01 · HISTORIA ====== */}
        <section id="historia" className="chapter purple" aria-labelledby="h-historia">
          <Head no="01" id="h-historia" title={c.historia_title} lead="Cómo empezó todo." />
          <div className="story-grid">
            <Reveal className="story-text">
              <p>{c.historia_body}</p>
              <div className="stats">
                <div className="stat">
                  <b>GT</b>
                  <span>Guatemala</span>
                </div>
                <div className="stat">
                  <b>DJ</b>
                  <span>Cabina</span>
                </div>
                <div className="stat">
                  <b>PROD</b>
                  <span>Estudio propio</span>
                </div>
              </div>
            </Reveal>
            <div className="story-photos">
              {pHistoria.length
                ? pHistoria.map((m, i) => (
                    <Reveal key={m.id} delay={i * 0.12}>
                      <figure className="frame" style={{ margin: 0 }}>
                        <Pic m={m} sizes="(max-width: 900px) 46vw, 24vw" />
                        {m.title && (
                          <figcaption className="cap">
                            <b>{m.title}</b>
                            {m.description}
                          </figcaption>
                        )}
                      </figure>
                    </Reveal>
                  ))
                : [0, 1].map((i) => (
                    <div key={i} className="frame">
                      <Placeholder label="Foto próximamente" />
                    </div>
                  ))}
            </div>
          </div>
        </section>

        <WaveDivider color="var(--cyan)" />

        {/* ====== CAPÍTULO 02 · ESTUDIO ====== */}
        <section id="estudio" className="chapter cyan" aria-labelledby="h-estudio">
          <Head no="02" id="h-estudio" title={c.estudio_title} lead={c.estudio_body} />
          <div className="strip" tabIndex={0} aria-label="Fotos del estudio">
            {pEstudio.length ? (
              pEstudio.map((m) => (
                <figure key={m.id} className="frame" style={{ margin: 0 }}>
                  {m.kind === 'video' ? <VideoCard m={m} /> : <Pic m={m} sizes="(max-width: 700px) 78vw, 560px" />}
                  {m.title && m.kind !== 'video' && (
                    <figcaption className="cap">
                      <b>{m.title}</b>
                      {m.description}
                    </figcaption>
                  )}
                </figure>
              ))
            ) : (
              <>
                <div className="frame">
                  <Placeholder label="El estudio · próximamente" />
                </div>
                <div className="frame">
                  <Placeholder label="El estudio · próximamente" />
                </div>
              </>
            )}
          </div>
        </section>

        <WaveDivider color="var(--magenta)" />

        {/* ====== CAPÍTULO 03 · SETS ====== */}
        <section id="sets" className="chapter magenta" aria-labelledby="h-sets">
          <Head no="03" id="h-sets" title={c.sets_title} lead={c.sets_body} />
          <Reveal>
            <SetsPlayer tracks={tracks} />
          </Reveal>
          {setVideos.length > 0 && (
            <div className="videos-row">
              {setVideos.map((m) => (
                <Reveal key={m.id}>
                  <VideoCard m={m} />
                </Reveal>
              ))}
            </div>
          )}
        </section>

        <WaveDivider color="var(--purple)" />

        {/* ====== CAPÍTULO 04 · EN CABINA ====== */}
        <section id="eventos" className="chapter purple" aria-labelledby="h-eventos">
          <Head no="04" id="h-eventos" title={c.eventos_title} lead={c.eventos_body} />
          <div className="events-layout">
            <ul className="timeline">
              {eventList.length ? (
                eventList.map((e) => (
                  <Reveal as="li" key={e.id}>
                    <div className={`event ${e.event_date < today ? 'past' : ''}`}>
                      <time dateTime={e.event_date}>{dateLabel(e.event_date)}</time>
                      <h3>{e.title}</h3>
                      <p>{[e.venue, e.city].filter(Boolean).join(' · ')}</p>
                      {e.description && <p>{e.description}</p>}
                      {e.ticket_url && e.event_date >= today && (
                        <a className="btn sm magenta" href={e.ticket_url} target="_blank" rel="noopener noreferrer">
                          Boletos / info
                        </a>
                      )}
                    </div>
                  </Reveal>
                ))
              ) : (
                <li className="event">
                  <time>PRÓXIMAMENTE</time>
                  <h3>Nuevas fechas en camino</h3>
                  <p>Síguelo en redes para enterarte primero.</p>
                </li>
              )}
            </ul>
            <div className="mosaic">
              {pEventos.length ? (
                pEventos.slice(0, 5).map((m) => (
                  <Reveal key={m.id}>
                    {m.kind === 'video' ? (
                      <VideoCard m={m} />
                    ) : (
                      <figure className="frame" style={{ margin: 0 }}>
                        <Pic m={m} sizes="(max-width: 900px) 92vw, 30vw" />
                        {m.title && (
                          <figcaption className="cap">
                            <b>{m.title}</b>
                            {m.description}
                          </figcaption>
                        )}
                      </figure>
                    )}
                  </Reveal>
                ))
              ) : (
                <div className="frame" style={{ gridColumn: 'span 2' }}>
                  <Placeholder label="Fotos de cabina · próximamente" />
                </div>
              )}
            </div>
          </div>
        </section>

        <WaveDivider color="var(--cyan)" />

        {/* ====== CAPÍTULO 05 · GALERÍA ====== */}
        <section id="galeria" className="chapter cyan" aria-labelledby="h-galeria">
          <Head no="05" id="h-galeria" title={c.galeria_title} lead={c.galeria_body} />
          {pGaleria.length ? (
            <Masonry items={pGaleria} />
          ) : (
            <div className="frame" style={{ minHeight: 280 }}>
              <Placeholder label="Galería · próximamente" />
            </div>
          )}
        </section>

        {/* ====== CAPÍTULO 06 · COLABORACIONES ====== */}
        {pColabs.length > 0 && (
          <section id="colaboraciones" className="chapter magenta" aria-labelledby="h-colab">
            <Head no="06" id="h-colab" title={c.colaboraciones_title} lead={c.colaboraciones_body} />
            <div className="collabs">
              {pColabs.map((m) => (
                <Reveal key={m.id}>
                  {m.kind === 'video' ? (
                    <VideoCard m={m} />
                  ) : (
                    <figure className="frame" style={{ margin: 0 }}>
                      <Pic m={m} sizes="(max-width: 900px) 92vw, 25vw" />
                      {m.title && (
                        <figcaption className="cap">
                          <b>{m.title}</b>
                          {m.description}
                        </figcaption>
                      )}
                    </figure>
                  )}
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ====== COTIZA ====== */}
        <section id="cotiza" className="chapter cyan" aria-labelledby="h-cotiza">
          <Head no="07" id="h-cotiza" title="Cotiza tu evento" lead="Cuéntanos de tu fecha y lo que necesitas. Te respondemos con una propuesta a la medida." />
          <Reveal className="quote-wrap">
            <QuoteForm services={services} />
          </Reveal>
        </section>

        {/* ====== EPÍLOGO · CONTACTO ====== */}
        <section id="contacto" className="chapter purple" aria-labelledby="h-contacto">
          <Reveal className="cta-block">
            <span className="eyebrow">Booking</span>
            <h2 id="h-contacto" style={{ marginTop: 14 }}>
              {c.contacto_title}
            </h2>
            <p>{c.contacto_body}</p>
            <div className="socials">
              {wa && (
                <a className="btn solid" href={wa} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              )}
              {c.email && (
                <a className="btn" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              )}
              {pressKit && (
                <a className="btn purple" href={`/api/media/${pressKit.id}`} target="_blank" rel="noopener noreferrer">
                  Press kit (PDF)
                </a>
              )}
              {socials.map(([label, href]) => (
                <a key={label} className="btn magenta" href={href} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              ))}
            </div>
          </Reveal>
        </section>
      </main>
      <footer className="foot">
        © {new Date().getFullYear()} {c.artist}. Todos los derechos reservados. · <a href="/admin">Acceso</a>
      </footer>
    </>
  );
}
