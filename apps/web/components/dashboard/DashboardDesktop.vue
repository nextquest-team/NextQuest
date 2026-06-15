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

    <!-- Colonne gauche : sac à dos -->
    <div class="dd__bag" data-onb-target="bag">
      <img
        src="/images/dashboard/sac-a-dos.png"
        alt=""
        class="dd__bag-img"
      />
      <NuxtLink to="/game-list" class="dd__bag-btn">
        {{ t('dashboard.sacoche.gameList') }}
      </NuxtLink>
    </div>

    <!-- Colonne centrale : profil + boussole -->
    <div class="dd__center">
      <DashboardDbProfileCard :username="username" :horizontal="true" data-onb-target="profile" />
      <div data-onb-target="wheel">
        <DashboardDbWheel />
      </div>
    </div>

    <!-- Colonne droite : parchemin -->
    <div class="dd__parchemin" data-onb-target="parchemin">
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

    <!-- Ligne basse : sorties de jeux (pleine largeur) -->
    <div class="dd__cardmap" data-onb-target="timeline">
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
/*
 * Grille principale — fidèle au wireframe :
 *
 * | sac       | profil/boussole | parchemin |
 * | sortie de jeux (pleine largeur)           |
 */
.dd {
  width: 100%;
  height: 100dvh;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 66% 34%;
  grid-template-areas:
    "bag    center   parchemin"
    "cardmap cardmap cardmap";
  overflow: hidden;
  background: transparent;
}

/* ── Sac à dos ─────────────────────────────────────────────────── */
.dd__bag {
  grid-area: bag;
  position: relative;
  overflow: hidden;
}

.dd__bag-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  pointer-events: none;
}

.dd__bag-btn {
  position: absolute;
  top: 30%;           /* % de la hauteur de cellule → vraiment responsive */
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
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

/* ── Centre : profil + boussole ─────────────────────────────────── */
.dd__center {
  grid-area: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  padding-top: 5%;
  gap: 48px;
}

/* ── Parchemin ──────────────────────────────────────────────────── */
.dd__parchemin {
  grid-area: parchemin;
  position: relative;
  margin-top: -1%;
}

.dd__parchemin-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

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

.dd__game-slot {
  flex-shrink: 0;
  width: 82%;
  margin: 0 auto;
  aspect-ratio: 5 / 2;
  border: 1.5px solid #7a3e2a;
  border-radius: 6px;
  background: rgba(245, 237, 223, 0.55);
}

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

/* ── Cardmap (pleine largeur) ───────────────────────────────────── */
.dd__cardmap {
  grid-area: cardmap;
  display: flex;
  justify-content: center;
  align-items: stretch;
}

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
</style>
