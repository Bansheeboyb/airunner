<script setup lang="ts">
  import { z } from "zod";
  import { useToast } from "@/modules/ui/components/toast";

  const props = defineProps<{
    initialValue: string | null; // Changed to accept null
    teamId: string;
  }>();

  const { t } = useTranslations();
  const { apiCaller } = useApiCaller();
  const { toast } = useToast();
  const { reloadUser } = useUser();

  const formSchema = toTypedSchema(
    z.object({
      hfApiKey: z.string().optional(),
    }),
  );

  const { handleSubmit, isSubmitting, meta } = useForm({
    validationSchema: formSchema,
    initialValues: {
      hfApiKey: props.initialValue || "", // Handle null case
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiCaller.team.update.mutate({
        id: props.teamId,
        encryptedHFApiKey: values.hfApiKey,
      });

      toast({
        variant: "success",
        title:
          t("settings.notifications.teamNameUpdated") ||
          "Hugging Face API token updated successfully",
      });

      reloadUser();
    } catch (error) {
      toast({
        variant: "error",
        title:
          t("settings.notifications.teamNameNotUpdated") ||
          "Failed to update Hugging Face API token",
      });
    }
  });
</script>

<template>
  <SaasActionBlock
    @submit="onSubmit"
    :isSubmitting="isSubmitting"
    :isSubmitDisabled="!meta.valid || !meta.dirty"
  >
    <template #title>HuggingFace Token</template>
    <p class="pb-10">{{ $t("settings.team.updateHFToken.description") }}</p>
    <div>
      <FormField v-slot="{ componentField }" name="hfApiKey">
        <FormItem>
          <Input
            v-bind="componentField"
            type="password"
            :id="componentField.name"
            autocomplete="off"
            class="max-w-sm"
            :placeholder="'Enter your Hugging Face API token'"
          />
          <FormMessage />
        </FormItem>
      </FormField>
    </div>
  </SaasActionBlock>
</template>
