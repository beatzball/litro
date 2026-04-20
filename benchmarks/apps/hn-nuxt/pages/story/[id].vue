<script setup lang="ts">
import { fetchStoryWithComments, timeAgo, hostName } from '../../../hn-shared/api';

const route = useRoute();
const id = Number(route.params.id);

const data = await fetchStoryWithComments(id);
if (!data) {
  throw createError({ statusCode: 404, statusMessage: 'Story not found' });
}

const { story, comments } = data;
</script>

<template>
  <HnHeader />
  <main class="hn-main">
    <div class="story-detail">
      <div>
        <span class="upvote"></span>
        <span class="story-title">
          <a v-if="story.url" :href="story.url">{{ story.title }}</a>
          <span v-else>{{ story.title }}</span>
          <span v-if="story.url" class="story-domain">({{ hostName(story.url) }})</span>
        </span>
      </div>
      <div class="story-meta">
        {{ story.score }} points by
        <NuxtLink :to="`/user/${story.by}`">{{ story.by }}</NuxtLink>
        {{ timeAgo(story.time) }} |
        {{ story.descendants ?? 0 }} comments
      </div>
      <div v-if="story.text" class="story-text" v-html="story.text"></div>
    </div>

    <div class="comment-section">
      <ul v-if="comments.length" class="comment-tree">
        <CommentNode
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          :depth="0"
        />
      </ul>
      <p v-else class="hn-empty">No comments yet.</p>
    </div>
  </main>
</template>
