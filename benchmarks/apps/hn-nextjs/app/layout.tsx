import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hacker News (Next.js)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/hn.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
