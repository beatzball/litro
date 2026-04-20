import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { fetchUser } from '../../../hn-shared/api.js';
import { userIds } from '../../../hn-shared/fixture-ids.js';
import type { HNUser } from '../../../hn-shared/types.js';

interface UserPageData {
  user: HNUser | null;
}

export const pageData = definePageData(async (event) => {
  const id = event.context.params?.id ?? '';
  const user = await fetchUser(id);
  return { user };
});

export async function generateRoutes(): Promise<string[]> {
  return userIds.map(id => `/user/${id}`);
}

@customElement('page-user-id')
export class UserPage extends LitroPage {
  static override properties = { serverData: { state: true } };

  render() {
    const data = this.serverData as UserPageData | null;
    if (!data) return html`<div class="hn-loading">Loading...</div>`;

    const { user } = data;
    if (!user) return html`<div class="hn-empty">User not found</div>`;
    const created = new Date(user.created * 1000).toISOString().split('T')[0];

    return html`
      <link rel="stylesheet" href="/hn.css">
      <header class="hn-header">
        <div class="hn-header-inner">
          <a class="hn-logo" href="/">Y</a>
          <nav class="hn-nav">
            <a href="/">top</a>
            <span class="hn-nav-sep">|</span>
            <a href="/ask">ask</a>
            <span class="hn-nav-sep">|</span>
            <a href="/show">show</a>
          </nav>
        </div>
      </header>
      <main class="hn-main">
        <div class="user-profile">
          <table>
            <tr><td>user:</td><td>${user.id}</td></tr>
            <tr><td>created:</td><td>${created}</td></tr>
            <tr><td>karma:</td><td>${user.karma}</td></tr>
          </table>
          ${user.about ? html`<div class="user-about">${unsafeHTML(user.about)}</div>` : ''}
        </div>
      </main>
    `;
  }
}

export default UserPage;
