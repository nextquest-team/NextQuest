<script setup lang="ts">
defineProps<{
  username: string
  horizontal?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <!-- Mode horizontal (desktop) -->
  <DashboardDbGreenFrame v-if="horizontal" class="profile-h">
    <div class="profile-h__avatar-wrap">
      <!-- TODO: remplacer par l'avatar dynamique de l'utilisateur (API) -->
      <img
        src="/images/dashboard/avatar-profile.png"
        alt="Avatar"
        class="profile-h__avatar"
      />
    </div>
    <div class="profile-h__info">
      <span class="profile-h__username">{{ username }}</span>
      <NuxtLink to="/profil" class="profile-h__btn">{{ t('dashboard.profile.button') }}</NuxtLink>
    </div>
  </DashboardDbGreenFrame>

  <!-- Mode portrait (mobile) -->
  <div v-else class="profile-card">
    <!-- TODO: remplacer par l'avatar dynamique de l'utilisateur (API) -->
    <img
      src="/images/dashboard/avatar-profile.png"
      alt="Avatar"
      class="profile-card__avatar"
    />
    <div class="profile-card__content">
      <NuxtLink to="/profil" class="profile-card__btn">{{ t('dashboard.profile.button') }}</NuxtLink>
      <span class="profile-card__username">{{ username }}</span>
    </div>
  </div>
</template>

<style scoped>
/* ── Mode portrait (mobile) ── */
.profile-card {
  flex: 0 0 30%;
  aspect-ratio: 143 / 257;
  position: relative;
  overflow: hidden;
}

.profile-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('/images/dashboard/encadrement-vert.png');
  background-size: 100% 100%;
  pointer-events: none;
  z-index: 2;
}

.profile-card__avatar {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 85%;
  height: 55%;
  object-fit: contain;
  object-position: top;
  z-index: 1;
}

.profile-card__content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 25%;
  gap: 8%;
}

.profile-card__btn {
  appearance: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
  font-family: var(--nq-font);
  font-size: clamp(0.6rem, 1.8vw, 0.85rem);
  padding: 5px 14px;
  border-radius: 5px;
  background: #a65d52;
  color: #edc78e;
  white-space: nowrap;
}

.profile-card__username {
  font-family: var(--nq-font);
  font-size: clamp(0.85rem, 2.5vw, 1.1rem);
  font-weight: bold;
  color: #332b25;
  text-align: center;
}

/* ── Mode horizontal (desktop) ── */
.profile-h {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 32px;
}

.profile-h__avatar-wrap {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #e8dfc8;
  position: relative;
  z-index: 1;
}

.profile-h__info {
  position: relative;
  z-index: 1;
}

.profile-h__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.profile-h__info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-h__username {
  font-family: var(--nq-font);
  font-size: clamp(1rem, 1.5vw, 1.4rem);
  font-weight: bold;
  color: #332b25;
  white-space: nowrap;
}

.profile-h__btn {
  appearance: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
  font-family: var(--nq-font);
  font-size: clamp(0.7rem, 1vw, 0.95rem);
  padding: 6px 16px;
  border-radius: 5px;
  background: #a65d52;
  color: #edc78e;
  white-space: nowrap;
  display: inline-block;
}
</style>
