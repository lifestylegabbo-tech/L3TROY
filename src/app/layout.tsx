import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'L3TROY — DJ & Productor | Guatemala',
  description: 'L3TROY: DJ y productor guatemalteco. Mashups, sets y presentaciones en vivo. Contrataciones y fechas.',
  openGraph: {
    title: 'L3TROY — DJ & Productor',
    description: 'Mashups, sets y presentaciones en vivo desde Guatemala.',
    type: 'website',
    locale: 'es_GT',
  },
};

export const viewport: Viewport = { themeColor: '#0a0606', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
