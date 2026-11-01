import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isNsfwCostume, isNsfwPose } from '@/api/gallery'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getCurrentLocale, tr, useI18n } from '@/i18n'
import { localizeCostume, localizePortrait, localizePose } from '@/i18n/galleryData'
import { idbGet, idbSet } from '@/lib/idbStorage'
import { parseParameterWorkflow, workflowIdentity } from '@/lib/comfyWorkflowParameters'
import { recipeBackup } from '@/lib/recipeImages'
import {
  buildRecipePrompt,
  COMFYUI_WORKFLOW_TEMPLATES,
  DEFAULT_COMFY_PRESET,
  generateCharacterImage,
  type GenerationProgress,
  PROVIDER_META,
  stitchRecipeCanvas,
} from '@/services/aiGenerator'
import type {
  ApiConfig,
  ComfyUiParams,
  CostumeItem,
  DoubaoParams,
  ExtraReferenceImage,
  GeminiParams,
  GenerationHistoryItem,
  GptParams,
  ImageProviderId,
  PortraitItem,
  PoseItem,
  ProviderEndpointConfig,
  QwenParams,
  RecipeState,
} from '@/types/gallery'

const CFG_KEY = 'pose_atlas_api_config_v3'
const RECIPE_KEY = 'pose_atlas_recipe_v3'
const HISTORY_KEY = 'pose_atlas_history_v3'
const SAFE_MODE_KEY = 'pose_atlas_safe_mode_v1'

const COMFY_CONFIG_VERSION = 2

const DEFAULT_API_CONFIG: ApiConfig = {
  activeProvider: 'gemini',
  imagePassMode: 'url',
  useProxy: true,
  stylePreset: 'realistic',
  sendStitchedSheet: false,
  providers: {
    gemini: {
      baseUrl: PROVIDER_META.gemini.defaultBaseUrl,
      apiKey: '',
      model: PROVIDER_META.gemini.models[0].value,
      customModel: '',
    },
    gpt: {
      baseUrl: PROVIDER_META.gpt.defaultBaseUrl,
      apiKey: '',
      model: PROVIDER_META.gpt.models[0].value,
      customModel: '',
    },
    qwen: {
      baseUrl: PROVIDER_META.qwen.defaultBaseUrl,
      apiKey: '',
      model: PROVIDER_META.qwen.models[0].value,
      customModel: '',
    },
    doubao: {
      baseUrl: PROVIDER_META.doubao.defaultBaseUrl,
      apiKey: '',
      model: PROVIDER_META.doubao.models[0].value,
      customModel: '',
    },
    comfyui: {
      baseUrl: PROVIDER_META.comfyui.defaultBaseUrl,
      apiKey: '',
      model: PROVIDER_META.comfyui.models[0].value,
      customModel: '',
    },
  },
  gptParams: {
    endpointMode: 'images_edits_json',
    size: '1024x1536',
    quality: 'high',
    inputFidelity: 'high',
    background: 'auto',
    outputFormat: 'png',
    moderation: 'auto',
  },
  geminiParams: {
    endpointMode: 'native',
    aspectRatio: '3:4',
    imageSize: '2K',
  },
  qwenParams: {
    size: '1024*1536',
    promptExtend: true,
    watermark: false,
    negativePrompt: '',
    n: 1,
  },
  doubaoParams: {
    size: '2K',
    sequentialImageGeneration: 'disabled',
    watermark: false,
    responseFormat: 'b64_json',
  },
  comfyuiParams: {
    workflowPreset: DEFAULT_COMFY_PRESET,
    workflowJson: JSON.stringify(COMFYUI_WORKFLOW_TEMPLATES[DEFAULT_COMFY_PRESET].workflow, null, 2),
    ...COMFYUI_WORKFLOW_TEMPLATES[DEFAULT_COMFY_PRESET].defaults,
    randomizeSeed: true,
    timeoutSec: 600,
    configVersion: COMFY_CONFIG_VERSION,
  },
}

// v1 → v2：旧版默认预设或旧版结构自动迁移为默认 FLUX 3 Image Klein 工作流
const LEGACY_COMFY_BASE_URLS = ['http://127.0.0.1:8188', 'http://localhost:8188']

function migrateComfy(
  provider: ApiConfig['providers']['comfyui'],
  params: ApiConfig['comfyuiParams']
): { provider: ApiConfig['providers']['comfyui']; params: ApiConfig['comfyuiParams'] } {
  if ((params.configVersion ?? 1) >= COMFY_CONFIG_VERSION && params.workflowJson) return { provider, params }
  const nextParams = { ...params, configVersion: COMFY_CONFIG_VERSION }
  if (
    !params.workflowPreset ||
    !params.workflowJson ||
    params.workflowPreset === 'qwen21_3img' ||
    params.workflowPreset === 'qwen21_2img'
  ) {
    Object.assign(nextParams, {
      workflowPreset: DEFAULT_COMFY_PRESET,
      workflowJson: JSON.stringify(COMFYUI_WORKFLOW_TEMPLATES[DEFAULT_COMFY_PRESET].workflow, null, 2),
      ...COMFYUI_WORKFLOW_TEMPLATES[DEFAULT_COMFY_PRESET].defaults,
    })
  }
  const nextProvider = { ...provider }
  if (!nextProvider.baseUrl.trim() || LEGACY_COMFY_BASE_URLS.includes(nextProvider.baseUrl.trim())) {
    nextProvider.baseUrl = PROVIDER_META.comfyui.defaultBaseUrl
  }
  if (!PROVIDER_META.comfyui.models.some((m) => m.value === nextProvider.model)) {
    nextProvider.model = PROVIDER_META.comfyui.models[0].value
  }
  return { provider: nextProvider, params: nextParams }
}

function mergeStoredConfig(raw: unknown): ApiConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_API_CONFIG
  const obj = raw as Partial<ApiConfig>
  const comfy = migrateComfy(
    { ...DEFAULT_API_CONFIG.providers.comfyui, ...obj.providers?.comfyui },
    { ...DEFAULT_API_CONFIG.comfyuiParams, configVersion: 1, ...obj.comfyuiParams }
  )
  return {
    ...DEFAULT_API_CONFIG,
    ...obj,
    providers: {
      gemini: { ...DEFAULT_API_CONFIG.providers.gemini, ...obj.providers?.gemini },
      gpt: { ...DEFAULT_API_CONFIG.providers.gpt, ...obj.providers?.gpt },
      qwen: { ...DEFAULT_API_CONFIG.providers.qwen, ...obj.providers?.qwen },
      doubao: { ...DEFAULT_API_CONFIG.providers.doubao, ...obj.providers?.doubao },
      comfyui: comfy.provider,
    },
    gptParams: { ...DEFAULT_API_CONFIG.gptParams, ...obj.gptParams },
    geminiParams: { ...DEFAULT_API_CONFIG.geminiParams, ...obj.geminiParams },
    qwenParams: { ...DEFAULT_API_CONFIG.qwenParams, ...obj.qwenParams },
    doubaoParams: { ...DEFAULT_API_CONFIG.doubaoParams, ...obj.doubaoParams },
    comfyuiParams: comfy.params,
  }
}

interface StudioContextValue {
  recipe: RecipeState
  apiConfig: ApiConfig
  history: GenerationHistoryItem[]
  safeMode: boolean
  toggleSafeMode: () => void
  requestUnlockNsfw: (onUnlocked?: () => void) => void
  // 全局持久化的合成台状态（切换页面不丢失、不断开请求）
  customPrompt: string | null
  setCustomPrompt: (val: string | null) => void
  previewUrl: string
  setPreviewUrl: (url: string) => void
  isGenerating: boolean
  generatingModel: string
  generationProgress: GenerationProgress | null
  generationError: string
  startGeneration: (overridePrompt?: string) => Promise<void>
  refreshStitchPreview: () => Promise<void>
  setPortrait: (item: PortraitItem | null) => void
  setCostume: (item: CostumeItem | null) => void
  setPose: (item: PoseItem | null) => void
  togglePortrait: (item: PortraitItem) => void
  toggleCostume: (item: CostumeItem) => void
  togglePose: (item: PoseItem) => void
  addExtraImage: (item: { name: string; url: string }) => void
  removeExtraImage: (id: string) => void
  updateExtraImageName: (id: string, name: string) => void
  setWorkflowImage: (nodeId: string, image: ExtraReferenceImage | null, identity: string) => void
  clearRecipe: () => void
  randomizeRecipe: (pools: { portraits?: PortraitItem[]; costumes?: CostumeItem[]; poses?: PoseItem[] }) => void
  updateApiConfig: (patch: Partial<ApiConfig>) => void
  updateProviderConfig: (provider: ImageProviderId, patch: Partial<ProviderEndpointConfig>) => void
  updateGptParams: (patch: Partial<GptParams>) => void
  updateGeminiParams: (patch: Partial<GeminiParams>) => void
  updateQwenParams: (patch: Partial<QwenParams>) => void
  updateDoubaoParams: (patch: Partial<DoubaoParams>) => void
  updateComfyUiParams: (patch: Partial<ComfyUiParams>) => void
  addHistory: (item: Omit<GenerationHistoryItem, 'id' | 'createdAt'>) => void
  removeHistoryItem: (id: string) => void
  clearHistory: () => void
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function StudioProvider({ children }: { children: ReactNode }) {
  const { locale, t } = useI18n()
  const [recipe, setRecipe] = useState<RecipeState>(() => {
    try {
      const raw = localStorage.getItem(RECIPE_KEY)
      if (!raw) return { portrait: null, costume: null, pose: null, extraImages: [] }
      const parsed = JSON.parse(raw)
      return {
        portrait: parsed.portrait ?? null,
        costume: parsed.costume ?? null,
        pose: parsed.pose ?? null,
        extraImages: Array.isArray(parsed.extraImages) ? parsed.extraImages : [],
      }
    } catch {
      return { portrait: null, costume: null, pose: null, extraImages: [] }
    }
  })

  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    try {
      const raw = localStorage.getItem(CFG_KEY)
      return raw ? mergeStoredConfig(JSON.parse(raw)) : DEFAULT_API_CONFIG
    } catch {
      return DEFAULT_API_CONFIG
    }
  })

  const [history, setHistory] = useState<GenerationHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const [safeMode, setSafeMode] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(SAFE_MODE_KEY)
      return raw === null ? true : raw !== 'false'
    } catch {
      return true
    }
  })
  const [ageGateOpen, setAgeGateOpen] = useState(false)
  const pendingUnlockCbRef = useRef<(() => void) | null>(null)

  // 提升到根部 Provider 的生成状态，路由切换不会卸载或中断
  const [customPrompt, setCustomPrompt] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      const list = raw ? JSON.parse(raw) : []
      return list[0]?.imageUrl || ''
    } catch {
      return ''
    }
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingModel, setGeneratingModel] = useState('')
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null)
  const [generationError, setGenerationError] = useState('')
  const isGeneratingRef = useRef(false)
  const [idbHydrated, setIdbHydrated] = useState(false)

  // 从 IndexedDB 异步恢复大容量历史记录与含附图的配方
  useEffect(() => {
    let active = true
    Promise.all([
      idbGet<RecipeState>(RECIPE_KEY),
      idbGet<GenerationHistoryItem[]>(HISTORY_KEY),
    ]).then(([savedRecipe, savedHistory]) => {
      if (!active) return
      if (savedRecipe) {
        setRecipe({
          portrait: savedRecipe.portrait ?? null,
          costume: savedRecipe.costume ?? null,
          pose: savedRecipe.pose ?? null,
          workflowImages: savedRecipe.workflowImages ?? {},
          workflowImagesIdentity: savedRecipe.workflowImagesIdentity,
          extraImages: Array.isArray(savedRecipe.extraImages) ? savedRecipe.extraImages : [],
        })
      }
      if (Array.isArray(savedHistory) && savedHistory.length > 0) {
        setHistory(savedHistory)
        setPreviewUrl((prev) => prev || savedHistory[0]?.imageUrl || '')
      }
      setIdbHydrated(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!idbHydrated) return
    void idbSet(RECIPE_KEY, recipe)
    try {
      // 上传图片和附图完整保存在 IndexedDB，轻量备份不包含它们。
      localStorage.setItem(
        RECIPE_KEY,
        JSON.stringify(recipeBackup(recipe))
      )
    } catch {}
  }, [recipe, idbHydrated])

  useEffect(() => {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(apiConfig))
    } catch {}
  }, [apiConfig])

  useEffect(() => {
    try {
      localStorage.setItem(SAFE_MODE_KEY, String(safeMode))
    } catch {}
  }, [safeMode])

  const requestUnlockNsfw = (onUnlocked?: () => void) => {
    if (!safeMode) {
      onUnlocked?.()
      return
    }
    pendingUnlockCbRef.current = onUnlocked || null
    setAgeGateOpen(true)
  }

  const confirmUnlockNsfw = () => {
    setSafeMode(false)
    setAgeGateOpen(false)
    toast.success(tr('已解鎖 18+ 完整圖庫模式', 'Unlocked 18+ full gallery mode'))
    const cb = pendingUnlockCbRef.current
    pendingUnlockCbRef.current = null
    cb?.()
  }

  const toggleSafeMode = () => {
    if (safeMode) {
      requestUnlockNsfw()
    } else {
      setSafeMode(true)
      toast.success(tr('已開啟安全模式（已隱藏 18+ 敏感分類）', 'Safe mode enabled (18+ sensitive categories hidden)'))
    }
  }

  useEffect(() => {
    if (!idbHydrated) return
    void idbSet(HISTORY_KEY, history.slice(0, 30))
  }, [history, idbHydrated])

  const setPortrait = (portrait: PortraitItem | null) => setRecipe((r) => ({ ...r, portrait }))
  const setCostume = (costume: CostumeItem | null) => setRecipe((r) => ({ ...r, costume }))
  const setPose = (pose: PoseItem | null) => setRecipe((r) => ({ ...r, pose }))

  const togglePortrait = (item: PortraitItem) => {
    setRecipe((r) => {
      const remove = r.portrait?.id === item.id
      const loc = localizePortrait(item, getCurrentLocale())
      toast.success(
        remove
          ? tr('已移除人像', 'Removed portrait')
          : tr(`已選人像：${loc.styleName}`, `Selected portrait: ${loc.styleName}`)
      )
      return { ...r, portrait: remove ? null : item }
    })
  }

  const toggleCostume = (item: CostumeItem) => {
    setRecipe((r) => {
      const remove = r.costume?.id === item.id
      const loc = localizeCostume(item, getCurrentLocale())
      toast.success(
        remove
          ? tr('已移除服裝', 'Removed costume')
          : tr(`已選服裝：${loc.name}`, `Selected costume: ${loc.name}`)
      )
      return { ...r, costume: remove ? null : item }
    })
  }

  const togglePose = (item: PoseItem) => {
    setRecipe((r) => {
      const remove = r.pose?.id === item.id
      const loc = localizePose(item, getCurrentLocale())
      toast.success(
        remove
          ? tr('已移除姿勢', 'Removed pose')
          : tr(
              `已選姿勢：${loc.name}${loc.angle ? `（${loc.angle}）` : ''}`,
              `Selected pose: ${loc.name}${loc.angle ? ` (${loc.angle})` : ''}`
            )
      )
      return { ...r, pose: remove ? null : item }
    })
  }

  const addExtraImage = (item: { name: string; url: string }) => {
    const newImg: ExtraReferenceImage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: item.name || tr('附加參考', 'Extra Reference'),
      url: item.url,
    }
    setRecipe((r) => ({
      ...r,
      extraImages: [...(r.extraImages || []), newImg],
    }))
    toast.success(tr('已加入附加參考圖', 'Added extra reference image'))
  }

  const removeExtraImage = (id: string) => {
    setRecipe((r) => ({
      ...r,
      extraImages: (r.extraImages || []).filter((x) => x.id !== id),
    }))
  }

  const updateExtraImageName = (id: string, name: string) => {
    setRecipe((r) => ({
      ...r,
      extraImages: (r.extraImages || []).map((x) => (x.id === id ? { ...x, name } : x)),
    }))
  }

  const setWorkflowImage = (nodeId: string, image: ExtraReferenceImage | null, identity: string) => {
    if (identity !== workflowIdentity(apiConfig.comfyuiParams.workflowJson)) return
    setRecipe((r) => {
      const workflowImages = r.workflowImagesIdentity === identity ? { ...r.workflowImages } : {}
      if (image) workflowImages[nodeId] = image
      else delete workflowImages[nodeId]
      return { ...r, workflowImages, workflowImagesIdentity: identity }
    })
  }

  const activeComfyParams = apiConfig.comfyuiParams
  useEffect(() => {
    if (!idbHydrated) return
    const cp = activeComfyParams
    const identity = workflowIdentity(cp.workflowJson)
    const workflow = parseParameterWorkflow(cp.workflowJson)
    const mapped = [cp.portraitNodeId, cp.costumeNodeId, cp.poseNodeId, cp.stitchedNodeId]
    const ids = new Set(Object.entries(workflow || {}).filter(([id, node]) => !mapped.includes(id) && typeof node.inputs.image === 'string').map(([id]) => id))
    // IndexedDB 恢复与工作流变更同步时清理失效映射。
    // oxlint-disable-next-line react/set-state-in-effect
    setRecipe((r) => {
      const entries = Object.entries(r.workflowImages || {})
      const kept = r.workflowImagesIdentity === identity ? entries.filter(([id]) => ids.has(id)) : []
      if (entries.length === kept.length && r.workflowImagesIdentity === identity) return r
      return { ...r, workflowImages: Object.fromEntries(kept), workflowImagesIdentity: identity }
    })
  }, [activeComfyParams, idbHydrated])

  const clearRecipe = () => {
    setRecipe({ portrait: null, costume: null, pose: null, extraImages: [] })
    toast.success(tr('已清空配方', 'Cleared recipe'))
  }

  const randomizeRecipe = (pools: { portraits?: PortraitItem[]; costumes?: CostumeItem[]; poses?: PoseItem[] }) => {
    const posePool = safeMode ? (pools.poses || []).filter((p) => !isNsfwPose(p)) : pools.poses || []
    const costumePool = safeMode ? (pools.costumes || []).filter((c) => !isNsfwCostume(c)) : pools.costumes || []
    const portraitPool = pools.portraits || []

    setRecipe((prev) => ({
      ...prev,
      portrait: portraitPool.length
        ? portraitPool[Math.floor(Math.random() * portraitPool.length)]
        : prev.portrait,
      costume: costumePool.length
        ? costumePool[Math.floor(Math.random() * costumePool.length)]
        : prev.costume,
      pose: posePool.length ? posePool[Math.floor(Math.random() * posePool.length)] : prev.pose,
    }))
    toast.success(
      safeMode
        ? tr('已隨機抽取一套角色配方（安全模式）', 'Randomized character recipe (Safe Mode)')
        : tr('已隨機抽取一套角色配方', 'Randomized character recipe')
    )
  }

  const updateApiConfig = (patch: Partial<ApiConfig>) => {
    setApiConfig((prev) => ({ ...prev, ...patch }))
  }

  const updateProviderConfig = (provider: ImageProviderId, patch: Partial<ProviderEndpointConfig>) => {
    setApiConfig((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: {
          ...prev.providers[provider],
          ...patch,
        },
      },
    }))
  }

  const updateGptParams = (patch: Partial<GptParams>) => {
    setApiConfig((prev) => ({ ...prev, gptParams: { ...prev.gptParams, ...patch } }))
  }

  const updateGeminiParams = (patch: Partial<GeminiParams>) => {
    setApiConfig((prev) => ({ ...prev, geminiParams: { ...prev.geminiParams, ...patch } }))
  }

  const updateQwenParams = (patch: Partial<QwenParams>) => {
    setApiConfig((prev) => ({ ...prev, qwenParams: { ...prev.qwenParams, ...patch } }))
  }

  const updateDoubaoParams = (patch: Partial<DoubaoParams>) => {
    setApiConfig((prev) => ({ ...prev, doubaoParams: { ...prev.doubaoParams, ...patch } }))
  }

  const updateComfyUiParams = (patch: Partial<ComfyUiParams>) => {
    setApiConfig((prev) => ({ ...prev, comfyuiParams: { ...prev.comfyuiParams, ...patch } }))
  }

  const addHistory = (item: Omit<GenerationHistoryItem, 'id' | 'createdAt'>) => {
    setHistory((prev) => [
      { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() },
      ...prev.slice(0, 29),
    ])
  }

  const removeHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((x) => x.id !== id))
    toast.success(tr('已刪除該條記錄', 'Deleted history item'))
  }

  const clearHistory = () => {
    setHistory([])
    void idbSet(HISTORY_KEY, [])
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {}
    toast.success(tr('已清空記錄', 'Cleared history'))
  }

  const refreshStitchPreview = async () => {
    try {
      const url = await stitchRecipeCanvas(recipe)
      setPreviewUrl(url)
      toast.success(tr('已合成參考拼圖', 'Synthesized reference sheet'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('拼圖失敗', 'Failed to stitch reference sheet'))
    }
  }

  const startGeneration = async (overridePrompt?: string) => {
    if (isGeneratingRef.current) return
    const recipeSnapshot = recipe
    const configSnapshot = apiConfig
    const pCfg = configSnapshot.providers[configSnapshot.activeProvider]
    const modelName = configSnapshot.activeProvider === 'comfyui'
      ? tr('ComfyUI 工作流', 'ComfyUI Workflow')
      : pCfg.model === 'custom' ? pCfg.customModel || 'custom' : pCfg.model
    const finalPrompt =
      overridePrompt ?? customPrompt ?? buildRecipePrompt(recipeSnapshot, configSnapshot.stylePreset, configSnapshot.activeProvider === 'comfyui' && recipeSnapshot.workflowImagesIdentity === workflowIdentity(configSnapshot.comfyuiParams.workflowJson) ? Object.values(recipeSnapshot.workflowImages || {}) : [])

    isGeneratingRef.current = true
    setIsGenerating(true)
    setGeneratingModel(modelName)
    setGenerationError('')
    setGenerationProgress(null)

    try {
      const { imageUrl, modelUsed, providerUsed } = await generateCharacterImage({
        recipe: recipeSnapshot,
        prompt: finalPrompt,
        config: configSnapshot,
        onProgress: setGenerationProgress,
      })
      setPreviewUrl(imageUrl)
      const curLocale = getCurrentLocale()
      const extraCount = (recipeSnapshot.extraImages || []).length
      const pLoc = recipeSnapshot.portrait ? localizePortrait(recipeSnapshot.portrait, curLocale) : null
      const cLoc = recipeSnapshot.costume ? localizeCostume(recipeSnapshot.costume, curLocale) : null
      const poseLoc = recipeSnapshot.pose ? localizePose(recipeSnapshot.pose, curLocale) : null
      const summary = [
        pLoc?.styleName,
        recipeSnapshot.costume?.source === 'upload' ? cLoc?.name : cLoc?.category,
        poseLoc ? `${poseLoc.name}${poseLoc.angle ? `(${poseLoc.angle})` : ''}` : null,
        extraCount ? tr(`+${extraCount}附圖`, `+${extraCount} extra`) : null,
        ...(configSnapshot.activeProvider === 'comfyui' && recipeSnapshot.workflowImagesIdentity === workflowIdentity(configSnapshot.comfyuiParams.workflowJson)
          ? Object.values(recipeSnapshot.workflowImages || {}).filter((image) => image?.url).map((image) => image.role === 'character_sheet' ? tr('角色設定集', 'Character Sheet') : image.name)
          : []),
      ]
        .filter(Boolean)
        .join(' + ')
      addHistory({
        provider: providerUsed,
        model: modelUsed,
        prompt: finalPrompt,
        imageUrl,
        recipeSummary: summary || tr('自訂合成', 'Custom Synthesis'),
      })
      toast.success(tr(`角色圖生成完成 (${modelUsed})`, `Character image generated (${modelUsed})`))
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr('呼叫失敗', 'Request failed')
      setGenerationError(msg)
      toast.error(msg.split('\n')[0])
    } finally {
      isGeneratingRef.current = false
      setIsGenerating(false)
      setGenerationProgress(null)
    }
  }

  return (
    <StudioContext.Provider
      value={{
        recipe,
        apiConfig,
        history,
        safeMode,
        toggleSafeMode,
        requestUnlockNsfw,
        customPrompt,
        setCustomPrompt,
        previewUrl,
        setPreviewUrl,
        isGenerating,
        generatingModel,
        generationProgress,
        generationError,
        startGeneration,
        refreshStitchPreview,
        setPortrait,
        setCostume,
        setPose,
        togglePortrait,
        toggleCostume,
        togglePose,
        addExtraImage,
        removeExtraImage,
        updateExtraImageName,
        setWorkflowImage,
        clearRecipe,
        randomizeRecipe,
        updateApiConfig,
        updateProviderConfig,
        updateGptParams,
        updateGeminiParams,
        updateQwenParams,
        updateDoubaoParams,
        updateComfyUiParams,
        addHistory,
        removeHistoryItem,
        clearHistory,
      }}
    >
      {children}

      <AlertDialog open={ageGateOpen} onOpenChange={setAgeGateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('🔞 年齡確認與免責聲明（NSFW 18+）', '🔞 Age Verification & Disclaimer (NSFW 18+)')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left leading-relaxed">
              {locale === 'en' ? (
                <>
                  <span className="block">
                    Disabling <strong>Safe Mode (SFW)</strong> will display sensitive categories containing adult-oriented artistic references:
                  </span>
                  <span className="block rounded-lg bg-muted p-2.5 text-xs text-foreground">
                    • <strong>Poses Library</strong>: Full Body · Sensual (399), Couple Intimate (275)
                    <br />• <strong>Costumes Library</strong>: Lingerie &amp; Sleepwear (199), Sensual Outfits (140)
                  </span>
                  <span className="block text-xs">
                    <strong>Disclaimer</strong>:
                    <br />1. <strong>Age Restriction</strong>: Minors under 18 are strictly prohibited from disabling Safe Mode or browsing these sensitive categories.
                    <br />2. <strong>Attribution</strong>: Reference assets originate from public shares by ギア (@giaaibusi) and are for personal study only; commercial resale is prohibited.
                    <br />3. <strong>Lawful Use</strong>: This tool and assets are <strong>strictly for AI art study and lawful artistic creation; any illegal use, non-consensual likeness/face swapping, or unlawful distribution is strictly prohibited</strong>, and users assume full legal responsibility.
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    關閉「安全模式 (SFW)」後，圖庫將顯示包含成人向藝術參考的敏感分類：
                  </span>
                  <span className="block rounded-lg bg-muted p-2.5 text-xs text-foreground">
                    • <strong>動作姿勢庫</strong>：全身單人・性感系（399 張）、雙人纏綿（275 張）
                    <br />• <strong>服裝穿搭庫</strong>：內衣・睡衣（199 套）、性感穿搭（140 套）
                  </span>
                  <span className="block text-xs">
                    <strong>免責聲明</strong>：
                    <br />1. <strong>年齡限制</strong>：未滿 18 週歲的未成年人嚴禁關閉安全模式或瀏覽上述敏感分類。
                    <br />2. <strong>來源說明</strong>：圖鑑素材源自原作者 ギア（@giaaibusi）公開分享，僅供個人學習交流，嚴禁商業倒賣。
                    <br />3. <strong>合法使用</strong>：本工具與素材<strong>僅供 AI 繪畫學習與合法藝術創作使用，嚴禁用於任何違法違規、色情傳播或侵害他人肖像權（如未經授權的真人換臉）等用途</strong>，使用者須自行承擔一切法律責任。
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                pendingUnlockCbRef.current = null
              }}
            >
              {t('保持安全模式', 'Keep Safe Mode')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlockNsfw}>
              {t('我已年滿 18 歲並同意免責聲明', 'I am 18+ and agree to the disclaimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StudioContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used within StudioProvider')
  return ctx
}
