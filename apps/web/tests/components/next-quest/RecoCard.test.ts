// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import RecoCard from '~/components/next-quest/RecoCard.vue'
import type { RecommendationDTO } from '~/types/recommendations'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

mockNuxtImport('useState', () => (key: string, init?: () => unknown) => {
  const { ref } = require('vue')
  return ref(init?.() ?? null)
})

mockNuxtImport('navigateTo', () => vi.fn())

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
}

const fakeReco: RecommendationDTO = {
  id: 'reco-1',
  reason: { text: 'Bonne raison' },
  game: {
    id: 'game-1',
    title: 'Hollow Knight',
    coverUrl: 'https://cdn.igdb.com/cover.jpg',
    genres: [{ id: 1, name: 'Metroidvania' }],
    igdbRating: 90,
    releaseDate: '2017-02-24T00:00:00.000Z',
    platforms: [],
  },
} as unknown as RecommendationDTO

describe('RecoCard', () => {
  describe('slot vide (reco=null)', () => {
    it('affiche le slot vide si reco est null', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: null, bucket: 'discovery', feedbackPending: false },
        global: { stubs },
      })
      expect(wrapper.find('.nq-slot-empty').exists()).toBe(true)
      expect(wrapper.find('.nq-quest-card').exists()).toBe(false)
    })
  })

  describe('layout compacte', () => {
    it('utilise le layout compact pour library_unplayed', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'library_unplayed', feedbackPending: false },
        global: { stubs },
      })
      expect(wrapper.find('.nq-card-body').exists()).toBe(true)
      expect(wrapper.find('.nq-hero-col').exists()).toBe(false)
    })

    it('utilise le layout compact pour upcoming', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'upcoming', feedbackPending: false },
        global: { stubs },
      })
      expect(wrapper.find('.nq-card-body').exists()).toBe(true)
    })

    it('utilise le layout compact pour discovery quand compact=true', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'discovery', feedbackPending: false, compact: true },
        global: { stubs },
      })
      expect(wrapper.find('.nq-card-body').exists()).toBe(true)
      expect(wrapper.find('.nq-hero-col').exists()).toBe(false)
    })
  })

  describe('layout hero', () => {
    it('utilise le layout hero pour discovery sans compact', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'discovery', feedbackPending: false },
        global: { stubs },
      })
      expect(wrapper.find('.nq-hero-col').exists()).toBe(true)
      expect(wrapper.find('.nq-card-body').exists()).toBe(false)
    })

    it('affiche le titre du jeu dans le hero', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'discovery', feedbackPending: false },
        global: { stubs },
      })
      expect(wrapper.find('.nq-card-title--hero').text()).toBe('Hollow Knight')
    })
  })

  describe('badge bucket', () => {
    it('affiche le badge discovery', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'discovery', feedbackPending: false },
        global: { stubs },
      })
      expect(wrapper.find('.nq-card-badge--discovery').exists()).toBe(true)
    })

    it('affiche le badge library', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'library_unplayed', feedbackPending: false },
        global: { stubs },
      })
      expect(wrapper.find('.nq-card-badge--library').exists()).toBe(true)
    })

    it('affiche le badge upcoming', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'upcoming', feedbackPending: false },
        global: { stubs },
      })
      expect(wrapper.find('.nq-card-badge--upcoming').exists()).toBe(true)
    })
  })

  describe('feedback', () => {
    it('émet feedback(reco, action) au clic sur le bouton CTA', async () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'discovery', feedbackPending: false },
        global: { stubs },
      })
      await wrapper.find('.nq-quest-cta').trigger('click')
      const emitted = wrapper.emitted('feedback')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toEqual(fakeReco)
      expect(emitted![0][1]).toBe('added')
    })

    it('émet feedback(reco, dismissed) au clic sur Ignorer', async () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'discovery', feedbackPending: false },
        global: { stubs },
      })
      await wrapper.find('.nq-quest-dismiss').trigger('click')
      const emitted = wrapper.emitted('feedback')
      expect(emitted).toBeTruthy()
      expect(emitted![0][1]).toBe('dismissed')
    })

    it('désactive les boutons si feedbackPending=true', () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'discovery', feedbackPending: true },
        global: { stubs },
      })
      expect(wrapper.find('.nq-quest-cta').attributes('disabled')).toBeDefined()
      expect(wrapper.find('.nq-quest-dismiss').attributes('disabled')).toBeDefined()
    })

    it('library_unplayed émet liked', async () => {
      const wrapper = mount(RecoCard, {
        props: { reco: fakeReco, bucket: 'library_unplayed', feedbackPending: false },
        global: { stubs },
      })
      await wrapper.find('.nq-quest-cta').trigger('click')
      expect(wrapper.emitted('feedback')![0][1]).toBe('liked')
    })
  })
})
