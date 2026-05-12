<script setup lang="ts">
defineProps<{
  username: string
}>()

defineEmits<{
  logout: []
}>()

const { t } = useI18n()

// TODO: remplacer par les jeux de l'utilisateur depuis l'API
const games = [
  { id: 1, title: 'Hollow Knight' },
  { id: 2, title: 'Zelda BOTW' },
  { id: 3, title: 'Binding of Isaac' },
  { id: 4, title: "Yoshi's Woolly World" },
  { id: 5, title: 'Resident Evil' },
  { id: 6, title: 'Portal' },
]
</script>

<template>
  <div class="dd">

    <!-- Sac à dos — déborde sur la gauche -->
    <img
      src="/images/dashboard/sac-a-dos.png"
      alt=""
      class="dd__bag"
    />
    <NuxtLink to="/game-list" class="dd__bag-btn">
      {{ t('dashboard.sacoche.gameList') }}
    </NuxtLink>

    <!-- Profil horizontal + roue : empilés au centre -->
    <div class="dd__center">
      <DashboardDbProfileCard :username="username" :horizontal="true" />
      <DashboardDbWheel />
    </div>

    <!-- Parchemin ouvert — droite, avec cards scrollables à l'intérieur -->
    <div class="dd__parchemin">
      <img
        src="/images/dashboard/parchemin-ouvert.png"
        alt=""
        class="dd__parchemin-img"
      />
      <div class="dd__parchemin-scroll">
        <div
          v-for="game in games"
          :key="game.id"
          class="dd__game-slot"
          :title="game.title"
        >
          <!-- TODO: image couverture depuis API -->
        </div>
      </div>
      <NuxtLink to="/actualites" class="dd__parchemin-voir-tout">
        {{ t('dashboard.parchemin.voirTout') }}
      </NuxtLink>
    </div>

    <!-- Card map + globe — bas -->
    <div class="dd__cardmap">
      <DashboardDbGameCards>
        <template #header>
          <NuxtLink to="/timeline" class="dd__timeline-link">
            {{ t('nav.timeline') }}
            <v-icon size="14">mdi-chevron-right</v-icon>
          </NuxtLink>
        </template>
      </DashboardDbGameCards>
    </div>

  </div>
</template>

<style scoped>
.dd {
  width: 100%;
  height: 100dvh;
  position: relative;
  overflow: hidden;
  background-image: url('/images/backgrounds/fond.png');
  background-size: cover;
  background-position: center top;
}

/* ── Sac à dos : déborde ~22% sur la gauche ── */
.dd__bag {
  position: absolute;
  left: -17%;
  top: 0%;
  width: 72%;
  height: auto;
  pointer-events: none;
}

/* ── Centre : profil + roue empilés ── */
.dd__center {
  position: absolute;
  left: 50%;
  top: 5%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
}

/* ── Parchemin ouvert : droite, déborde légèrement en haut ── */
.dd__parchemin {
  position: absolute;
  left: 70%;
  top: -1%;
  width: 25%;
  height: 70%;
}

.dd__parchemin-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

/* Zone scrollable à l'intérieur du parchemin (évite les bords) */
.dd__parchemin-scroll {
  position: absolute;
  top: 14%;
  bottom: 13%;
  left: 9%;
  right: 9%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 6%;
  padding: 4% 0;
}

.dd__parchemin-scroll::-webkit-scrollbar {
  display: none;
}

/* Carte actualité / amis — bord fin ── */
.dd__game-slot {
  flex-shrink: 0;
  width: 82%;
  margin: 0 auto;
  aspect-ratio: 5 / 2;
  border: 1.5px solid #7a3e2a;
  border-radius: 6px;
  background: rgba(245, 237, 223, 0.55);
}

/* ── Bouton sac à dos : en haut de la zone visible ── */
.dd__bag-btn {
  position: absolute;
  left: 13%;
  top: 14%;
  display: inline-flex;
  align-items: center;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1vw, 1rem);
  color: #edc78e;
  text-decoration: none;
  background: #7a3e2a;
  padding: 7px 18px;
  border-radius: 5px;
  white-space: nowrap;
  min-height: 44px;
}

/* ── Bouton "Voir tout" en bas du parchemin ── */
.dd__parchemin-voir-tout {
  position: absolute;
  bottom: 5%;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1vw, 1rem);
  color: #edc78e;
  text-decoration: none;
  background: #7a3e2a;
  padding: 7px 18px;
  border-radius: 5px;
  white-space: nowrap;
  min-height: 44px;
}

/* ── Bouton Sorties de jeux ── */
.dd__timeline-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1vw, 1rem);
  color: #edc78e;
  text-decoration: none;
  background: #7a3e2a;
  padding: 7px 18px;
  border-radius: 5px;
  border: none;
  white-space: nowrap;
  min-height: 44px;
}

/* ── Card map : bas, centrée ── */
.dd__cardmap {
  position: absolute;
  left: 0;
  right: 0;
  top: 68%;
  height: 36%;
  display: flex;
  justify-content: center;
}
</style>
