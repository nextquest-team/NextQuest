<script setup lang="ts">
defineProps<{
  username: string
}>()

defineEmits<{
  logout: []
}>()

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
    </div>

    <!-- Card map + globe — bas -->
    <div class="dd__cardmap">
      <DashboardDbGameCards />
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
  top: 12%;
  bottom: 9%;
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

/* Carte jeu avec cadre wooly ── */
.dd__game-slot {
  flex-shrink: 0;
  width: 78%;
  margin: 0 auto;
  aspect-ratio: 3 / 2;
  background-image: url('/images/buttons/wooly-btn-final.png');
  background-size: 100% 100%;
  /* TODO: game cover à l'intérieur */
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
