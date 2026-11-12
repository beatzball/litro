import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/blog/$slug')({ component: BlogPost });

function BlogPost() {
  return (
    <div>
      <h1>Hello World</h1>
      <p>This is a sample blog post used to benchmark dynamic route handling.</p>
      <Link to="/">Back to home</Link>
    </div>
  );
}
