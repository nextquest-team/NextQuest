<template>
  <NavbarDesktop class="nq-sidebar" />
  <NavbarMobile class="nq-bottom-nav" />
  <main class="nq-main">
    <slot />
  </main>
</template>

<style>
.nq-sidebar { display: none !important; }

.nq-main {
  padding-bottom: 64px;
}

@media (min-width: 960px) {
  .nq-bottom-nav { display: none !important; }
  .nq-sidebar { display: flex !important; }
  .nq-main {
    padding-bottom: 0;
    padding-left: 200px;
  }
}
</style>
