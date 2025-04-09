<script setup lang="ts">
  import { ref, computed, onMounted } from "vue";
  import { useToast } from "@/modules/ui/components/toast";
  import { ApiKeyType } from "database";
  import { CopyIcon, TrashIcon, PlusIcon } from "lucide-vue-next";
  import { useTranslations } from "@/modules/shared/composables/useTranslations";
  import { useApiCaller } from "@/modules/shared/composables/useApiCaller";
  import { Button } from "@/modules/ui/components/button";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/modules/ui/components/table";
  import { Badge } from "@/modules/ui/components/badge";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/modules/ui/components/dialog";
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/modules/ui/components/alert-dialog";
  import { Label } from "@/modules/ui/components/label";
  import { Input } from "@/modules/ui/components/input";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/modules/ui/components/select";
  import SaasActionBlock from "@/modules/saas/shared/components/SaasActionBlock.vue";

  const props = defineProps<{
    teamId?: string;
    defaultType?: "PERSONAL" | "TEAM";
  }>();

  const { t } = useTranslations();
  const { apiCaller } = useApiCaller();
  const { toast, dismiss } = useToast();

  // State
  const apiKeys = ref<any[]>([]);
  const isLoading = ref(true);
  const filterType = ref(props.defaultType || "ALL");
  const showNewKeyDialog = ref(false);
  const showKeyRevealDialog = ref(false);
  const showDeleteDialog = ref(false);
  const keyToDelete = ref<string | null>(null);
  const newKeyName = ref("");
  const newKeyType = ref(props.defaultType || "PERSONAL");
  const newKeyExpiry = ref<Date | null>(null);
  const newlyCreatedKey = ref("");
  const expiryOptions = [
    { label: t("apiKeys.noExpiration"), value: null },
    { label: t("apiKeys.30days"), value: 30 },
    { label: t("apiKeys.60days"), value: 60 },
    { label: t("apiKeys.90days"), value: 90 },
    { label: t("apiKeys.1year"), value: 365 },
  ];
  const selectedExpiryOption = ref<number | null>(null);

  // Computed
  const filteredApiKeys = computed(() => {
    if (filterType.value === "ALL") return apiKeys.value;
    return apiKeys.value.filter((key) => key.type === filterType.value);
  });

  // Simple check if team keys can be created (if teamId is provided)
  const canCreateTeamKeys = computed(() => {
    return !!props.teamId;
  });

  // Methods
  const loadApiKeys = async () => {
    isLoading.value = true;
    try {
      const result = await apiCaller.team.listApiKeys.query({
        type: filterType.value as "PERSONAL" | "TEAM" | "ALL",
        teamId: props.teamId,
      });
      apiKeys.value = result;
    } catch (error: any) {
      toast({
        variant: "error",
        title: t("apiKeys.notifications.loadFailed.title"),
        description: error.message,
      });
    } finally {
      isLoading.value = false;
    }
  };

  const createApiKey = async () => {
    try {
      const loadingToast = toast({
        variant: "loading",
        description: t("apiKeys.notifications.createKey.loading.description"),
      });

      // Create the request object
      const requestData: any = {
        name: newKeyName.value,
        type: newKeyType.value as ApiKeyType,
      };

      // Only add teamId for team keys
      if (newKeyType.value === "TEAM" && props.teamId) {
        requestData.teamId = props.teamId;
      }

      // Only add expiration date if one is selected and it has a value
      if (selectedExpiryOption.value !== null) {
        const days = selectedExpiryOption.value;
        const date = new Date();
        date.setDate(date.getDate() + days);
        requestData.expiresAt = date;
      }

      const result = await apiCaller.team.createApiKey.mutate(requestData);

      showNewKeyDialog.value = false;
      newlyCreatedKey.value = result.key;
      showKeyRevealDialog.value = true;

      // Reload keys
      await loadApiKeys();

      // Reset form
      newKeyName.value = "";
      selectedExpiryOption.value = null;

      toast({
        variant: "success",
        title: t("apiKeys.notifications.createKey.success.title"),
      });
      dismiss(loadingToast.id);
    } catch (error: any) {
      toast({
        variant: "error",
        title: t("apiKeys.notifications.createKey.error.title"),
        description: error.message,
      });
    }
  };

  const confirmDeleteApiKey = (keyId: string) => {
    keyToDelete.value = keyId;
    showDeleteDialog.value = true;
  };

  const deleteApiKey = async () => {
    if (!keyToDelete.value) return;

    const loadingToast = toast({
      variant: "loading",
      description: t("apiKeys.notifications.deleteKey.loading.description"),
    });

    try {
      // Pass the keyId directly as a string, not as an object
      await apiCaller.team.deleteApiKey.mutate(keyToDelete.value);
      await loadApiKeys();

      toast({
        variant: "success",
        title: t("apiKeys.notifications.deleteKey.success.title"),
      });
    } catch (error: any) {
      toast({
        variant: "error",
        title: t("apiKeys.notifications.deleteKey.error.title"),
        description: error.message,
      });
    } finally {
      dismiss(loadingToast.id);
      showDeleteDialog.value = false;
      keyToDelete.value = null;
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      variant: "success",
      title: t("apiKeys.notifications.keyCopied.title"),
    });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return t("apiKeys.never");
    return new Date(date).toLocaleDateString();
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(date.getTime() - now.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t("apiKeys.today");
    } else if (diffDays === 1) {
      return t("apiKeys.yesterday");
    } else if (diffDays < 7) {
      return t("apiKeys.daysAgo", { count: diffDays });
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return t("apiKeys.weeksAgo", { count: weeks });
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return t("apiKeys.monthsAgo", { count: months });
    } else {
      const years = Math.floor(diffDays / 365);
      return t("apiKeys.yearsAgo", { count: years });
    }
  };

  // Lifecycle
  onMounted(() => {
    loadApiKeys();
  });

  defineExpose({
    loadApiKeys,
  });
</script>

<template>
  <SaasActionBlock>
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">{{ t("apiKeys.title") }}</h2>
        <Button variant="default" @click="showNewKeyDialog = true">
          <PlusIcon class="mr-2 size-4" />
          {{ t("apiKeys.createKey") }}
        </Button>
      </div>

      <p class="text-muted-foreground">
        {{ t("apiKeys.description") }}
      </p>

      <!-- Filter Buttons -->
      <div class="flex gap-2"></div>

      <!-- API Keys Table -->
      <div class="rounded-md border w-80 sm:w-full">
        <div
          class="overflow-x-auto"
          style="-webkit-overflow-scrolling: touch; max-width: 100vw"
        >
          <div class="inline-block align-middle">
            <div class="w-full">
              <Table class="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead class="whitespace-nowrap">{{
                      t("apiKeys.table.name")
                    }}</TableHead>
                    <TableHead class="whitespace-nowrap">{{
                      t("apiKeys.table.key")
                    }}</TableHead>
                    <TableHead class="whitespace-nowrap">{{
                      t("apiKeys.table.type")
                    }}</TableHead>
                    <TableHead class="whitespace-nowrap">{{
                      t("apiKeys.table.created")
                    }}</TableHead>
                    <TableHead class="whitespace-nowrap">{{
                      t("apiKeys.table.expires")
                    }}</TableHead>
                    <TableHead class="whitespace-nowrap">{{
                      t("apiKeys.table.lastUsed")
                    }}</TableHead>
                    <TableHead class="text-right whitespace-nowrap">{{
                      t("apiKeys.table.actions")
                    }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody v-if="isLoading">
                  <TableRow>
                    <TableCell colspan="7" class="h-24 text-center">
                      <div class="flex justify-center items-center">
                        <!-- You can use your loading spinner component here -->
                        {{ t("apiKeys.loading") }}
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
                <TableBody v-else-if="filteredApiKeys.length === 0">
                  <TableRow>
                    <TableCell
                      colspan="7"
                      class="h-24 text-center text-muted-foreground"
                    >
                      {{ t("apiKeys.noKeysFound") }}
                    </TableCell>
                  </TableRow>
                </TableBody>
                <TableBody v-else>
                  <TableRow v-for="key in filteredApiKeys" :key="key.id">
                    <TableCell class="whitespace-nowrap">
                      <div>
                        <span class="font-medium">{{ key.name }}</span>
                        <span
                          v-if="key.type === 'TEAM'"
                          class="ml-2 text-xs text-muted-foreground"
                        >
                          ({{ key.team?.name }})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell class="whitespace-nowrap">
                      <code
                        class="bg-muted px-2 py-1 rounded font-mono text-xs"
                      >
                        {{ key.keyPrefix }}•••••••••••••
                      </code>
                    </TableCell>
                    <TableCell class="whitespace-nowrap">
                      <Badge
                        :variant="
                          key.type === 'PERSONAL' ? 'secondary' : 'default'
                        "
                      >
                        {{ key.type }}
                      </Badge>
                    </TableCell>
                    <TableCell
                      class="text-muted-foreground text-sm whitespace-nowrap"
                    >
                      {{ formatRelativeTime(key.createdAt) }}
                    </TableCell>
                    <TableCell
                      class="text-muted-foreground text-sm whitespace-nowrap"
                    >
                      {{
                        key.expiresAt
                          ? formatDate(key.expiresAt)
                          : t("apiKeys.never")
                      }}
                    </TableCell>
                    <TableCell
                      class="text-muted-foreground text-sm whitespace-nowrap"
                    >
                      {{
                        key.lastUsedAt
                          ? formatRelativeTime(key.lastUsedAt)
                          : t("apiKeys.never")
                      }}
                    </TableCell>
                    <TableCell class="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        @click="confirmDeleteApiKey(key.id)"
                        class="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <TrashIcon class="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <!-- Create API Key Dialog -->
      <Dialog :open="showNewKeyDialog" @close="showNewKeyDialog = false">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{{ t("apiKeys.dialog.createKey.title") }}</DialogTitle>
            <DialogDescription>
              {{ t("apiKeys.dialog.createKey.description") }}
            </DialogDescription>
          </DialogHeader>

          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="name" class="text-right">
                {{ t("apiKeys.dialog.createKey.nameLabel") }}
              </Label>
              <Input id="name" v-model="newKeyName" class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="type" class="text-right">
                {{ t("apiKeys.dialog.createKey.typeLabel") }}
              </Label>
              <div class="col-span-3" style="min-width: 250px; width: 100%">
                <Select
                  v-model="newKeyType"
                  :disabled="!props.teamId"
                  class="w-full"
                >
                  <SelectTrigger style="width: 100%">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style="min-width: 250px">
                    <SelectItem value="PERSONAL">
                      {{ t("apiKeys.personal") }}
                    </SelectItem>
                    <SelectItem v-if="props.teamId" value="TEAM">
                      {{ t("apiKeys.team") }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="expiry" class="text-right">
                {{ t("apiKeys.dialog.createKey.expiryLabel") }}
              </Label>
              <div class="col-span-3" style="min-width: 250px; width: 100%">
                <Select v-model="selectedExpiryOption" class="w-full">
                  <SelectTrigger style="width: 100%">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style="min-width: 250px">
                    <SelectItem
                      v-for="option in expiryOptions"
                      :key="option.label"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="showNewKeyDialog = false">
              {{ t("apiKeys.dialog.cancel") }}
            </Button>
            <Button
              variant="default"
              @click="createApiKey"
              :disabled="!newKeyName"
            >
              {{ t("apiKeys.dialog.create") }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- API Key Reveal Dialog -->
      <Dialog :open="showKeyRevealDialog" @close="showKeyRevealDialog = false">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{{
              t("apiKeys.dialog.keyCreated.title")
            }}</DialogTitle>
            <DialogDescription>
              {{ t("apiKeys.dialog.keyCreated.description") }}
            </DialogDescription>
          </DialogHeader>

          <div class="grid gap-4 py-4">
            <div class="bg-muted p-4 rounded-md">
              <code class="break-all font-mono text-sm">{{
                newlyCreatedKey
              }}</code>
            </div>

            <div class="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                @click="copyApiKey(newlyCreatedKey)"
                class="flex items-center gap-2"
              >
                <CopyIcon class="size-4" />
                <span>{{ t("apiKeys.dialog.keyCreated.copy") }}</span>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="default" @click="showKeyRevealDialog = false">
              {{ t("apiKeys.dialog.done") }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Delete API Key Alert Dialog -->
      <AlertDialog
        :open="showDeleteDialog"
        @update:open="(open: boolean) => (showDeleteDialog = open)"
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle class="text-destructive">
              {{ t("apiKeys.dialog.deleteKey.title") }}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {{ t("apiKeys.dialog.deleteKey.confirmation") }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="showDeleteDialog = false">
              {{ t("common.confirmation.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" @click="deleteApiKey">
              {{ t("apiKeys.dialog.deleteKey.submit") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </SaasActionBlock>
</template>
