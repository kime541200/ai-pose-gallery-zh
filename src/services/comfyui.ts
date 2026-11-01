import flux3Template from '@/workflows/flux3-klein-edit.api.json'
import qwenTemplate from '@/workflows/qwen-image-edit-2509.api.json'
import type { ComfyuiParams } from '@/types/gallery'

// ComfyUI API 格式 workflow 節點：{ class_type, inputs }
type ApiNode = { class_type: string; inputs: Record<string, unknown> }
type ApiWorkflow = Record<string, ApiNode>

/** 多圖角色合成工作流預設接受 1–3 張參考圖（人像 / 服裝 / 姿勢）。 */
export const COMFY_MAX_REFERENCE_IMAGES = 3

const QWEN_IMAGE_SLOTS = [
  { load: '10', scale: '13', input: 'image1' },
  { load: '11', scale: '14', input: 'image2' },
  { load: '12', scale: '15', input: 'image3' },
] as const

const FLUX3_IMAGE_SLOTS = [
  { load: '10', input: 'images.image0' },
  { load: '11', input: 'images.image1' },
  { load: '12', input: 'images.image2' },
] as const

export const FLUX3_DEFAULTS = {
  unet: 'flux3-image-klein-int8-convrot.safetensors',
  clip: 'qwen3vl_4b_int8_convrot.safetensors',
  vae: 'flux2-vae.safetensors',
  lora: '',
  steps: 16,
} as const

export const QWEN_EDIT_DEFAULTS = {
  unet: 'qwen-image-edit/Qwen-Image-Edit-2509-Q4_K_M.gguf',
  clip: 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
  vae: 'qwen_image_vae.safetensors',
  lora: 'qwen-image-edit/Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors',
  steps: 4,
} as const

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取 ComfyUI 输出图失败'))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

/**
 * 組出 FLUX 3 Image Klein Distilled 多圖參考 workflow（預設推薦）。
 * - 透過 ReferenceMultiLatent 串接 1–3 張參考圖
 * - 若有指定 poseSlotIndex，該槽位的素體白模圖會先經 DepthAnythingV2 轉為 3D 深度輪廓圖
 */
export function buildFlux3KleinWorkflow(opts: {
  prompt: string
  uploadedNames: string[]
  poseSlotIndex?: number | null
  seed: number
  params: ComfyuiParams
}): ApiWorkflow {
  const { prompt, uploadedNames, poseSlotIndex = null, seed, params } = opts
  if (uploadedNames.length < 1 || uploadedNames.length > COMFY_MAX_REFERENCE_IMAGES) {
    throw new Error(`ComfyUI 工作流需要 1–${COMFY_MAX_REFERENCE_IMAGES} 张参考图（当前 ${uploadedNames.length} 张）`)
  }
  const wf = structuredClone(flux3Template) as unknown as ApiWorkflow
  const isLegacyQwenCfg = params.unet.toLowerCase().includes('qwen')

  wf['1'].inputs.unet_name = isLegacyQwenCfg ? FLUX3_DEFAULTS.unet : params.unet
  wf['2'].inputs.clip_name = isLegacyQwenCfg ? FLUX3_DEFAULTS.clip : params.clip
  wf['3'].inputs.vae_name = isLegacyQwenCfg ? FLUX3_DEFAULTS.vae : params.vae

  FLUX3_IMAGE_SLOTS.forEach((slot, i) => {
    if (i < uploadedNames.length) {
      wf[slot.load].inputs.image = uploadedNames[i]
      wf['17'].inputs[slot.input] = [slot.load, 0]
    } else {
      delete wf[slot.load]
      delete wf['17'].inputs[slot.input]
    }
  })

  if (poseSlotIndex !== null && poseSlotIndex >= 0 && poseSlotIndex < uploadedNames.length) {
    const poseSlot = FLUX3_IMAGE_SLOTS[poseSlotIndex]
    wf['16'].inputs.image = [poseSlot.load, 0]
    wf['17'].inputs[poseSlot.input] = ['16', 0]
  } else {
    delete wf['16']
  }

  wf['6'].inputs.width = params.width
  wf['6'].inputs.height = params.height
  wf['20'].inputs.text = prompt
  wf['21'].inputs.text = params.negativePrompt
  wf['22'].inputs.width = params.width
  wf['22'].inputs.height = params.height
  wf['23'].inputs.seed = seed
  wf['23'].inputs.steps = isLegacyQwenCfg && params.steps === 4 ? FLUX3_DEFAULTS.steps : params.steps
  wf['23'].inputs.cfg = params.cfg
  return wf
}

/**
 * 依參考圖張數、使用者參數，從模板組出 Qwen-Image-Edit-2509 API workflow（備選引擎）。
 * - 未使用的圖片槽（LoadImage / 縮放 / 編碼器輸入）會被移除
 * - 若有指定 poseSlotIndex，該槽位的素體白模圖會先經 DepthAnythingV2 轉為 3D 深度輪廓圖，
 *   抹除白模關節線並完整保留立體朝向、極限透視與雙人交錯結構
 * - lora 為空字串時略過 LoRA（此時請自行設定步數與 cfg）
 */
export function buildQwenEditWorkflow(opts: {
  prompt: string
  uploadedNames: string[]
  poseSlotIndex?: number | null
  seed: number
  params: ComfyuiParams
}): ApiWorkflow {
  const { prompt, uploadedNames, poseSlotIndex = null, seed, params } = opts
  if (uploadedNames.length < 1 || uploadedNames.length > COMFY_MAX_REFERENCE_IMAGES) {
    throw new Error(`ComfyUI 工作流需要 1–${COMFY_MAX_REFERENCE_IMAGES} 张参考图（当前 ${uploadedNames.length} 张）`)
  }
  const wf = structuredClone(qwenTemplate) as unknown as ApiWorkflow
  const isFluxCfg = params.unet.toLowerCase().includes('flux')

  wf['1'].inputs.unet_name = isFluxCfg ? QWEN_EDIT_DEFAULTS.unet : params.unet
  wf['2'].inputs.clip_name = isFluxCfg ? QWEN_EDIT_DEFAULTS.clip : params.clip
  wf['3'].inputs.vae_name = isFluxCfg ? QWEN_EDIT_DEFAULTS.vae : params.vae

  const loraName = isFluxCfg ? QWEN_EDIT_DEFAULTS.lora : params.lora.trim()
  if (loraName) {
    wf['4'].inputs.lora_name = loraName
  } else {
    delete wf['4']
    wf['5'].inputs.model = ['1', 0]
  }

  QWEN_IMAGE_SLOTS.forEach((slot, i) => {
    if (i < uploadedNames.length) {
      wf[slot.load].inputs.image = uploadedNames[i]
      wf[slot.scale].inputs.image = [slot.load, 0]
    } else {
      delete wf[slot.load]
      delete wf[slot.scale]
      delete wf['20'].inputs[slot.input]
      delete wf['21'].inputs[slot.input]
    }
  })

  if (poseSlotIndex !== null && poseSlotIndex >= 0 && poseSlotIndex < uploadedNames.length) {
    const poseSlot = QWEN_IMAGE_SLOTS[poseSlotIndex]
    wf['16'].inputs.image = [poseSlot.load, 0]
    wf[poseSlot.scale].inputs.image = ['16', 0]
  } else {
    delete wf['16']
  }

  wf['20'].inputs.prompt = prompt
  wf['21'].inputs.prompt = params.negativePrompt
  wf['22'].inputs.width = params.width
  wf['22'].inputs.height = params.height
  wf['23'].inputs.seed = seed
  wf['23'].inputs.steps = isFluxCfg && params.steps === 16 ? QWEN_EDIT_DEFAULTS.steps : params.steps
  wf['23'].inputs.cfg = params.cfg
  return wf
}

async function readError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    return (
      j?.error?.message ||
      j?.message ||
      (j?.node_errors && JSON.stringify(j.node_errors).slice(0, 300)) ||
      `HTTP ${res.status}`
    )
  } catch {
    return `HTTP ${res.status}`
  }
}

async function uploadImage(root: string, dataUrl: string, name: string): Promise<string> {
  const fd = new FormData()
  fd.append('image', dataUrlToBlob(dataUrl), name)
  fd.append('type', 'input')
  fd.append('overwrite', 'true')
  const res = await fetch(`${root}/upload/image`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`上传参考图失败：${await readError(res)}`)
  const j = await res.json()
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name
}

/**
 * 經 ComfyUI HTTP API 生圖：上傳參考圖 → POST /prompt → 輪詢 /history → GET /view。
 * 回傳 data URL，方便寫入 IndexedDB 歷史（ComfyUI 清掉 output 後仍可看）。
 */
export async function generateWithComfyUI(opts: {
  baseUrl: string
  model?: string
  prompt: string
  imageDataUrls: string[]
  poseSlotIndex?: number | null
  params: ComfyuiParams
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<string> {
  const root = opts.baseUrl.replace(/\/+$/, '')
  const runId = Date.now().toString(36)

  const uploadedNames: string[] = []
  for (let i = 0; i < opts.imageDataUrls.length; i++) {
    uploadedNames.push(await uploadImage(root, opts.imageDataUrls[i], `pose-gallery_${runId}_${i + 1}.png`))
  }

  const seed = Math.floor(Math.random() * 2 ** 32)
  const useQwen = opts.model === 'qwen-image-edit-2509'
  const workflow = useQwen
    ? buildQwenEditWorkflow({
        prompt: opts.prompt,
        uploadedNames,
        poseSlotIndex: opts.poseSlotIndex ?? null,
        seed,
        params: opts.params,
      })
    : buildFlux3KleinWorkflow({
        prompt: opts.prompt,
        uploadedNames,
        poseSlotIndex: opts.poseSlotIndex ?? null,
        seed,
        params: opts.params,
      })

  const queued = await fetch(`${root}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: `pose-gallery-${runId}` }),
    signal: opts.signal,
  })
  if (!queued.ok) throw new Error(`ComfyUI 拒绝了工作流：${await readError(queued)}`)
  const { prompt_id: promptId } = await queued.json()

  const deadline = Date.now() + (opts.timeoutMs ?? 15 * 60 * 1000)
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
    const h = await fetch(`${root}/history/${promptId}`, { signal: opts.signal })
    if (!h.ok) continue
    const entry = (await h.json())[promptId]
    if (!entry) continue
    if (entry.status?.status_str === 'error') {
      const msg = entry.status.messages?.find((m: unknown[]) => m[0] === 'execution_error')?.[1]
      throw new Error(`ComfyUI 执行失败：${msg?.exception_message || '未知错误'}`)
    }
    const img = entry.outputs?.['25']?.images?.[0]
    if (img) {
      const q = new URLSearchParams({
        filename: img.filename,
        subfolder: img.subfolder || '',
        type: img.type || 'output',
      })
      const view = await fetch(`${root}/view?${q}`, { signal: opts.signal })
      if (!view.ok) throw new Error(`取回生成图失败：${await readError(view)}`)
      return blobToDataUrl(await view.blob())
    }
  }
  throw new Error('等待 ComfyUI 生成超时')
}
