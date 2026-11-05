export const BUCKETS = [
  { id: 'artist-branding', label: 'Marca del artista' },
  { id: 'artist-photography', label: 'Fotografía del artista' },
  { id: 'events', label: 'Eventos' },
  { id: 'event-videos', label: 'Videos de eventos' },
  { id: 'music-sets', label: 'Sets y música' },
  { id: 'promotional-media', label: 'Material promocional' },
  { id: 'collaborations', label: 'Colaboraciones' },
  { id: 'documents', label: 'Documentos' },
] as const;

export type BucketId = (typeof BUCKETS)[number]['id'];

export const SECTIONS = [
  { id: 'hero', label: 'Portada (Hero)', hint: 'Imagen o video principal de apertura' },
  { id: 'historia', label: 'Historia', hint: 'Video de su historia' },
  { id: 'estudio', label: 'El estudio', hint: 'Fotos del estudio y la producción' },
  { id: 'sets', label: 'Sets y mashups', hint: 'Audio y video de sets' },
  { id: 'eventos', label: 'En cabina / Eventos', hint: 'Fotos y videos de presentaciones' },
  { id: 'galeria', label: 'Galería', hint: 'Fotos destacadas' },
  { id: 'colaboraciones', label: 'Colaboraciones', hint: 'Material con otros artistas y marcas' },
  { id: 'contacto', label: 'Contacto / Press kit', hint: 'PDF de prensa y material de booking' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export type MediaKind = 'image' | 'video' | 'audio' | 'document';

export type AllowedFormats = {
  image: string[];
  video: string[];
  audio: string[];
  document: string[];
  max_bytes: Record<MediaKind, number>;
};

export const DEFAULT_FORMATS: AllowedFormats = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac'],
  document: ['application/pdf'],
  max_bytes: {
    image: 100 * 1024 * 1024,
    video: 2 * 1024 * 1024 * 1024,
    audio: 500 * 1024 * 1024,
    document: 50 * 1024 * 1024,
  },
};

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  pdf: 'application/pdf',
};

export function resolveMime(filename: string, declared: string): string {
  if (declared && declared !== 'application/octet-stream') return declared;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? declared;
}

export function kindOf(mime: string, formats: AllowedFormats = DEFAULT_FORMATS): MediaKind | null {
  for (const k of ['image', 'video', 'audio', 'document'] as MediaKind[]) {
    if (formats[k].includes(mime)) return k;
  }
  return null;
}

export function defaultBucket(kind: MediaKind, section?: string | null): BucketId {
  if (kind === 'document') return 'documents';
  if (kind === 'audio') return 'music-sets';
  if (kind === 'video') return section === 'eventos' ? 'event-videos' : section === 'sets' ? 'music-sets' : 'promotional-media';
  switch (section) {
    case 'eventos':
      return 'events';
    case 'colaboraciones':
      return 'collaborations';
    case 'hero':
      return 'artist-branding';
    default:
      return 'artist-photography';
  }
}

export const PART_SIZE = 16 * 1024 * 1024; // 16 MiB por parte (mínimo S3: 5 MiB)
export const MAX_PARTS = 10000;
