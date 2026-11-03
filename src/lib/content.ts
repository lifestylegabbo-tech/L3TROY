import { q } from './db';

export type SiteContent = {
  artist: string;
  role: string;
  tagline: string;
  hero_cta: string;
  historia_title: string;
  historia_body: string;
  estudio_title: string;
  estudio_body: string;
  sets_title: string;
  sets_body: string;
  eventos_title: string;
  eventos_body: string;
  galeria_title: string;
  galeria_body: string;
  colaboraciones_title: string;
  colaboraciones_body: string;
  contacto_title: string;
  contacto_body: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  spotify: string;
  soundcloud: string;
  whatsapp: string;
  email: string;
};

export const DEFAULT_CONTENT: SiteContent = {
  artist: 'L3TROY',
  role: 'DJ & Productor · Guatemala',
  tagline: 'Mashups, producción y cabina con identidad propia.',
  hero_cta: 'Escuchar sets',
  historia_title: 'Todo empieza en el estudio',
  historia_body:
    'Entre pantallas, luces y capas de sonido nace cada mashup. L3TROY toma la música que todos conocen y la convierte en algo que se siente nuevo, para después llevarla del estudio a la cabina.',
  estudio_title: 'Donde se construye el sonido',
  estudio_body:
    'Un espacio que cambia de color con cada idea. Aquí se producen los mashups y se prueban los sets antes de salir a la pista.',
  sets_title: 'Sets & mashups',
  sets_body: 'Dale play. Así suena una noche con L3TROY.',
  eventos_title: 'En cabina',
  eventos_body: 'Del estudio a la pista. Fechas, lugares y momentos para vivirlo en directo.',
  galeria_title: 'Momentos',
  galeria_body: 'Luces, equipo y gente. Lo que pasa cuando suena el set.',
  colaboraciones_title: 'Colaboraciones',
  colaboraciones_body: 'Marcas, venues y artistas con los que se ha construido el camino.',
  contacto_title: 'Lleva el set a tu evento',
  contacto_body: 'Clubes, bares, eventos privados y marcas. Escribe y cuadramos la fecha.',
  instagram: 'https://instagram.com/l3troy',
  tiktok: '',
  youtube: '',
  spotify: '',
  soundcloud: '',
  whatsapp: '',
  email: '',
};

export async function getContent(): Promise<SiteContent> {
  try {
    const rows = await q<{ value: Partial<SiteContent> }>("SELECT value FROM site_settings WHERE key = 'content'");
    return { ...DEFAULT_CONTENT, ...(rows[0]?.value ?? {}) };
  } catch {
    return DEFAULT_CONTENT;
  }
}
