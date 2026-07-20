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
  <div class="pd">
    <UiPageHeader to="/dashboard">
      <h1 class="pd__title">{{ t('profil.title') }}</h1>
    </UiPageHeader>

    <ClientOnly>
      <div class="pd__card">

        <!-- Avatar -->
        <div class="pd__avatar-wrap">
          <img
            :src="avatarSrc"
            :alt="displayName"
            class="pd__avatar-img"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
        </div>

        <!-- Nom + username -->
        <h1 class="pd__name">{{ displayName }}</h1>
        <p v-if="user?.displayName" class="pd__username">@{{ user.username }}</p>

        <!-- Badges -->
        <div class="pd__badges">
          <span class="pd__badge" :class="user?.emailVerified ? 'pd__badge--ok' : 'pd__badge--warn'">
            <v-icon size="14">{{ user?.emailVerified ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
            {{ user?.emailVerified ? t('profil.emailVerified') : t('profil.emailNotVerified') }}
          </span>
          <span class="pd__badge" :class="user?.onboardingCompleted ? 'pd__badge--ok' : 'pd__badge--warn'">
            <v-icon size="14">{{ user?.onboardingCompleted ? 'mdi-shield-check' : 'mdi-shield-alert' }}</v-icon>
            {{ user?.onboardingCompleted ? t('profil.onboarding.completed') : t('profil.onboarding.pending') }}
          </span>
        </div>

        <hr class="pd__divider" />

        <!-- Informations -->
        <ul class="pd__info-list">
          <li class="pd__info-row">
            <v-icon size="18" class="pd__info-icon">mdi-email-outline</v-icon>
            <span>{{ user?.email }}</span>
          </li>
          <li class="pd__info-row pd__info-row--visibility">
            <v-icon size="18" class="pd__info-icon">mdi-eye-outline</v-icon>
            <template v-if="!isEditingVisibility">
              <span>{{ t('profil.visibility.label') }} : {{ t(visibilityKey) }}</span>
              <button class="pd__edit-btn" :aria-label="t('profil.visibility.edit')" @click="isEditingVisibility = true">
                <v-icon size="16">mdi-pencil-outline</v-icon>
              </button>
            </template>
            <template v-else>
              <div class="pd__visibility-picker">
                <button
                  v-for="opt in VISIBILITY_OPTIONS"
                  :key="opt"
                  class="pd__visibility-opt"
                  :class="{ 'pd__visibility-opt--active': user?.visibility === opt }"
                  :disabled="isSavingVisibility"
                  @click="saveVisibility(opt)"
                >
                  {{ t(`profil.visibility.${opt}`) }}
                </button>
                <button class="pd__edit-btn" :aria-label="t('profil.cancel')" @click="isEditingVisibility = false">
                  <v-icon size="16">mdi-close</v-icon>
                </button>
              </div>
              <p v-if="visibilityError" class="pd__error">{{ visibilityError }}</p>
            </template>
          </li>
          <li class="pd__info-row">
            <v-icon size="18" class="pd__info-icon">mdi-calendar-outline</v-icon>
            <span>{{ t('profil.memberSince') }} {{ memberSince }}</span>
          </li>
        </ul>

        <hr class="pd__divider" />

        <!-- Bio -->
        <div class="pd__section">
          <div class="pd__section-header">
            <p class="pd__section-label">{{ t('profil.bio') }}</p>
            <button v-if="!isEditingBio" class="pd__edit-btn" :aria-label="t('profil.editBio')" @click="startEditBio">
              <v-icon size="16">mdi-pencil-outline</v-icon>
            </button>
          </div>

          <template v-if="isEditingBio">
            <textarea
              v-model="bioInput"
              class="pd__bio-textarea"
              :maxlength="BIO_MAX"
              :placeholder="t('profil.noBio')"
              rows="4"
              autofocus
            />
            <div class="pd__bio-footer">
              <span class="pd__bio-count" :class="{ 'pd__bio-count--warn': bioInput.length >= BIO_MAX }">
                {{ bioInput.length }}/{{ BIO_MAX }}
              </span>
              <div class="pd__bio-actions">
                <button class="pd__action-btn pd__action-btn--cancel" @click="cancelEditBio">
                  {{ t('profil.cancel') }}
                </button>
                <button
                  class="pd__action-btn pd__action-btn--save"
                  :disabled="isSavingBio || bioInput.length > BIO_MAX"
                  @click="saveBio"
                >
                  {{ isSavingBio ? '…' : t('profil.save') }}
                </button>
              </div>
            </div>
            <p v-if="bioError" class="pd__error">{{ bioError }}</p>
          </template>

          <p v-else class="pd__bio">{{ user?.bio ?? t('profil.noBio') }}</p>
        </div>

        <!-- Déconnexion -->
        <button class="pd__logout" :disabled="isLoggingOut" @click="handleLogout">
          <v-icon size="18">mdi-logout</v-icon>
          {{ t('auth.logout') }}
        </button>

      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.pd {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 2rem 3rem;
  font-family: var(--nq-font);
}

.pd__title {
  font-family: var(--nq-font);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.pd__card {
  width: 100%;
  max-width: 520px;
  background: var(--nq-cream);
  border-radius: 16px;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 16px rgba(var(--nq-brown-dark-rgb), 0.10);
}

/* Avatar */
.pd__avatar-wrap {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: var(--nq-brown);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.pd__avatar-img { width: 100%; height: 100%; object-fit: cover; }

.pd__name { font-size: 1.4rem; font-weight: bold; color: var(--nq-brown-dark); text-align: center; margin: 0; }
.pd__username { font-size: 0.9rem; color: var(--nq-brown); margin: -0.5rem 0 0; }

/* Badges */
.pd__badges { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }

.pd__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 999px;
}

.pd__badge--ok { background: var(--nq-success-bg); color: var(--nq-success-text); }
.pd__badge--warn { background: var(--nq-warning-bg); color: var(--nq-warning-text); }

.pd__divider { width: 100%; border: none; border-top: 1px solid rgba(var(--nq-brown-rgb), 0.15); margin: 0.25rem 0; }

/* Infos */
.pd__info-list { list-style: none; padding: 0; margin: 0; width: 100%; display: flex; flex-direction: column; gap: 0.6rem; }

.pd__info-row { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: var(--nq-brown-dark); }
.pd__info-icon { color: var(--nq-brown); flex-shrink: 0; }
.pd__info-row--visibility { flex-wrap: wrap; gap: 8px; }

.pd__visibility-picker { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }

.pd__visibility-opt {
  padding: 4px 12px;
  border-radius: 999px;
  font-family: var(--nq-font);
  font-size: 0.8rem;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.3);
  background: transparent;
  color: var(--nq-brown-dark);
  cursor: pointer;
  min-height: 32px;
  transition: background 0.1s;
}

.pd__visibility-opt:hover:not(:disabled) { background: rgba(var(--nq-brown-rgb), 0.08); }
.pd__visibility-opt--active { background: var(--nq-brown); color: #edc78e; border-color: var(--nq-brown); }
.pd__visibility-opt:disabled { opacity: 0.5; cursor: not-allowed; }

.pd__edit-btn { background: none; border: none; cursor: pointer; color: var(--nq-brown); padding: 2px; display: inline-flex; opacity: 0.7; }
.pd__edit-btn:hover { opacity: 1; }

/* Bio */
.pd__section { width: 100%; }
.pd__section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.pd__section-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--nq-brown); margin: 0; }
.pd__bio { font-size: 0.9rem; color: var(--nq-brown-dark); line-height: 1.5; margin: 0; font-style: italic; opacity: 0.8; }

.pd__bio-textarea {
  width: 100%;
  background: var(--nq-beige);
  border: 1px solid rgba(var(--nq-brown-rgb), 0.3);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: var(--nq-brown-dark);
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.pd__bio-textarea:focus { outline: none; border-color: var(--nq-brown); }
.pd__bio-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.pd__bio-count { font-size: 0.75rem; color: var(--nq-brown); opacity: 0.7; }
.pd__bio-count--warn { color: var(--nq-red); opacity: 1; font-weight: bold; }
.pd__bio-actions { display: flex; gap: 8px; }

.pd__action-btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  cursor: pointer;
  border: none;
  min-height: 36px;
}

.pd__action-btn--cancel { background: transparent; color: var(--nq-brown); border: 1px solid rgba(var(--nq-brown-rgb), 0.3); }
.pd__action-btn--cancel:hover { background: rgba(var(--nq-brown-rgb), 0.08); }
.pd__action-btn--save { background: var(--nq-brown); color: #edc78e; }
.pd__action-btn--save:hover:not(:disabled) { background: var(--nq-brown-dark); }
.pd__action-btn--save:disabled { opacity: 0.5; cursor: not-allowed; }

.pd__error { font-size: 0.8rem; color: var(--nq-red); margin: 4px 0 0; }

/* Déconnexion */
.pd__logout {
  margin-top: 0.5rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--nq-brown);
  color: var(--nq-cream-light);
  border: none;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 1rem;
  cursor: pointer;
  min-height: 48px;
  transition: background 0.15s;
}

.pd__logout:hover:not(:disabled) { background: var(--nq-brown-dark); }
.pd__logout:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
