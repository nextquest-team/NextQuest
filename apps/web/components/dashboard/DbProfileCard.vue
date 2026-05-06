<script setup lang="ts">
defineProps<{
  username: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="profile-card">
    <!-- TODO: remplacer par l'avatar dynamique de l'utilisateur (API) -->
    <img
      src="/images/dashboard/avatar-profile.png"
      alt="Avatar"
      class="profile-card__avatar"
    />
    <div class="profile-card__content">
      <button class="profile-card__btn">{{ t('dashboard.profile.button') }}</button>
      <span class="profile-card__username">{{ username }}</span>
    </div>
  </div>
</template>

<style scoped>
.profile-card {
  /* Taille naturelle — ne s'étire pas à toute la hauteur du parent */
  flex: 0 0 30%;
  aspect-ratio: 143 / 257;
  position: relative;
  overflow: hidden;
}

/* Cadre vert en overlay au-dessus de l'avatar */
.profile-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('/images/dashboard/encadrement-vert.png');
  background-size: 100% 100%;
  pointer-events: none;
  z-index: 2;
}

/* Avatar derrière le cadre */
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

/* Bouton + pseudo au-dessus du cadre */
.profile-card__content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 18%;
  gap: 8%;
}

.profile-card__btn {
  appearance: none;
  border: none;
  cursor: pointer;
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
</style>
