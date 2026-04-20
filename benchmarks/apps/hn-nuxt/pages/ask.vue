<script setup lang="ts">
import { fetchAskStories, fetchStories, timeAgo, hostName } from '../../hn-shared/api';

const ids = await fetchAskStories(30);
const stories = await fetchStories(ids);
</script>

<template>
  <HnHeader />
  <main class="hn-main">
    <ol class="story-list">
      <li v-for="(story, i) in stories" :key="story.id" class="story-item">
        <span class="story-rank">{{ i + 1 }}.</span>
        <span class="upvote"></span>
        <span class="story-title">
          <a v-if="story.url" :href="story.url">{{ story.title }}</a>
          <NuxtLink v-else :to="`/story/${story.id}`">{{ story.title }}</NuxtLink>
          <span v-if="story.url" class="story-domain">({{ hostName(story.url) }})</span>
        </span>
        <div class="story-meta">
          {{ story.score }} points by
          <NuxtLink :to="`/user/${story.by}`">{{ story.by }}</NuxtLink>
          {{ timeAgo(story.time) }} |
          <NuxtLink :to="`/story/${story.id}`">{{ story.descendants ?? 0 }} comments</NuxtLink>
        </div>
      </li>
    </ol>
  </main>
</template>
