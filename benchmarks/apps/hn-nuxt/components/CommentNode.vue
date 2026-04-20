<script setup lang="ts">
import type { CommentTree } from '../../hn-shared/types';
import { timeAgo } from '../../hn-shared/api';

defineProps<{
  comment: CommentTree;
  depth: number;
}>();
</script>

<template>
  <li :class="['comment', `comment-indent-${Math.min(depth, 2)}`]">
    <div class="comment-meta">
      <NuxtLink :to="`/user/${comment.by}`">{{ comment.by }}</NuxtLink>
      {{ timeAgo(comment.time) }}
    </div>
    <div class="comment-text" v-html="comment.text"></div>
    <ul v-if="comment.children?.length" class="comment-tree">
      <CommentNode
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>
