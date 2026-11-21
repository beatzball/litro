import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  return (
    <div>
      <h1>Welcome to the Benchmark App</h1>
      <p>This is a minimal app used for cross-framework performance benchmarks.</p>
      <Link to="/blog/$slug" params={{ slug: 'hello' }}>Read blog post</Link>
    </div>
  );
}
