<script setup lang="ts">
defineProps<{
  username: string
  horizontal?: boolean
}>()

const { t } = useI18n()
const { user } = useAuth()

const avatarSrc = computed(() => user.value?.avatarUrl ?? null)
</script>

<template>
  <!-- Mode horizontal (desktop) -->
  <DashboardDbGreenFrame v-if="horizontal" class="profile-h">
    <div class="profile-h__avatar-wrap">
      <img
        v-if="avatarSrc"
        :src="avatarSrc"
        :alt="username"
        class="profile-h__avatar"
      />
      <div v-else class="profile-h__avatar-loading">
        <v-progress-circular indeterminate size="26" width="2" color="#edc78e" />
      </div>
    </div>
    <div class="profile-h__info">
      <span class="profile-h__username">{{ username }}</span>
      <NuxtLink to="/profil" class="profile-h__btn">{{ t('dashboard.profile.button') }}</NuxtLink>
    </div>
  </DashboardDbGreenFrame>

  <!-- Mode portrait (mobile) -->
  <div v-else class="profile-card">
    <div class="profile-card__avatar-wrap">
      <img
        v-if="avatarSrc"
        :src="avatarSrc"
        :alt="username"
        class="profile-card__avatar"
      />
      <v-progress-circular v-else indeterminate size="28" width="2" color="var(--nq-brown-mid)" />
    </div>
    <div class="profile-card__content">
      <NuxtLink to="/profil" class="profile-card__btn">{{ t('dashboard.profile.button') }}</NuxtLink>
      <span class="profile-card__username">{{ username }}</span>
    </div>
  </div>
</template>

<style scoped>
/* ── Mode portrait (mobile) ── */
.profile-card {
  flex: 0 0 36%;
  aspect-ratio: 143 / 257;
  position: relative;
  overflow: hidden;
}

/* Fond crème inséré à l'intérieur de la zone opaque du cadre (~5.5% transparent tout autour) */
.profile-card::before {
  content: '';
  position: absolute;
  inset: 6%;
  background: var(--nq-cream-alt);
  border-radius: 15%;
  z-index: 0;
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

.profile-card__avatar-wrap {
  position: absolute;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  width: 58%;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  background: #e8dfc8;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.profile-card__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
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
  font-size: clamp(0.875rem, 1.8vw, 0.95rem);
  padding: 5px 14px;
  border-radius: 5px;
  background: var(--nq-brown-mid);
  color: var(--nq-cream-light);
  white-space: nowrap;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.profile-card__username {
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 2.5vw, 1.1rem);
  font-weight: bold;
  color: var(--nq-text-alt);
  text-align: center;
}

/* ── Mode horizontal (desktop) ── */
.profile-h {
  --frame-bg: var(--nq-cream-alt);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 35px 45px;
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

.profile-h__avatar-loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
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
  color: var(--nq-text-alt);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.profile-h__btn {
  appearance: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1vw, 0.95rem);
  padding: 6px 16px;
  border-radius: 5px;
  background: var(--nq-brown-mid);
  color: var(--nq-cream-light);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}
</style>
