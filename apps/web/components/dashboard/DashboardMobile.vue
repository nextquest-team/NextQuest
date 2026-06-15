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
      <DashboardDbProfileCard :username="username" data-onb-target="profile" />
      <DashboardDbParchemin data-onb-target="parchemin" />

      <!-- Sac : demi-crop sur le bord droit, toujours au-dessus du panel -->
      <div class="dm__sacoche">
        <img
          src="/images/dashboard/hero-dragon.png"
          alt=""
          class="dm__sacoche-img"
        />
        <!-- Le bouton est dans la zone visible → sert de cible précise pour l'onboarding -->
        <button
          class="dm__sacoche-btn"
          data-onb-target="bag"
          :aria-expanded="sacocheOpen"
          :aria-label="t('dashboard.sacoche.inventaire')"
          @click="sacocheOpen = !sacocheOpen"
        >
          {{ t('dashboard.sacoche.inventaire') }}
        </button>
      </div>

      <!-- Panel landscape — glisse depuis la droite par-dessus les autres éléments -->
      <Transition name="sacoche-slide">
        <div v-if="sacocheOpen" class="dm__sacoche-panel" role="dialog" :aria-label="t('dashboard.sacoche.inventaire')" @click="sacocheOpen = false">
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

    <div class="dm__mid" data-onb-target="wheel">
      <DashboardDbWheel />
    </div>

    <div class="dm__bot" data-onb-target="timeline">
      <DashboardDbGameCards>
        <template #header>
          <NuxtLink to="/timeline" class="dm__timeline-link">
            {{ t('nav.timeline') }}
            <v-icon size="14">mdi-chevron-right</v-icon>
          </NuxtLink>
        </template>
      </DashboardDbGameCards>
    </div>

  </div>
</template>

<style scoped>
.dm {
  width: 100%;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: transparent;
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
  height: min(85%, 75vw);
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
  font-size: clamp(0.875rem, 2.2vw, 1rem);
  padding: 7px 18px;
  border-radius: 5px;
  background: #7a3e2a;
  color: #edc78e;
  white-space: nowrap;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
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
  width: 90%;
  height: auto;
  top: 44%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.dm__sacoche-panel-actions {
  position: absolute;
  width: 90%;
  top: 44%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 0 18% 0 5%;
}

.dm__sacoche-panel-btn {
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 2vw, 0.95rem);
  padding: 8px 16px;
  border-radius: 5px;
  background: #7a3e2a;
  color: #edc78e;
  white-space: nowrap;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
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

/* ── Bouton Sorties de jeux ── */
.dm__timeline-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 2.2vw, 1rem);
  color: #edc78e;
  text-decoration: none;
  background: #7a3e2a;
  padding: 7px 18px;
  border-radius: 5px;
  border: none;
  white-space: nowrap;
  min-height: 44px;
}

/* ── Zones du bas ── */
.dm__mid {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dm__bot {
  flex: 0 0 28%;
  overflow: hidden;
}
</style>
