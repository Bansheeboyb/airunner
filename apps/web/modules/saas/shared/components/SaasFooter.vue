<template>
  <footer class="container py-4 text-center text-sm text-muted-foreground">
    <span>
      <a href="https://supastarter.dev"
        >&copy; {{ new Date().getFullYear() }} AI Runner. All rights
        reserved.</a
      >
    </span>
    <span class="opacity-50"> | </span>
    <NuxtLink to="/legal/privacy-policy">Privacy policy</NuxtLink>
    <span class="opacity-50"> | </span>
    <NuxtLink to="/legal/terms">Terms and conditions</NuxtLink>
  </footer>
</template>
