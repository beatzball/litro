import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1>Welcome to the Benchmark App</h1>
      <p>This is a minimal app used for cross-framework performance benchmarks.</p>
      <Link href="/blog/hello">Read blog post</Link>
    </div>
  );
}
