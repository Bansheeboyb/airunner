<script setup lang="ts">
  const { t } = useTranslations();

  definePageMeta({
    layout: "saas-auth",
  });

  useSeoMeta({
    title: t("auth.verifyOtp.title"),
  });
</script>

<template>
  <SaasOtpForm />
</template>
