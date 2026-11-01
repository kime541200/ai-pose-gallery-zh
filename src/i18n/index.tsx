import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { CostumeItem, PortraitItem, PoseGroup, PoseItem } from '@/types/gallery'
import {
  type Locale,
  localizeCostume,
  localizeCostumeCategory,
  localizeCostumeName,
  localizeCostumeTag,
  localizePortrait,
  localizePortraitHair,
  localizePortraitSection,
  localizePortraitStyle,
  localizePose,
  localizePoseAngle,
  localizePoseCategory,
  localizePoseGroup,
  localizePoseName,
  localizePoseSystem,
} from './galleryData'

export type { Locale } from './galleryData'

const LOCALE_STORAGE_KEY = 'pose_atlas_locale_v1'

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-TW'
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved === 'zh-TW' || saved === 'en') return saved
  } catch {}
  const nav = typeof navigator !== 'undefined' ? (navigator.language || '').toLowerCase() : ''
  if (nav.startsWith('en')) return 'en'
  return 'zh-TW'
}

let currentLocaleState: Locale = detectInitialLocale()

// oxlint-disable-next-line react/only-export-components
export function getCurrentLocale(): Locale {
  return currentLocaleState
}

// oxlint-disable-next-line react/only-export-components
export function tr(zhTW: string, en: string, locale: Locale = currentLocaleState): string {
  return locale === 'en' ? en : zhTW
}

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  t: (zhTW: string, en: string) => string
  pose: (item: PoseItem) => ReturnType<typeof localizePose>
  poseGroup: (group: PoseGroup) => ReturnType<typeof localizePoseGroup>
  poseSystem: (val: string) => string
  poseCategory: (val: string) => string
  poseAngle: (val: string) => string
  poseName: (val: string) => string
  costume: (item: CostumeItem) => ReturnType<typeof localizeCostume>
  costumeCategory: (val: string) => string
  costumeTag: (val: string) => string
  costumeName: (val: string) => string
  portrait: (item: PortraitItem) => ReturnType<typeof localizePortrait>
  portraitSection: (val: string) => string
  portraitHair: (val: string) => string
  portraitStyle: (val: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = detectInitialLocale()
    currentLocaleState = initial
    return initial
  })

  const setLocale = (next: Locale) => {
    currentLocaleState = next
    setLocaleState(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {}
  }

  useEffect(() => {
    currentLocaleState = locale
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'en' ? 'en' : 'zh-Hant'
      document.title =
        locale === 'en'
          ? 'AI Pose & Character Studio | Pose · Costume · Portrait Reference Gallery'
          : 'AI 角色參考圖庫與合成台｜姿勢・服裝・人像三合一工作台'
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW'),
      t: (zhTW: string, en: string) => (locale === 'en' ? en : zhTW),
      pose: (item: PoseItem) => localizePose(item, locale),
      poseGroup: (group: PoseGroup) => localizePoseGroup(group, locale),
      poseSystem: (val: string) => localizePoseSystem(val, locale),
      poseCategory: (val: string) => localizePoseCategory(val, locale),
      poseAngle: (val: string) => localizePoseAngle(val, locale),
      poseName: (val: string) => localizePoseName(val, locale),
      costume: (item: CostumeItem) => localizeCostume(item, locale),
      costumeCategory: (val: string) => localizeCostumeCategory(val, locale),
      costumeTag: (val: string) => localizeCostumeTag(val, locale),
      costumeName: (val: string) => localizeCostumeName(val, locale),
      portrait: (item: PortraitItem) => localizePortrait(item, locale),
      portraitSection: (val: string) => localizePortraitSection(val, locale),
      portraitHair: (val: string) => localizePortraitHair(val, locale),
      portraitStyle: (val: string) => localizePortraitStyle(val, locale),
    }),
    [locale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
