<script setup lang="ts">
defineProps<{
  username: string
}>()

defineEmits<{
  logout: []
}>()
</script>

<template>
  <div class="dm">
    <div class="dm__top">
      <DashboardDbProfileCard :username="username" />
      <DashboardDbParchemin />
      <DashboardDbSacoche />
    </div>
    <div class="dm__mid"><!-- roue --></div>
    <div class="dm__bot"><!-- jeux --></div>
  </div>
</template>

<style scoped>
.dm {
  width: 100%;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background-image: url('/images/backgrounds/fond.png');
  background-size: cover;
  background-position: center top;
  overflow: hidden;
}

/* Les 3 composants flottent sur le fond — pas de colonnes colorées */
.dm__top {
  flex: 0 0 42%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-evenly;
  padding: 2% 2%;
}

.dm__mid { flex: 1; }
.dm__bot { flex: 0 0 28%; }
</style>
