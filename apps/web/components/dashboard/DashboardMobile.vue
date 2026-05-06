<script setup lang="ts">
const { t } = useI18n()

defineProps<{
  username: string
}>()

defineEmits<{
  logout: []
}>()

const sacocheOpen = ref(false)
</script>

<template>
  <div class="dm">

    <div class="dm__top">

      <!-- Profil + Parchemin en flex -->
      <DashboardDbProfileCard :username="username" />
      <DashboardDbParchemin />

      <!-- Sac : demi-crop sur le bord droit, toujours au-dessus du panel -->
      <div class="dm__sacoche">
        <img
          src="/images/dashboard/hero-dragon.png"
          alt=""
          class="dm__sacoche-img"
        />
        <!-- Bouton dans la zone visible (moitié gauche du sac = moitié droite de l'écran) -->
        <button class="dm__sacoche-btn" @click="sacocheOpen = !sacocheOpen">
          {{ t('dashboard.sacoche.inventaire') }}
        </button>
      </div>

      <!-- Panel landscape — glisse depuis la droite par-dessus les autres éléments -->
      <Transition name="sacoche-slide">
        <div v-if="sacocheOpen" class="dm__sacoche-panel" @click="sacocheOpen = false">
          <img
            src="/images/dashboard/hero-landscape.png"
            alt=""
            class="dm__sacoche-panel-bg"
          />
          <div class="dm__sacoche-panel-actions">
            <NuxtLink to="/game-list" class="dm__sacoche-panel-btn" @click.stop>
              {{ t('dashboard.sacoche.gameList') }}
            </NuxtLink>
            <NuxtLink to="/add-game" class="dm__sacoche-panel-btn" @click.stop>
              {{ t('dashboard.sacoche.addGame') }}
            </NuxtLink>
          </div>
        </div>
      </Transition>

    </div>

    <div class="dm__mid">
      <DashboardDbWheel />
    </div>

    <div class="dm__bot">
      <DashboardDbGameCards />
    </div>

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

.dm__top {
  flex: 0 0 42%;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 4%;
  padding: 3% 3%;
}

/* ── Sac : absolu sur le bord droit, z-index élevé ── */
.dm__sacoche {
  position: absolute;
  right: 0;
  top: 50%;
  /* translate(50%) décale de la moitié de sa propre largeur → crop exact */
  transform: translate(50%, -50%);
  height: 110%;
  width: auto;
  z-index: 10;
  pointer-events: none; /* laisse passer les clics vers le panel */
}

.dm__sacoche-img {
  height: 100%;
  width: auto;
  display: block;
}

/* Bouton dans la moitié visible du sac */
.dm__sacoche-btn {
  position: absolute;
  bottom: 20%;
  left: 42%;
  transform: translateX(-50%);
  appearance: none;
  border: none;
  cursor: pointer;
  pointer-events: auto; /* réactive les clics sur le bouton uniquement */
  font-family: var(--nq-font);
  font-size: clamp(0.75rem, 2.2vw, 1rem);
  padding: 7px 18px;
  border-radius: 5px;
  background: #7a3e2a;
  color: #edc78e;
  white-space: nowrap;
}

/* ── Panel landscape ── */
.dm__sacoche-panel {
  position: absolute;
  /* Ignore le padding de dm__top pour coller aux bords */
  top: 10%;
  bottom: 0;
  left: 5%;
  right: -3%;
  z-index: 5; /* sous le sac (z-index 10), au-dessus des autres */
  overflow: hidden;
}

.dm__sacoche-panel-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.dm__sacoche-panel-actions {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10%;
  padding: 0 18% 0 5%;
}

.dm__sacoche-panel-btn {
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: var(--nq-font);
  font-size: clamp(0.7rem, 2vw, 0.95rem);
  padding: 8px 16px;
  border-radius: 5px;
  background: #a65d52;
  color: #edc78e;
  white-space: nowrap;
}

/* ── Animation : glisse depuis la droite ── */
.sacoche-slide-enter-active,
.sacoche-slide-leave-active {
  transition: transform 0.4s ease;
}

.sacoche-slide-enter-from,
.sacoche-slide-leave-to {
  transform: translateX(100%);
}

.sacoche-slide-enter-to,
.sacoche-slide-leave-from {
  transform: translateX(0%);
}

/* ── Zones du bas ── */
.dm__mid {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dm__bot { flex: 0 0 28%; }
</style>
