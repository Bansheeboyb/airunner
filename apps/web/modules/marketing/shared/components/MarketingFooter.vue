<template>
  <footer class="relative py-16 overflow-hidden bg-crypto-dark-900">
    <!-- Background elements -->
    <div class="absolute inset-0 z-0">
      <div
        class="absolute top-0 left-0 w-full h-full opacity-5 bg-grid-pattern"
      ></div>
      <div
        class="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-crypto-dark-800 to-transparent"
      ></div>
    </div>

    <div class="container mx-auto px-4 relative z-10">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
        <!-- Logo and About Column -->
        <div class="space-y-6">
          <div class="flex items-center">
            <span
              class="text-xl font-bold ai-gradient-text crypto-gradient-text ml-2"
              >AI Runner</span
            >
          </div>
          <p class="text-crypto-light-500">
            An enterprise-grade AI infrastructure platform providing scalable,
            reliable API access to the latest AI models with unparalleled
            performance.
          </p>

          <!-- Social Media Icons -->
          <div class="flex space-x-4">
            <a
              href="#"
              class="h-10 w-10 rounded-full bg-crypto-dark-700 flex items-center justify-center hover:bg-crypto-dark-600 transition-colors"
            >
              <svg
                class="h-5 w-5 text-crypto-light-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
                ></path>
              </svg>
            </a>
            <a
              href="#"
              class="h-10 w-10 rounded-full bg-crypto-dark-700 flex items-center justify-center hover:bg-crypto-dark-600 transition-colors"
            >
              <svg
                class="h-5 w-5 text-crypto-light-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"
                ></path>
              </svg>
            </a>
            <a
              href="#"
              class="h-10 w-10 rounded-full bg-crypto-dark-700 flex items-center justify-center hover:bg-crypto-dark-600 transition-colors"
            >
              <svg
                class="h-5 w-5 text-crypto-light-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path
                  d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"
                ></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            <a
              href="#"
              class="h-10 w-10 rounded-full bg-crypto-dark-700 flex items-center justify-center hover:bg-crypto-dark-600 transition-colors"
            >
              <svg
                class="h-5 w-5 text-crypto-light-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"
                ></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
            </a>
          </div>
        </div>

        <!-- Navigation Links Here -->
        <div>
          <h4 class="text-lg font-bold mb-6 text-crypto-light-300">
            Quick Links
          </h4>
          <ul class="space-y-3">
            <li v-for="(link, index) in quickLinks" :key="index">
              <a
                :href="link.href"
                class="text-crypto-light-500 hover:text-crypto-blue-400 transition-colors"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Resources Links -->
        <div>
          <h4 class="text-lg font-bold mb-6 text-crypto-light-300">
            Resources
          </h4>
          <ul class="space-y-3">
            <li v-for="(link, index) in resourceLinks" :key="index">
              <a
                :href="link.href"
                class="text-crypto-light-500 hover:text-crypto-blue-400 transition-colors"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Newsletter Signup -->
        <div>
          <h4 class="text-lg font-bold mb-6 text-crypto-light-300">
            Stay Updated
          </h4>
          <p class="text-crypto-light-500 mb-4">
            Subscribe to our newsletter to receive updates, news, and exclusive
            offers.
          </p>

          <form @submit.prevent="subscribeNewsletter" class="space-y-4">
            <div class="flex flex-col space-y-2">
              <input
                type="email"
                v-model="newsletterEmail"
                placeholder="Your email address"
                class="px-4 py-3 rounded-lg bg-crypto-dark-800 border border-crypto-dark-600 text-crypto-light-200 focus:outline-none focus:ring-2 focus:ring-crypto-blue-500/50"
                required
              />
              <button
                type="submit"
                class="ai-button-primary crypto-button-primary"
                :disabled="subscribing"
              >
                <span v-if="subscribing">Subscribing...</span>
                <span v-else>Subscribe</span>
              </button>
            </div>
          </form>

          <!-- Success message -->
          <div
            v-if="showSubscribeSuccess"
            class="mt-4 p-3 rounded-lg bg-crypto-teal-500/20 bg-ai-accent-500/20 text-crypto-teal-400 text-ai-accent-400 text-sm"
          >
            Thank you for subscribing to our newsletter!
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-crypto-dark-600 mb-8"></div>

      <!-- Bottom Bar -->
      <div
        class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0"
      >
        <div class="text-crypto-light-600 text-sm">
          &copy; {{ new Date().getFullYear() }} AI Runner. All rights reserved.
          <a
            href="https://airunner.io"
            class="text-crypto-blue-400 hover:underline"
            >airunner.io</a
          >
        </div>

        <!-- Legal Links -->
        <div class="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <a
            href="#"
            class="text-crypto-light-500 hover:text-crypto-blue-400 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            class="text-crypto-light-500 hover:text-crypto-blue-400 transition-colors"
          >
            Terms of Service
          </a>
          <a
            href="#"
            class="text-crypto-light-500 hover:text-crypto-blue-400 transition-colors"
          >
            Cookie Policy
          </a>
          <a
            href="#"
            class="text-crypto-light-500 hover:text-crypto-blue-400 transition-colors"
          >
            Legal Notices
          </a>
        </div>
      </div>
    </div>

    <!-- Back to top button -->
    <div
      class="fixed bottom-6 right-6 z-50"
      ref="backToTopButton"
      @click="scrollToTop"
    >
      <div
        class="h-12 w-12 rounded-full bg-crypto-dark-700 hover:bg-crypto-dark-600 transition-colors shadow-lg flex items-center justify-center cursor-pointer crypto-glow ai-glow"
        :class="{ 'opacity-0': !showBackToTop, 'opacity-100': showBackToTop }"
      >
        <svg
          class="h-5 w-5 text-crypto-light-200"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </div>
    </div>
  </footer>
</template>

<script setup>
  import { ref, onMounted, onUnmounted } from "vue";

  const quickLinks = [
    { label: "Home", href: "#hero" },
    { label: "Features", href: "#features" },
    { label: "About", href: "#about" },
    { label: "Pricing", href: "#pricing" },
    { label: "Documentation", href: "#documentation" },
    { label: "Team", href: "#team" },
    { label: "Contact", href: "#contact" },
  ];

  const resourceLinks = [
    { label: "API Reference", href: "#" },
    { label: "Model Documentation", href: "#" },
    { label: "SDKs & Libraries", href: "#" },
    { label: "GitHub Repository", href: "#" },
    { label: "Change Log", href: "#" },
    { label: "FAQ", href: "#" },
    { label: "Support Center", href: "#" },
  ];

  const newsletterEmail = ref("");
  const subscribing = ref(false);
  const showSubscribeSuccess = ref(false);

  const showBackToTop = ref(false);
  const backToTopButton = ref(null);

  const subscribeNewsletter = () => {
    subscribing.value = true;

    // Simulate form submission
    setTimeout(() => {
      subscribing.value = false;
      showSubscribeSuccess.value = true;
      newsletterEmail.value = "";

      // Hide success message after 5 seconds
      setTimeout(() => {
        showSubscribeSuccess.value = false;
      }, 5000);
    }, 1000);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const checkScrollPosition = () => {
    showBackToTop.value = window.scrollY > 500;
  };

  onMounted(() => {
    window.addEventListener("scroll", checkScrollPosition);
    checkScrollPosition(); // Check initial position
  });

  onUnmounted(() => {
    window.removeEventListener("scroll", checkScrollPosition);
  });
</script>

<style scoped>
  .backToTopButton {
    transition: opacity 0.3s ease;
  }
</style>
