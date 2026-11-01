import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ChevronUpIcon,
  CodeXmlIcon,
  CopyIcon,
  DicesIcon,
  DownloadIcon,
  FileUpIcon,
  ImagePlusIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  LinkIcon,
  LoaderCircleIcon,
  PersonStandingIcon,
  ScanSearchIcon,
  RotateCcwIcon,
  ShirtIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Trash2Icon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react'
import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { costumesQuery, portraitsQuery, posesQuery } from '@/api/gallery'
import { Field, Section } from '@/components/common/FormSection'
import { WorkflowParameters } from '@/components/studio/WorkflowParameters'
import { applyWorkflowOverrides, validateReferenceCombinations, workflowIdentity } from '@/lib/comfyWorkflowParameters'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n'
import { localizeCostume, localizePortrait, localizePose } from '@/i18n/galleryData'
import {
  autoDetectComfyMappings,
  buildRecipePrompt,
  type ComfyCheckResult,
  type ComfyPresetId,
  checkComfyWorkflow,
  COMFYUI_WORKFLOW_TEMPLATES,
  detectComfyUi,
  fileToDataUrl,
  fetchComfyObjectInfo,
  getProviderMeta,
  parseComfyWorkflowNodes,
  stitchRecipeCanvas,
  STYLE_PRESETS,
} from '@/services/aiGenerator'
import { referenceImageUrl, uploadedReferences } from '@/lib/recipeImages'
import { useStudio } from '@/store/studioStore'
import type {
  ComfyUiParams,
  DoubaoParams,
  GeminiParams,
  GptParams,
  ImagePassMode,
  ImageProviderId,
  QwenParams,
} from '@/types/gallery'

export const Route = createFileRoute('/studio')({
  staticData: { title: 'AI 合成台', titleEn: 'AI Studio' },
  component: StudioPage,
})

const PROVIDER_LIST: ImageProviderId[] = ['gemini', 'gpt', 'qwen', 'doubao', 'comfyui']

function StudioPage() {
  const { locale, t } = useI18n()
  const {
    recipe,
    apiConfig,
    history,
    customPrompt,
    setCustomPrompt,
    previewUrl,
    setPreviewUrl,
    isGenerating,
    generatingModel,
    generationProgress,
    generationError,
    startGeneration,
    setPortrait,
    setCostume,
    setPose,
    addExtraImage,
    removeExtraImage,
    updateExtraImageName,
    updateApiConfig,
    updateProviderConfig,
    updateGptParams,
    updateGeminiParams,
    updateQwenParams,
    updateDoubaoParams,
    updateComfyUiParams,
    randomizeRecipe,
    removeHistoryItem,
    clearHistory,
  } = useStudio()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const comfyFileInputRef = useRef<HTMLInputElement | null>(null)
  const slotInputRef = useRef<HTMLInputElement | null>(null)
  const uploadSlotRef = useRef<'portrait' | 'costume' | 'pose'>('portrait')
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [showReferenceErrors, setShowReferenceErrors] = useState(false)
  const referenceErrorsRef = useRef<HTMLDivElement | null>(null)

  const activeProvider = apiConfig.activeProvider
  const providerMeta = getProviderMeta(activeProvider, locale)
  const providerCfg = apiConfig.providers[activeProvider]

  const activeWorkflowImages = activeProvider === 'comfyui' && recipe.workflowImagesIdentity === workflowIdentity(apiConfig.comfyuiParams.workflowJson) ? Object.values(recipe.workflowImages || {}) : []
  const defaultPrompt = buildRecipePrompt(recipe, apiConfig.stylePreset, activeWorkflowImages, locale)
  const prompt = customPrompt ?? defaultPrompt
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [extraUrlInput, setExtraUrlInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [stitchModalUrl, setStitchModalUrl] = useState<string | null>(null)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
  const [showComfyJsonModal, setShowComfyJsonModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [comfyCheck, setComfyCheck] = useState<(ComfyCheckResult & { info?: string }) | null>(null)
  const [checkingComfy, setCheckingComfy] = useState(false)

  const parsedComfyNodes = useMemo(
    () => parseComfyWorkflowNodes(apiConfig.comfyuiParams.workflowJson),
    [apiConfig.comfyuiParams.workflowJson]
  )

  const handleSelectComfyPreset = (preset: ComfyUiParams['workflowPreset']) => {
    setComfyCheck(null)
    if (preset === 'custom') {
      updateComfyUiParams({ workflowPreset: 'custom' })
      return
    }
    const tpl = COMFYUI_WORKFLOW_TEMPLATES[preset]
    updateComfyUiParams({
      workflowPreset: preset,
      workflowJson: JSON.stringify(tpl.workflow, null, 2),
      ...tpl.defaults,
    })
    toast.success(t(`已切換為：${tpl.label}`, `Switched to: ${tpl.labelEn}`))
  }

  // 自动识别 ComfyUI 地址 + 检测工作流所需节点/模型是否在本机存在
  const handleCheckComfy = async () => {
    setCheckingComfy(true)
    setComfyCheck(null)
    try {
      const cfg = apiConfig.providers.comfyui
      const found = await detectComfyUi(cfg.baseUrl, cfg.apiKey)
      if (!found) {
        setComfyCheck({
          ok: false,
          errors: [
            t(
              `未找到可用的 ComfyUI 服務（已嘗試：${cfg.baseUrl || '預設位址'}、127.0.0.1:8000、127.0.0.1:8188）。請確認 ComfyUI 已啟動，並檢查跨域 (CORS) 設定。`,
              `No reachable ComfyUI service found (tried: ${cfg.baseUrl || 'default URL'}, 127.0.0.1:8000, 127.0.0.1:8188). Please make sure ComfyUI is running and check CORS settings.`
            ),
          ],
          warnings: [],
          fixes: [],
        })
        return
      }
      if (found.baseUrl !== cfg.baseUrl.trim().replace(/\/+$/, '')) {
        updateProviderConfig('comfyui', { baseUrl: found.baseUrl })
        toast.success(t(`已自動識別 ComfyUI 位址：${found.baseUrl}`, `Auto-detected ComfyUI URL: ${found.baseUrl}`))
      }
      const cp = apiConfig.comfyuiParams
      const result = await checkComfyWorkflow(found.baseUrl, cfg.apiKey, cp.workflowJson, [
        cp.portraitNodeId,
        cp.costumeNodeId,
        cp.poseNodeId,
        cp.stitchedNodeId,
      ])
      // 自动修复仅用于提交副本，保留导入的原始 API。
      setComfyCheck({ ...result, info: `${found.info} (${found.baseUrl})` })
    } catch (e) {
      setComfyCheck({ ok: false, errors: [e instanceof Error ? e.message : t('檢測失敗', 'Check failed')], warnings: [], fixes: [] })
    } finally {
      setCheckingComfy(false)
    }
  }

  const handleComfyFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const info = parseComfyWorkflowNodes(text)
      if (!info.valid) {
        toast.error(info.error || t('工作流 JSON 無效', 'Invalid workflow JSON'))
        return
      }
      const detected = autoDetectComfyMappings(text)
      setComfyCheck(null)
      updateComfyUiParams({
        workflowPreset: 'custom',
        workflowJson: text,
        ...detected,
      })
      setShowAdvanced(true)
      toast.success(
        t(
          `已匯入工作流：識別到 ${info.imageNodes.length} 個圖片節點、${info.promptNodes.length} 個提示詞節點`,
          `Imported workflow: detected ${info.imageNodes.length} image node(s) and ${info.promptNodes.length} prompt node(s)`
        )
      )
    } catch {
      toast.error(t('讀取 JSON 檔案失敗', 'Failed to read JSON file'))
    }
  }

  const handleExportComfyJson = async (original = false) => {
    try {
      const cp = apiConfig.comfyuiParams
      const schemas = !original && cp.parameterOverrides?.workflowId === workflowIdentity(cp.workflowJson) ? await fetchComfyObjectInfo(providerCfg.baseUrl, providerCfg.apiKey, cp.workflowJson) : undefined
      const wf = JSON.parse(original ? cp.workflowJson : applyWorkflowOverrides(cp.workflowJson, cp.parameterOverrides, schemas))
      if (!original && cp.promptNodeId && cp.promptNodeId !== 'none' && wf[cp.promptNodeId]?.inputs) {
        const inputs = wf[cp.promptNodeId].inputs
        for (const field of ['prompt', 'text', 'string', 'positive']) {
          if (typeof inputs[field] === 'string') {
            inputs[field] = prompt
            break
          }
        }
      }
      const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comfyui-workflow-${Date.now()}.api.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('已匯出 ComfyUI API 工作流 JSON', 'Exported ComfyUI API workflow JSON'))
    } catch {
      toast.error(t('目前工作流 JSON 格式有誤，無法匯出', 'Current workflow JSON is invalid and cannot be exported'))
    }
  }

  const handleSlotUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const slot = uploadSlotRef.current
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('請選擇圖片檔案', 'Please select an image file'))
      return
    }
    setUploadingSlot(slot)
    try {
      const url = await fileToDataUrl(file)
      const image = new Image()
      image.src = url
      await image.decode()
      const name = file.name.replace(/\.[^.]+$/, '') || t('上傳圖片', 'Uploaded Image')
      const items = uploadedReferences(name, url, image.width, image.height, file.size)
      if (slot === 'portrait') setPortrait(items.portrait)
      if (slot === 'costume') setCostume(items.costume)
      if (slot === 'pose') setPose(items.pose)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('圖片讀取失敗', 'Failed to read image'))
    } finally {
      setUploadingSlot(null)
    }
  }

  const missingReferences = activeProvider === 'comfyui' ? [
    { key: 'portrait' as const, label: t('人像', 'Portrait'), node: apiConfig.comfyuiParams.portraitNodeId, image: recipe.portrait },
    { key: 'costume' as const, label: t('服裝', 'Costume'), node: apiConfig.comfyuiParams.costumeNodeId, image: recipe.costume },
    { key: 'pose' as const, label: t('姿勢', 'Pose'), node: apiConfig.comfyuiParams.poseNodeId, image: recipe.pose },
  ].filter((slot) => slot.node && slot.node !== 'none' && parsedComfyNodes.imageNodes.some((node) => node.id === slot.node && node.emptyValue === undefined) && !slot.image) : []

  const missingRefKeys = new Set(missingReferences.map((s) => s.key))
  const extraImages = recipe.extraImages || []
  const hasStitchRefs = Boolean(recipe.portrait || recipe.costume || recipe.pose || extraImages.length > 0)
  const hasAnyRef = hasStitchRefs || activeWorkflowImages.length > 0

  const portraitLoc = recipe.portrait ? localizePortrait(recipe.portrait, locale) : null
  const costumeLoc = recipe.costume ? localizeCostume(recipe.costume, locale) : null
  const poseLoc = recipe.pose ? localizePose(recipe.pose, locale) : null

  const processFiles = async (files: File[]) => {
    const imgFiles = files.filter((f) => f.type.startsWith('image/'))
    if (!imgFiles.length) return
    try {
      for (const file of imgFiles) {
        const dataUrl = await fileToDataUrl(file)
        const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 16)
        addExtraImage({ name: baseName || t('附加圖', 'Extra Image'), url: dataUrl })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('圖片讀取失敗', 'Failed to read image'))
    }
  }

  // 支持在合成台直接 Cmd+V / Ctrl+V 粘贴剪贴板图片作为附加参考图
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const items = Array.from(e.clipboardData?.items || [])
      const files = items
        .filter((it) => it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean) as File[]
      if (files.length > 0) {
        e.preventDefault()
        void processFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const handleRandom = async () => {
    const [posesRes, costumes, portraits] = await Promise.all([
      qc.ensureQueryData(posesQuery),
      qc.ensureQueryData(costumesQuery),
      qc.ensureQueryData(portraitsQuery),
    ])
    randomizeRecipe({
      poses: posesRes.items,
      costumes,
      portraits,
    })
  }

  const handleUploadFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    await processFiles(files)
    e.target.value = ''
  }

  const handleDropFiles = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    await processFiles(files)
  }

  const handleAddUrl = () => {
    const trimmed = extraUrlInput.trim()
    if (!trimmed) return
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('data:image/')) {
      toast.error(t('請輸入有效的 http(s):// 圖片連結', 'Please enter a valid http(s):// image URL'))
      return
    }
    addExtraImage({ name: t('外部參考圖', 'External Reference'), url: trimmed })
    setExtraUrlInput('')
    setShowUrlInput(false)
  }

  const handleOpenStitchModal = async () => {
    try {
      const url = await stitchRecipeCanvas(recipe, locale)
      setStitchModalUrl(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('拼圖失敗', 'Failed to stitch reference sheet'))
    }
  }

  const handleGenerate = () => {
    if (activeProvider === 'comfyui') {
      const cp = apiConfig.comfyuiParams
      const workflowImages = recipe.workflowImagesIdentity === workflowIdentity(cp.workflowJson) ? recipe.workflowImages || {} : {}
      const selected = [recipe.portrait ? cp.portraitNodeId : '', recipe.costume ? cp.costumeNodeId : '', recipe.pose ? cp.poseNodeId : '', ...Object.keys(workflowImages)].filter((id) => id && id !== 'none')
      const combinationError = validateReferenceCombinations(cp.workflowJson, selected)
      if (combinationError) { toast.error(combinationError); setShowAdvanced(true); return }
    }
    if (missingReferences.length) {
      setShowReferenceErrors(true)
      requestAnimationFrame(() => referenceErrorsRef.current?.focus())
      return
    }
    void startGeneration(prompt)
  }

  return (
    <>
      <PageHeader
        title={t('AI 角色合成台', 'AI Character Studio')}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings">
              <KeyRoundIcon className="size-4" />
              {providerCfg.apiKey || activeProvider === 'comfyui'
                ? t(`${providerMeta.shortName} 已就緒`, `${providerMeta.shortName} Ready`)
                : t('設定 API Key', 'Configure API Key')}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* 左栏：参考图、模型参数与 Prompt */}
        <div
          className="flex flex-col gap-4 lg:col-span-7"
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDropFiles}
        >
          {/* 1. 参考图组合 */}
          <Section
            title={t('1. 參考圖組合', '1. Reference Images')}
            className="md:grid-cols-1"
            actions={
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUploadFiles}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={handleRandom}
                >
                  <DicesIcon className="size-3.5" />
                  {t('隨機', 'Random')}
                </Button>
                {hasAnyRef && hasStitchRefs && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={handleOpenStitchModal}
                  >
                    <LayoutGridIcon className="size-3.5" />
                    {t('參考拼圖', 'Reference Sheet')}
                  </Button>
                )}
              </div>
            }
          >

            <input ref={slotInputRef} type="file" accept="image/*" className="hidden" onChange={handleSlotUpload} />
            {showReferenceErrors && missingReferences.length > 0 && (
              <div id="reference-errors" ref={referenceErrorsRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive focus-visible:outline-2">
                {t(
                  `請先選擇或上傳：${missingReferences.map((s) => s.label).join('、')}。這些槽位已綁定工作流節點。`,
                  `Please select or upload first: ${missingReferences.map((s) => s.label).join(', ')}. These slots are bound to workflow nodes.`
                )}
              </div>
            )}
            {/* 3 个核心图库槽位：手机端单列舒展展示，平板/桌面端三列并排 */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {/* 人像槽 */}
              <div className={`relative flex min-w-0 items-center gap-2 rounded-xl bg-background p-2 ${showReferenceErrors && missingRefKeys.has('portrait') ? 'ring-1 ring-destructive' : ''}`}>
                {recipe.portrait && portraitLoc ? (
                  <>
                    <button type="button" aria-label={t('放大人像參考圖', 'Zoom portrait reference')} className="flex min-h-11 min-w-11 shrink-0 cursor-zoom-in items-center justify-center rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => {
                      const item = recipe.portrait
                      if (item) setZoomImageUrl(referenceImageUrl(item.原图 || item.缩略图))
                    }}>
                      <img
                        src={referenceImageUrl(recipe.portrait.缩略图)}
                        alt={portraitLoc.title}
                        className="h-11 w-9 shrink-0 rounded-lg object-cover"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">{t('人像', 'Portrait')}</div>
                      <div className="truncate text-xs font-medium" title={portraitLoc.styleName}>{portraitLoc.styleName}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={t('清除人像參考圖', 'Clear portrait reference')}
                      onClick={() => setPortrait(null)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/portraits"
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <UserRoundIcon className="size-4" />
                      </div>
                      <span className="truncate text-xs">{t('+ 選人像', '+ Portrait')}</span>
                    </Link>
                    <Button type="button" variant="ghost" size="sm" aria-label={t('上傳人像參考圖', 'Upload portrait reference')} aria-describedby={showReferenceErrors && missingRefKeys.has('portrait') ? 'reference-errors' : undefined} aria-busy={uploadingSlot === 'portrait'} disabled={uploadingSlot !== null} className="h-11 shrink-0 border-l px-2 text-xs" onClick={() => { uploadSlotRef.current = 'portrait'; slotInputRef.current?.click() }}>
                      {uploadingSlot === 'portrait' ? <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" /> : <ImagePlusIcon className="size-3.5" />}
                      {uploadingSlot === 'portrait' ? t('處理中', 'Wait') : t('上傳', 'Upload')}
                    </Button>
                  </>
                )}
              </div>

              {/* 服装槽 */}
              <div className={`relative flex min-w-0 items-center gap-2 rounded-xl bg-background p-2 ${showReferenceErrors && missingRefKeys.has('costume') ? 'ring-1 ring-destructive' : ''}`}>
                {recipe.costume && costumeLoc ? (
                  <>
                    <button type="button" aria-label={t('放大服裝參考圖', 'Zoom costume reference')} className="flex min-h-11 min-w-11 shrink-0 cursor-zoom-in items-center justify-center rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => {
                      const item = recipe.costume
                      if (item) setZoomImageUrl(referenceImageUrl(item.预览图 || item.原图 || item.缩略图))
                    }}>
                      <img
                        src={referenceImageUrl(recipe.costume.缩略图)}
                        alt={costumeLoc.name}
                        className="h-11 w-9 shrink-0 rounded-lg object-cover"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">{t('服裝', 'Costume')}</div>
                      <div className="truncate text-xs font-medium" title={costumeLoc.name}>{costumeLoc.name}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={t('清除服裝參考圖', 'Clear costume reference')}
                      onClick={() => setCostume(null)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/costumes"
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <ShirtIcon className="size-4" />
                      </div>
                      <span className="truncate text-xs">{t('+ 選服裝', '+ Costume')}</span>
                    </Link>
                    <Button type="button" variant="ghost" size="sm" aria-label={t('上傳服裝參考圖', 'Upload costume reference')} aria-describedby={showReferenceErrors && missingRefKeys.has('costume') ? 'reference-errors' : undefined} aria-busy={uploadingSlot === 'costume'} disabled={uploadingSlot !== null} className="h-11 shrink-0 border-l px-2 text-xs" onClick={() => { uploadSlotRef.current = 'costume'; slotInputRef.current?.click() }}>
                      {uploadingSlot === 'costume' ? <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" /> : <ImagePlusIcon className="size-3.5" />}
                      {uploadingSlot === 'costume' ? t('處理中', 'Wait') : t('上傳', 'Upload')}
                    </Button>
                  </>
                )}
              </div>

              {/* 姿势槽 */}
              <div className={`relative flex min-w-0 items-center gap-2 rounded-xl bg-background p-2 ${showReferenceErrors && missingRefKeys.has('pose') ? 'ring-1 ring-destructive' : ''}`}>
                {recipe.pose && poseLoc ? (
                  <>
                    <button type="button" aria-label={t('放大姿勢參考圖', 'Zoom pose reference')} className="flex min-h-11 min-w-11 shrink-0 cursor-zoom-in items-center justify-center rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => {
                      const item = recipe.pose
                      if (item) setZoomImageUrl(referenceImageUrl(item.原图 || item.缩略图))
                    }}>
                      <img
                        src={referenceImageUrl(recipe.pose.缩略图)}
                        alt={poseLoc.name}
                        className="h-11 w-9 shrink-0 rounded-lg object-cover"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">
                        {t('姿勢', 'Pose')}
                        {recipe.pose.source === 'upload'
                          ? t(' · 本機上傳', ' · Local Upload')
                          : poseLoc.angle
                            ? ` · ${poseLoc.angle}`
                            : ''}
                      </div>
                      <div className="truncate text-xs font-medium" title={poseLoc.name}>{poseLoc.name}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={t('清除姿勢參考圖', 'Clear pose reference')}
                      onClick={() => setPose(null)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/poses"
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <PersonStandingIcon className="size-4" />
                      </div>
                      <span className="truncate text-xs">{t('+ 選姿勢', '+ Pose')}</span>
                    </Link>
                    <Button type="button" variant="ghost" size="sm" aria-label={t('上傳姿勢參考圖', 'Upload pose reference')} aria-describedby={showReferenceErrors && missingRefKeys.has('pose') ? 'reference-errors' : undefined} aria-busy={uploadingSlot === 'pose'} disabled={uploadingSlot !== null} className="h-11 shrink-0 border-l px-2 text-xs" onClick={() => { uploadSlotRef.current = 'pose'; slotInputRef.current?.click() }}>
                      {uploadingSlot === 'pose' ? <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" /> : <ImagePlusIcon className="size-3.5" />}
                      {uploadingSlot === 'pose' ? t('處理中', 'Wait') : t('上傳', 'Upload')}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* 附加参考图列表 + 可视化拖拽/粘贴上传框 */}
            <div className="space-y-2 pt-1">
              {extraImages.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {extraImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="flex items-center gap-2 rounded-xl border border-border/60 bg-background p-1.5"
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="h-11 w-9 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-muted-foreground">{t(`附圖 #${idx + 1}`, `Extra #${idx + 1}`)}</div>
                        <input
                          type="text"
                          value={img.name}
                          onChange={(e) => updateExtraImageName(img.id, e.target.value)}
                          placeholder={t('備註(如:配飾/背景)', 'Note (e.g. accessory/bg)')}
                          className="w-full truncate bg-transparent text-xs font-medium outline-none focus:underline"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExtraImage(img.id)}
                        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 显式虚线上传/拖拽/粘贴提示区 */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-3 py-2.5 text-center transition sm:flex-row sm:justify-between ${
                  isDragging
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border bg-background/60 text-muted-foreground hover:border-primary/50 hover:bg-background hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <ImagePlusIcon className="size-4 shrink-0" />
                  <span>
                    {isDragging
                      ? t('放開滑鼠加入附加參考圖', 'Drop to add extra reference image')
                      : t(
                          '加入附加參考圖：點擊上傳、拖曳圖片至此，或直接按 Ctrl+V / ⌘V 貼上',
                          'Add extra references: click to upload, drag & drop here, or press Ctrl+V / ⌘V to paste'
                        )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowUrlInput((s) => !s)
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                >
                  <LinkIcon className="size-3" />
                  {t('輸入圖片 URL', 'Enter Image URL')}
                </button>
              </div>

              {showUrlInput && (
                <div className="flex items-center gap-2">
                  <Input
                    value={extraUrlInput}
                    onChange={(e) => setExtraUrlInput(e.target.value)}
                    placeholder={t('貼上 https://... 圖片網址', 'Paste https://... image URL')}
                    className="bg-background text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                  />
                  <Button size="sm" onClick={handleAddUrl}>
                    {t('加入', 'Add')}
                  </Button>
                </div>
              )}
            </div>
          </Section>

          {/* 2. 协议、模型与可折叠高级参数 */}
          <Section
            title={t('2. 模型與參數', '2. Model & Parameters')}
            actions={
              <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
                <SlidersHorizontalIcon className="size-3.5" />
                {t('進階參數', 'Advanced')}
                {showAdvanced ? (
                  <ChevronUpIcon className="size-3.5" />
                ) : (
                  <ChevronDownIcon className="size-3.5" />
                )}
              </Button>
            }
          >
            <Field label={t('介面協定', 'Provider')}>
              <Select
                value={activeProvider}
                onValueChange={(v) => updateApiConfig({ activeProvider: v as ImageProviderId })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_LIST.map((pid) => (
                    <SelectItem key={pid} value={pid}>
                      {getProviderMeta(pid, locale).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {activeProvider === 'comfyui' ? (
              <Field label={t('工作流模板 (API 格式)', 'Workflow Template (API Format)')}>
                <div className="space-y-2">
                  <Select
                    value={apiConfig.comfyuiParams.workflowPreset}
                    onValueChange={(v) =>
                      handleSelectComfyPreset(v as ComfyUiParams['workflowPreset'])
                    }
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(COMFYUI_WORKFLOW_TEMPLATES) as ComfyPresetId[]).map((key) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {locale === 'en'
                            ? COMFYUI_WORKFLOW_TEMPLATES[key].labelEn
                            : COMFYUI_WORKFLOW_TEMPLATES[key].label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom" className="text-xs">
                        {t('自訂工作流 (已匯入 JSON)', 'Custom Workflow (Imported JSON)')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1.5">
                    <input
                      ref={comfyFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleComfyFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => comfyFileInputRef.current?.click()}
                    >
                      <FileUpIcon className="size-3.5" />
                      {t('匯入 .json', 'Import .json')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowComfyJsonModal(true)}
                    >
                      <CodeXmlIcon className="size-3.5" />
                      {t('編輯 JSON', 'Edit JSON')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => void handleExportComfyJson()}
                    >
                      <DownloadIcon className="size-3.5" />
                      {t('匯出 .json', 'Export .json')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={handleCheckComfy}
                      disabled={checkingComfy}
                    >
                      {checkingComfy ? (
                        <LoaderCircleIcon className="size-3.5 animate-spin" />
                      ) : (
                        <ScanSearchIcon className="size-3.5" />
                      )}
                      {t('檢測本機模型', 'Check Local Models')}
                    </Button>
                  </div>
                  {comfyCheck && (
                    <div
                      className={`space-y-1 rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${
                        comfyCheck.ok
                          ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
                          : 'border-destructive/40 bg-destructive/10 text-destructive'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        {comfyCheck.ok ? (
                          <CircleCheckIcon className="size-3.5" />
                        ) : (
                          <CircleAlertIcon className="size-3.5" />
                        )}
                        {comfyCheck.ok
                          ? t('工作流與本機模型/節點匹配，可以生成', 'Workflow matches local models/nodes and is ready')
                          : t('檢測未通過', 'Check failed')}
                      </div>
                      {comfyCheck.info && <div className="opacity-80">{comfyCheck.info}</div>}
                      {comfyCheck.errors.map((m, i) => (
                        <div key={`e${i}`} className="whitespace-pre-wrap break-all">
                          • {m}
                        </div>
                      ))}
                      {comfyCheck.fixes.map((m, i) => (
                        <div key={`f${i}`} className="break-all">
                          ✓ {m}
                        </div>
                      ))}
                      {comfyCheck.warnings.map((m, i) => (
                        <div key={`w${i}`} className="break-all opacity-80">
                          ! {m}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            ) : (
              <>
                <Field label={t('模型 ID', 'Model ID')}>
                  <Select
                    value={providerCfg.model}
                    onValueChange={(v) => updateProviderConfig(activeProvider, { model: v })}
                  >
                    <SelectTrigger className="w-full font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerMeta.models.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="font-mono text-xs">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {providerCfg.model === 'custom' && (
                  <Field label={t('自訂模型 ID', 'Custom Model ID')}>
                    <Input
                      value={providerCfg.customModel}
                      onChange={(e) =>
                        updateProviderConfig(activeProvider, { customModel: e.target.value })
                      }
                      placeholder={t('輸入模型 ID', 'Enter model ID')}
                      className="bg-background font-mono text-xs"
                    />
                  </Field>
                )}
              </>
            )}

            <Field label={t('畫風預設', 'Style Preset')}>
              <Select
                value={apiConfig.stylePreset}
                onValueChange={(v) => updateApiConfig({ stylePreset: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STYLE_PRESETS).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {locale === 'en' ? info.labelEn : info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {activeProvider === 'comfyui' && (
              <>
                {!parsedComfyNodes.valid && (
                  <div className="col-span-full rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {parsedComfyNodes.error}
                  </div>
                )}

                <Field label={t('人像圖節點 (LoadImage)', 'Portrait Node (LoadImage)')}>
                  <Select
                    value={apiConfig.comfyuiParams.portraitNodeId}
                    onValueChange={(v) => updateComfyUiParams({ portraitNodeId: v })}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('不綁定', 'Unbound')}</SelectItem>
                      {parsedComfyNodes.imageNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id} className="text-xs">
                          #{n.id} {n.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={t('服裝圖節點 (LoadImage)', 'Costume Node (LoadImage)')}>
                  <Select
                    value={apiConfig.comfyuiParams.costumeNodeId}
                    onValueChange={(v) => updateComfyUiParams({ costumeNodeId: v })}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('不綁定', 'Unbound')}</SelectItem>
                      {parsedComfyNodes.imageNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id} className="text-xs">
                          #{n.id} {n.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={t('姿勢圖節點 (LoadImage)', 'Pose Node (LoadImage)')}>
                  <Select
                    value={apiConfig.comfyuiParams.poseNodeId}
                    onValueChange={(v) => updateComfyUiParams({ poseNodeId: v })}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('不綁定', 'Unbound')}</SelectItem>
                      {parsedComfyNodes.imageNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id} className="text-xs">
                          #{n.id} {n.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={t('正向提示詞節點 (Prompt)', 'Positive Prompt Node')}>
                  <Select
                    value={apiConfig.comfyuiParams.promptNodeId}
                    onValueChange={(v) => updateComfyUiParams({ promptNodeId: v })}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('保留工作流原提示詞', 'Keep Workflow Default Prompt')}</SelectItem>
                      {parsedComfyNodes.promptNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id} className="text-xs">
                          #{n.id} {n.title} ({n.field})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            {activeProvider === 'comfyui' && showAdvanced && <WorkflowParameters onPreview={setZoomImageUrl} onUploadingChange={setUploadingSlot} />}

            {/* 展开的高级协议专属参数 */}
            {showAdvanced && (
              <>
                {activeProvider === 'gemini' && (
                  <>
                    <Field label={t('Gemini 協定模式', 'Gemini Endpoint Mode')}>
                      <Select
                        value={apiConfig.geminiParams.endpointMode}
                        onValueChange={(v) =>
                          updateGeminiParams({ endpointMode: v as GeminiParams['endpointMode'] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="native">Native (:generateContent)</SelectItem>
                          <SelectItem value="openai_chat">OpenAI Chat (/v1/chat/completions)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('長寬比 (aspectRatio)', 'Aspect Ratio')}>
                      <Select
                        value={apiConfig.geminiParams.aspectRatio}
                        onValueChange={(v) =>
                          updateGeminiParams({ aspectRatio: v as GeminiParams['aspectRatio'] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3:4">3:4</SelectItem>
                          <SelectItem value="9:16">9:16</SelectItem>
                          <SelectItem value="1:1">1:1</SelectItem>
                          <SelectItem value="4:3">4:3</SelectItem>
                          <SelectItem value="16:9">16:9</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('解析度 (imageSize)', 'Resolution (imageSize)')}>
                      <Select
                        value={apiConfig.geminiParams.imageSize}
                        onValueChange={(v) =>
                          updateGeminiParams({ imageSize: v as GeminiParams['imageSize'] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1K">1K</SelectItem>
                          <SelectItem value="2K">2K</SelectItem>
                          <SelectItem value="4K">4K</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}

                {activeProvider === 'gpt' && (
                  <>
                    <Field label={t('呼叫端點 (endpointMode)', 'Endpoint Mode')}>
                      <Select
                        value={apiConfig.gptParams.endpointMode}
                        onValueChange={(v) =>
                          updateGptParams({ endpointMode: v as GptParams['endpointMode'] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="images_edits_json">/v1/images/edits (JSON)</SelectItem>
                          <SelectItem value="responses">/v1/responses</SelectItem>
                          <SelectItem value="chat">/v1/chat/completions</SelectItem>
                          <SelectItem value="images_edits">/v1/images/edits (Multipart)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('輸出尺寸 (size)', 'Output Size')}>
                      <Select
                        value={apiConfig.gptParams.size}
                        onValueChange={(v) => updateGptParams({ size: v as GptParams['size'] })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1024x1536">1024x1536</SelectItem>
                          <SelectItem value="1024x1024">1024x1024</SelectItem>
                          <SelectItem value="1536x1024">1536x1024</SelectItem>
                          <SelectItem value="auto">auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('算繪品質 (quality)', 'Quality')}>
                      <Select
                        value={apiConfig.gptParams.quality}
                        onValueChange={(v) => updateGptParams({ quality: v as GptParams['quality'] })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">high</SelectItem>
                          <SelectItem value="xhigh">xhigh</SelectItem>
                          <SelectItem value="max">max</SelectItem>
                          <SelectItem value="medium">medium</SelectItem>
                          <SelectItem value="low">low</SelectItem>
                          <SelectItem value="auto">auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('參考還原度 (input_fidelity)', 'Input Fidelity')}>
                      <Select
                        value={apiConfig.gptParams.inputFidelity}
                        onValueChange={(v) =>
                          updateGptParams({ inputFidelity: v as GptParams['inputFidelity'] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">high</SelectItem>
                          <SelectItem value="low">low</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('背景模式 (background)', 'Background')}>
                      <Select
                        value={apiConfig.gptParams.background}
                        onValueChange={(v) =>
                          updateGptParams({ background: v as GptParams['background'] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">auto</SelectItem>
                          <SelectItem value="transparent">transparent</SelectItem>
                          <SelectItem value="opaque">opaque</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('圖片格式 (output_format)', 'Output Format')}>
                      <Select
                        value={apiConfig.gptParams.outputFormat}
                        onValueChange={(v) =>
                          updateGptParams({ outputFormat: v as GptParams['outputFormat'] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="png">png</SelectItem>
                          <SelectItem value="webp">webp</SelectItem>
                          <SelectItem value="jpeg">jpeg</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}

                {activeProvider === 'qwen' && (
                  <>
                    <Field label={t('輸出尺寸 (size)', 'Output Size')}>
                      <Select
                        value={apiConfig.qwenParams.size}
                        onValueChange={(v) => updateQwenParams({ size: v as QwenParams['size'] })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1024*1536">1024*1536</SelectItem>
                          <SelectItem value="928*1664">928*1664</SelectItem>
                          <SelectItem value="1328*1328">1328*1328</SelectItem>
                          <SelectItem value="1664*928">1664*928</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('提示詞擴寫 (prompt_extend)', 'Prompt Extend')}>
                      <div className="flex h-9 items-center justify-between rounded-xl border bg-background px-3">
                        <span className="text-xs text-muted-foreground">
                          {apiConfig.qwenParams.promptExtend ? t('開啟', 'Enabled') : t('關閉', 'Disabled')}
                        </span>
                        <Switch
                          checked={apiConfig.qwenParams.promptExtend}
                          onCheckedChange={(v) => updateQwenParams({ promptExtend: v })}
                        />
                      </div>
                    </Field>
                    <Field label={t('反向提示詞 (negative_prompt)', 'Negative Prompt')}>
                      <Input
                        value={apiConfig.qwenParams.negativePrompt}
                        onChange={(e) => updateQwenParams({ negativePrompt: e.target.value })}
                        placeholder={t('低解析度，多餘手指，扭曲', 'low resolution, extra fingers, deformed')}
                        className="bg-background text-xs"
                      />
                    </Field>
                  </>
                )}

                {activeProvider === 'doubao' && (
                  <>
                    <Field label={t('輸出尺寸 (size)', 'Output Size')}>
                      <Select
                        value={apiConfig.doubaoParams.size}
                        onValueChange={(v) =>
                          updateDoubaoParams({ size: v as DoubaoParams['size'] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1728x2304">1728x2304</SelectItem>
                          <SelectItem value="2K">2K</SelectItem>
                          <SelectItem value="4K">4K</SelectItem>
                          <SelectItem value="1440x2560">1440x2560</SelectItem>
                          <SelectItem value="2048x2048">2048x2048</SelectItem>
                          <SelectItem value="2560x1440">2560x1440</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('組圖模式 (sequential)', 'Sequential Mode')}>
                      <Select
                        value={apiConfig.doubaoParams.sequentialImageGeneration}
                        onValueChange={(v) =>
                          updateDoubaoParams({
                            sequentialImageGeneration:
                              v as DoubaoParams['sequentialImageGeneration'],
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disabled">{t('disabled (單張)', 'disabled (Single)')}</SelectItem>
                          <SelectItem value="auto">{t('auto (組圖)', 'auto (Sequential)')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('回傳格式 (response_format)', 'Response Format')}>
                      <Select
                        value={apiConfig.doubaoParams.responseFormat}
                        onValueChange={(v) =>
                          updateDoubaoParams({
                            responseFormat: v as DoubaoParams['responseFormat'],
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="b64_json">b64_json</SelectItem>
                          <SelectItem value="url">url</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}

                {activeProvider === 'comfyui' && (
                  <>
                    <Field label={t('三合一拼圖節點 (可選)', '3-in-1 Stitched Sheet Node (Optional)')}>
                      <Select
                        value={apiConfig.comfyuiParams.stitchedNodeId}
                        onValueChange={(v) => updateComfyUiParams({ stitchedNodeId: v })}
                      >
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('不綁定', 'Unbound')}</SelectItem>
                          {parsedComfyNodes.imageNodes.map((n) => (
                            <SelectItem key={n.id} value={n.id} className="text-xs">
                              #{n.id} {n.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('最長等待時間（秒）', 'Max Timeout (sec)')}>
                      <Input
                        type="number"
                        min={60}
                        step={60}
                        value={apiConfig.comfyuiParams.timeoutSec}
                        onChange={(e) =>
                          updateComfyUiParams({ timeoutSec: Math.max(60, Number(e.target.value) || 600) })
                        }
                        className="bg-background text-xs"
                      />
                    </Field>
                    <Field label={t('隨機種子 (seed)', 'Random Seed')}>
                      <div className="flex h-9 items-center justify-between rounded-xl border bg-background px-3">
                        <span className="text-xs text-muted-foreground">
                          {apiConfig.comfyuiParams.randomizeSeed
                            ? t('每次隨機種子', 'Randomize seed each run')
                            : t('固定工作流種子', 'Fixed workflow seed')}
                        </span>
                        <Switch
                          checked={apiConfig.comfyuiParams.randomizeSeed}
                          onCheckedChange={(v) => updateComfyUiParams({ randomizeSeed: v })}
                        />
                      </div>
                    </Field>
                  </>
                )}

                {activeProvider !== 'comfyui' && (
                  <>
                    <Field label={t('圖片傳參方式', 'Image Pass Mode')}>
                      <Select
                        value={apiConfig.imagePassMode}
                        onValueChange={(v) => updateApiConfig({ imagePassMode: v as ImagePassMode })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="url">URL</SelectItem>
                          <SelectItem value="base64">Base64</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label={t('附帶合成拼圖', 'Attach Stitched Sheet')}>
                      <div className="flex h-9 items-center justify-between rounded-xl border bg-background px-3">
                        <span className="text-xs text-muted-foreground">
                          {apiConfig.sendStitchedSheet
                            ? t('同時傳送拼圖', 'Send stitched sheet too')
                            : t('僅傳單圖序列', 'Individual images only')}
                        </span>
                        <Switch
                          checked={apiConfig.sendStitchedSheet}
                          onCheckedChange={(v) => updateApiConfig({ sendStitchedSheet: v })}
                        />
                      </div>
                    </Field>
                  </>
                )}
              </>
            )}
          </Section>

          {/* 3. 提示词与生成按钮 */}
          <Section
            title={t('3. 提示詞 (Prompt)', '3. Prompt')}
            className="md:grid-cols-1"
            actions={
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setCustomPrompt(null)}>
                  <RotateCcwIcon className="size-3.5" />
                  {t('重置', 'Reset')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(prompt)
                    toast.success(t('已複製', 'Copied'))
                  }}
                >
                  <CopyIcon className="size-3.5" />
                  {t('複製', 'Copy')}
                </Button>
              </div>
            }
          >
            <Textarea
              value={prompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={5}
              className="bg-background font-mono text-xs leading-relaxed"
            />

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || uploadingSlot !== null}
              className="h-11 w-full text-sm font-semibold"
            >
              {isGenerating ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  {t('生成中…', 'Generating…')}
                </>
              ) : (
                <>
                  <SparklesIcon className="size-4" />
                  {t('生成角色圖', 'Generate Character Image')}
                </>
              )}
            </Button>
          </Section>
        </div>

        {/* 右栏：专注展示 AI 生成结果与生成状态 */}
        <div className="lg:col-span-5">
          <Section
            title={t('生成結果', 'Generation Result')}
            className="md:grid-cols-1"
            actions={
              previewUrl && !isGenerating ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={previewUrl} download="image.png">
                    <DownloadIcon className="size-3.5" />
                    {t('下載圖片', 'Download Image')}
                  </a>
                </Button>
              ) : null
            }
          >
            <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-2xl bg-background p-4 sm:min-h-[460px]">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <LoaderCircleIcon className="size-6 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{t('正在生成角色圖…', 'Generating character image…')}</div>
                    {generatingModel && (
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {generatingModel}
                      </Badge>
                    )}
                    {generationProgress && (
                      <div className="w-56 space-y-1.5 pt-1">
                        <div className="text-xs text-foreground/80">{generationProgress.message}</div>
                        {generationProgress.percent !== undefined && (
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${generationProgress.percent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <p className="pt-1 text-xs text-muted-foreground">
                      {t('切換頁面不會中斷目前任務', 'Switching pages will not interrupt the active task')}
                    </p>
                  </div>
                </div>
              ) : generationError ? (
                <div className="flex max-w-md flex-col items-center gap-2 text-center">
                  <CircleAlertIcon className="size-7 text-destructive" />
                  <div className="text-sm font-semibold text-destructive">{t('生成失敗', 'Generation Failed')}</div>
                  <p className="whitespace-pre-wrap break-all text-left text-xs leading-relaxed text-muted-foreground">
                    {generationError}
                  </p>
                  {previewUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setZoomImageUrl(previewUrl)}>
                      {t('查看上一張結果', 'View Previous Result')}
                    </Button>
                  )}
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt={t('生成結果', 'Generated Result')}
                  onClick={() => setZoomImageUrl(previewUrl)}
                  title={t('點擊放大查看', 'Click to zoom')}
                  className="max-h-[480px] w-auto cursor-zoom-in rounded-xl object-contain transition hover:opacity-95"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                  <SparklesIcon className="size-7 opacity-35" />
                  <span className="text-xs">
                    {t('點擊「生成角色圖」後在此處展示生成結果', 'Click "Generate Character Image" to view the result here')}
                  </span>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* 生成历史记录 */}
      {history.length > 0 && (
        <Section
          title={t(`生成記錄 (${history.length})`, `History (${history.length})`)}
          className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
          actions={
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2Icon className="size-3.5" />
              {t('清空', 'Clear')}
            </Button>
          }
        >
          {history.map((h) => (
            <div
              key={h.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-background p-2"
            >
              <div
                onClick={() => {
                  setPreviewUrl(h.imageUrl)
                  setZoomImageUrl(h.imageUrl)
                }}
                className="relative aspect-3/4 cursor-zoom-in overflow-hidden rounded-xl bg-muted"
              >
                <img
                  src={h.imageUrl}
                  alt={h.recipeSummary}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
                <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                  {h.model}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeHistoryItem(h.id)
                  }}
                  title={t('刪除此記錄', 'Delete this item')}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/65 p-1 text-white opacity-85 transition hover:bg-destructive hover:opacity-100"
                >
                  <XIcon className="size-3" />
                </button>
              </div>

              <div className="mt-2 space-y-1.5 px-0.5">
                <div className="truncate text-xs font-medium">{h.recipeSummary}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPrompt(h.prompt)
                      toast.success(t('已恢復該圖提示詞', 'Restored prompt from this item'))
                    }}
                    className="flex h-7 items-center justify-center rounded-lg bg-muted text-[11px] font-medium whitespace-nowrap text-foreground transition hover:bg-muted/70"
                  >
                    {t('複用詞', 'Reuse Prompt')}
                  </button>
                  <a
                    href={h.imageUrl}
                    download={`character-${h.id}.png`}
                    className="flex h-7 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-medium whitespace-nowrap text-primary transition hover:bg-primary/20"
                  >
                    {t('下載', 'Download')}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* 生成结果全屏放大灯箱 */}
      <Dialog open={Boolean(zoomImageUrl)} onOpenChange={(o) => !o && setZoomImageUrl(null)}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-4xl overflow-y-auto p-4 sm:max-w-4xl">
          <DialogHeader className="flex flex-row items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-base">{t('圖片大圖預覽', 'Image Preview')}</DialogTitle>
              <DialogDescription className="sr-only">
                {t('參考圖片或生成結果的放大預覽。按 Esc 或關閉按鈕返回。', 'Zoomed preview of reference or generated image. Press Esc or Close to return.')}
              </DialogDescription>
            </div>
            {zoomImageUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={zoomImageUrl} download="image.png">
                  <DownloadIcon className="size-3.5" />
                  {t('下載原圖', 'Download Original')}
                </a>
              </Button>
            )}
          </DialogHeader>
          {zoomImageUrl && (
            <div className="mt-2 flex items-center justify-center overflow-hidden rounded-xl bg-muted/60 p-2">
              <img
                src={zoomImageUrl}
                alt={t('大圖預覽', 'Zoomed Preview')}
                className="max-h-[78vh] w-auto rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 参考拼图独立弹窗（不占用主画布） */}
      <Dialog open={Boolean(stitchModalUrl)} onOpenChange={(o) => !o && setStitchModalUrl(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto p-4 sm:max-w-3xl">
          <DialogHeader className="flex flex-row items-center justify-between pr-6">
            <DialogTitle className="text-base">{t('參考圖拼合卡片', 'Stitched Reference Sheet')}</DialogTitle>
            {stitchModalUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={stitchModalUrl} download="reference-sheet.jpg">
                  <DownloadIcon className="size-3.5" />
                  {t('下載拼圖', 'Download Sheet')}
                </a>
              </Button>
            )}
          </DialogHeader>
          {stitchModalUrl && (
            <div className="mt-2 flex items-center justify-center overflow-hidden rounded-xl bg-muted p-2">
              <img
                src={stitchModalUrl}
                alt={t('參考拼圖', 'Reference Sheet')}
                className="max-h-[70vh] w-auto rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ComfyUI API 工作流 JSON 编辑器弹窗 */}
      <Dialog open={showComfyJsonModal} onOpenChange={setShowComfyJsonModal}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto p-4 sm:max-w-3xl">
          <DialogHeader className="flex flex-row items-center justify-between pr-6">
            <DialogTitle className="text-base">{t('ComfyUI API 工作流 JSON', 'ComfyUI API Workflow JSON')}</DialogTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const info = parseComfyWorkflowNodes(apiConfig.comfyuiParams.workflowJson)
                if (!info.valid) {
                  toast.error(info.error || t('工作流 JSON 無效', 'Invalid workflow JSON'))
                  return
                }
                const detected = autoDetectComfyMappings(apiConfig.comfyuiParams.workflowJson)
                updateComfyUiParams(detected)
                toast.success(
                  t(
                    `已自動重新識別節點：${info.imageNodes.length} 個圖片節點、${info.promptNodes.length} 個提示詞節點`,
                    `Auto-detected nodes: ${info.imageNodes.length} image node(s) and ${info.promptNodes.length} prompt node(s)`
                  )
                )
              }}
            >
              {t('自動識別節點', 'Auto-detect Nodes')}
            </Button>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t(
              '請在 ComfyUI 設定中開啟「啟用開發模式選項」，點擊選單中的「匯出 (API)」取得 JSON 並貼上於下方。',
              'Enable "Dev mode Options" in ComfyUI Settings, click "Export (API)" in the menu to get the JSON, and paste it below.'
            )}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => void handleExportComfyJson(true)}>
            {t('匯出原始 API', 'Export Original API')}
          </Button>
          <Textarea
            value={apiConfig.comfyuiParams.workflowJson}
            onChange={(e) =>
              updateComfyUiParams({
                workflowPreset: 'custom',
                workflowJson: e.target.value,
              })
            }
            rows={18}
            className="font-mono text-xs leading-relaxed"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
