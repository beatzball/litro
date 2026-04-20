import { fetchUser, timeAgo } from '../../../../hn-shared/api';
import { userIds } from '../../../../hn-shared/fixture-ids';
import { HnHeader } from '../../components';

export async function generateStaticParams() {
  return userIds.map((id) => ({ id }));
}

export default async function UserPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await fetchUser(params.id);
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
