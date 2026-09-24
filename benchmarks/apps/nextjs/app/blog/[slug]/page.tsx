import Link from 'next/link';

export function generateStaticParams() {
  return [{ slug: 'hello' }];
}

// Next.js 15 and later hand `params` to a page as a Promise, so the component
// is async and awaits it. The awaited value is not read here — the page body is
// fixed, the same as the Nuxt and Litro apps — but the await keeps the route
// dynamic in the same way they are.
export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await params;
  return (
    <div>
      <h1>Hello World</h1>
      <p>This is a sample blog post used to benchmark dynamic route handling.</p>
      <Link href="/">Back to home</Link>
    </div>
  );
}
