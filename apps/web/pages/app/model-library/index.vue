<script setup lang="ts">
  definePageMeta({
    layout: "saas-app",
  });
</script>

<template>
  <div class="container max-w-6xl py-8">
    <SaasPageHeader>
      <template #title>Model Library</template>
      <template #subtitle>Select an LLM to deploy for your team.</template>
    </SaasPageHeader>

    <div
      class="mx-auto w-fullrounded-lg border bg-card p-8 text-foreground rounded-lg"
    >
      <div>
        <p class="mb-4"></p>
        <SaasProductNameGenerator />
      </div>
    </div>
  </div>
</template>
