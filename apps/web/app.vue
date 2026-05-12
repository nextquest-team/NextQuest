<script setup lang="ts">
</script>

<template>
  <v-app theme="nextquest">
    <div class="app-bg">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </v-app>
</template>

<style>
.app-bg {
  min-height: 100vh;
  background-image: url('/images/backgrounds/fond.png');
  background-size: cover;
  background-position: center;
  background-repeat: repeat;
}
</style>
