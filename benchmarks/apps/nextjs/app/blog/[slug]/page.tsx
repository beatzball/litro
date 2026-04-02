import Link from 'next/link';

export function generateStaticParams() {
  return [{ slug: 'hello' }];
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  return (
    <div>
      <h1>Hello World</h1>
      <p>This is a sample blog post used to benchmark dynamic route handling.</p>
      <Link href="/">Back to home</Link>
    </div>
  );
}
