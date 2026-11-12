<script setup lang="ts">
import { fetchUser } from '../../../../hn-shared/api';

const route = useRoute();
const id = computed(() => route.params.id as string);

const { data: user, error } = await useAsyncData(() => `hn:user:${id.value}`, async () => {
  const user = await fetchUser(id.value);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }
  return user;
});
if (error.value) throw createError(error.value);

const createdDate = computed(() => new Date(user.value!.created * 1000).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}));
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
