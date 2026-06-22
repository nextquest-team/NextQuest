<script setup lang="ts">
import { BIO_MAX, VISIBILITY_OPTIONS } from '~/composables/useProfil'

const { t } = useI18n()

const {
  user,
  isLoggingOut,
  isEditingBio, bioInput, isSavingBio, bioError,
  isEditingVisibility, isSavingVisibility, visibilityError,
  avatarSrc, displayName, memberSince, visibilityKey,
  startEditBio, cancelEditBio, saveBio,
  saveVisibility,
  handleLogout,
  init,
} = useProfil()

onMounted(init)
</script>

<template>
  <div class="pm">

    <!-- ── Header fixe ── -->
    <div class="pm__head">
      <UiPageHeader to="/dashboard">
        <h1 class="pm__title">{{ t('profil.title') }}</h1>
      </UiPageHeader>
    </div>

    <!-- ── Zone scrollable ── -->
    <div class="pm__body">
      <ClientOnly>
        <div class="pm__card">

          <!-- Avatar -->
          <div class="pm__avatar-wrap">
            <img
              :src="avatarSrc"
              :alt="displayName"
              class="pm__avatar-img"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
          </div>

          <!-- Nom + username -->
          <h2 class="pm__name">{{ displayName }}</h2>
          <p v-if="user?.displayName" class="pm__username">@{{ user.username }}</p>

          <!-- Badges -->
          <div class="pm__badges">
            <span class="pm__badge" :class="user?.emailVerified ? 'pm__badge--ok' : 'pm__badge--warn'">
              <v-icon size="13">{{ user?.emailVerified ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
              {{ user?.emailVerified ? t('profil.emailVerified') : t('profil.emailNotVerified') }}
            </span>
            <span class="pm__badge" :class="user?.onboardingCompleted ? 'pm__badge--ok' : 'pm__badge--warn'">
              <v-icon size="13">{{ user?.onboardingCompleted ? 'mdi-shield-check' : 'mdi-shield-alert' }}</v-icon>
              {{ user?.onboardingCompleted ? t('profil.onboarding.completed') : t('profil.onboarding.pending') }}
            </span>
          </div>

          <hr class="pm__divider" />

          <!-- Informations -->
          <ul class="pm__info-list">
            <li class="pm__info-row">
              <v-icon size="16" class="pm__info-icon">mdi-email-outline</v-icon>
              <span>{{ user?.email }}</span>
            </li>
            <li class="pm__info-row pm__info-row--visibility">
              <v-icon size="16" class="pm__info-icon">mdi-eye-outline</v-icon>
              <template v-if="!isEditingVisibility">
                <span>{{ t('profil.visibility.label') }} : {{ t(visibilityKey) }}</span>
                <button class="pm__edit-btn" :aria-label="t('profil.visibility.edit')" @click="isEditingVisibility = true">
                  <v-icon size="15">mdi-pencil-outline</v-icon>
                </button>
              </template>
              <template v-else>
                <div class="pm__visibility-picker">
                  <button
                    v-for="opt in VISIBILITY_OPTIONS"
                    :key="opt"
                    class="pm__visibility-opt"
                    :class="{ 'pm__visibility-opt--active': user?.visibility === opt }"
                    :disabled="isSavingVisibility"
                    @click="saveVisibility(opt)"
                  >
                    {{ t(`profil.visibility.${opt}`) }}
                  </button>
                  <button class="pm__edit-btn" :aria-label="t('profil.cancel')" @click="isEditingVisibility = false">
                    <v-icon size="15">mdi-close</v-icon>
                  </button>
                </div>
                <p v-if="visibilityError" class="pm__error">{{ visibilityError }}</p>
              </template>
            </li>
            <li class="pm__info-row">
              <v-icon size="16" class="pm__info-icon">mdi-calendar-outline</v-icon>
              <span>{{ t('profil.memberSince') }} {{ memberSince }}</span>
            </li>
          </ul>

          <hr class="pm__divider" />

          <!-- Bio -->
          <div class="pm__section">
            <div class="pm__section-header">
              <p class="pm__section-label">{{ t('profil.bio') }}</p>
              <button v-if="!isEditingBio" class="pm__edit-btn" :aria-label="t('profil.editBio')" @click="startEditBio">
                <v-icon size="15">mdi-pencil-outline</v-icon>
              </button>
            </div>

            <template v-if="isEditingBio">
              <textarea
                v-model="bioInput"
                class="pm__bio-textarea"
                :maxlength="BIO_MAX"
                :placeholder="t('profil.noBio')"
                rows="4"
                autofocus
              />
              <div class="pm__bio-footer">
                <span class="pm__bio-count" :class="{ 'pm__bio-count--warn': bioInput.length >= BIO_MAX }">
                  {{ bioInput.length }}/{{ BIO_MAX }}
                </span>
                <div class="pm__bio-actions">
                  <button class="pm__action-btn pm__action-btn--cancel" @click="cancelEditBio">
                    {{ t('profil.cancel') }}
                  </button>
                  <button
                    class="pm__action-btn pm__action-btn--save"
                    :disabled="isSavingBio || bioInput.length > BIO_MAX"
                    @click="saveBio"
                  >
                    {{ isSavingBio ? '…' : t('profil.save') }}
                  </button>
                </div>
              </div>
              <p v-if="bioError" class="pm__error">{{ bioError }}</p>
            </template>

            <p v-else class="pm__bio">{{ user?.bio ?? t('profil.noBio') }}</p>
          </div>

          <!-- Déconnexion -->
          <button class="pm__logout" :disabled="isLoggingOut" @click="handleLogout">
            <v-icon size="18">mdi-logout</v-icon>
            {{ t('auth.logout') }}
          </button>

        </div>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
/* ── Conteneur mobile : header fixe + corps scrollable ── */
.pm {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px); /* 64px = bottom nav */
  overflow: hidden;
  font-family: var(--nq-font);
}

.pm__head {
  flex-shrink: 0;
  padding: 0 1rem;
}

.pm__title {
  font-family: var(--nq-font);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.pm__body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0.5rem 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Card ── */
.pm__card {
  width: 100%;
  max-width: 480px;
  background: var(--nq-cream);
  border-radius: 14px;
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  box-shadow: 0 2px 12px rgba(58, 26, 10, 0.10);
}

/* Avatar */
.pm__avatar-wrap {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--nq-brown);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.pm__avatar-img { width: 100%; height: 100%; object-fit: cover; }

.pm__name { font-size: 1.25rem; font-weight: bold; color: var(--nq-brown-dark); text-align: center; margin: 0; }
.pm__username { font-size: 0.85rem; color: var(--nq-brown); margin: -0.35rem 0 0; }

/* Badges */
.pm__badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }

.pm__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  padding: 3px 9px;
  border-radius: 999px;
}

.pm__badge--ok { background: #d4edda; color: #1a5c2a; }
.pm__badge--warn { background: #fdebc8; color: #7a4a00; }

.pm__divider { width: 100%; border: none; border-top: 1px solid rgba(92, 51, 23, 0.15); margin: 0.1rem 0; }

/* Infos */
.pm__info-list { list-style: none; padding: 0; margin: 0; width: 100%; display: flex; flex-direction: column; gap: 0.55rem; }

.pm__info-row {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 0.85rem;
  color: var(--nq-brown-dark);
}

.pm__info-icon { color: var(--nq-brown); flex-shrink: 0; }

.pm__info-row--visibility { flex-wrap: wrap; gap: 6px; }

.pm__visibility-picker { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }

.pm__visibility-opt {
  padding: 3px 10px;
  border-radius: 999px;
  font-family: var(--nq-font);
  font-size: 0.75rem;
  border: 1px solid rgba(92, 51, 23, 0.3);
  background: transparent;
  color: var(--nq-brown-dark);
  cursor: pointer;
  min-height: 30px;
  transition: background 0.1s;
}

.pm__visibility-opt:hover:not(:disabled) { background: rgba(92, 51, 23, 0.08); }
.pm__visibility-opt--active { background: var(--nq-brown); color: #edc78e; border-color: var(--nq-brown); }
.pm__visibility-opt:disabled { opacity: 0.5; cursor: not-allowed; }

.pm__edit-btn { background: none; border: none; cursor: pointer; color: var(--nq-brown); padding: 2px; display: inline-flex; opacity: 0.7; }
.pm__edit-btn:hover { opacity: 1; }

/* Bio */
.pm__section { width: 100%; }

.pm__section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem; }

.pm__section-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--nq-brown); margin: 0; }

.pm__bio { font-size: 0.85rem; color: var(--nq-brown-dark); line-height: 1.5; margin: 0; font-style: italic; opacity: 0.8; }

.pm__bio-textarea {
  width: 100%;
  background: var(--nq-beige);
  border: 1px solid rgba(92, 51, 23, 0.3);
  border-radius: 8px;
  padding: 9px 11px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  color: var(--nq-brown-dark);
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.pm__bio-textarea:focus { outline: none; border-color: var(--nq-brown); }

.pm__bio-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; }

.pm__bio-count { font-size: 0.7rem; color: var(--nq-brown); opacity: 0.7; }
.pm__bio-count--warn { color: var(--nq-red); opacity: 1; font-weight: bold; }

.pm__bio-actions { display: flex; gap: 7px; }

.pm__action-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-family: var(--nq-font);
  font-size: 0.82rem;
  cursor: pointer;
  border: none;
  min-height: 34px;
}

.pm__action-btn--cancel { background: transparent; color: var(--nq-brown); border: 1px solid rgba(92, 51, 23, 0.3); }
.pm__action-btn--cancel:hover { background: rgba(92, 51, 23, 0.08); }
.pm__action-btn--save { background: var(--nq-brown); color: #edc78e; }
.pm__action-btn--save:hover:not(:disabled) { background: var(--nq-brown-dark); }
.pm__action-btn--save:disabled { opacity: 0.5; cursor: not-allowed; }

.pm__error { font-size: 0.78rem; color: var(--nq-red); margin: 4px 0 0; }

/* Déconnexion */
.pm__logout {
  margin-top: 0.25rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 20px;
  background: var(--nq-brown);
  color: #edc78e;
  border: none;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 46px;
  transition: background 0.15s;
}

.pm__logout:hover:not(:disabled) { background: var(--nq-brown-dark); }
.pm__logout:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
