import type { Metadata } from 'next';

const socialImage = { url: '/social-preview.png', width: 1280, height: 640 };

export function routeMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title,
      description,
      siteName: 'Glitchpad',
      images: [socialImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/social-preview.png'],
    },
  };
}
