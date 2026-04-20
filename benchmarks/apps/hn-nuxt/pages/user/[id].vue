<script setup lang="ts">
import { fetchUser, timeAgo } from '../../../hn-shared/api';

const route = useRoute();
const id = route.params.id as string;

const user = await fetchUser(id);
if (!user) {
  throw createError({ statusCode: 404, statusMessage: 'User not found' });
}

const createdDate = new Date(user.created * 1000).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
</script>

<template>
  <HnHeader />
  <main class="hn-main">
    <div class="user-profile">
      <table>
        <tbody>
          <tr>
            <td>user:</td>
            <td>{{ user.id }}</td>
          </tr>
          <tr>
            <td>created:</td>
            <td>{{ createdDate }}</td>
          </tr>
          <tr>
            <td>karma:</td>
            <td>{{ user.karma }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="user.about" class="user-about" v-html="user.about"></div>
    </div>
  </main>
</template>
