import { createFileRoute } from '@tanstack/react-router';
import { timeAgo } from '../../../hn-shared/api';
import { HnHeader } from '../components';
import { getUser } from '../data';

export const Route = createFileRoute('/user/$id')({
  loader: ({ params }) => getUser({ data: params.id }),
  component: DetailPage,
});

function DetailPage() {
  const user = Route.useLoaderData();
  if (!user) {
    return (
      <>
        <HnHeader />
        <main className="hn-main">
          <div className="hn-empty">User not found.</div>
        </main>
      </>
    );
  }

  return (
    <>
      <HnHeader />
      <main className="hn-main">
        <div className="user-profile">
          <table>
            <tbody>
              <tr>
                <td>user:</td>
                <td>{user.id}</td>
              </tr>
              <tr>
                <td>created:</td>
                <td>{timeAgo(user.created)}</td>
              </tr>
              <tr>
                <td>karma:</td>
                <td>{user.karma}</td>
              </tr>
            </tbody>
          </table>
          {user.about && (
            <div
              className="user-about"
              dangerouslySetInnerHTML={{ __html: user.about }}
            />
          )}
        </div>
      </main>
    </>
  );
}
