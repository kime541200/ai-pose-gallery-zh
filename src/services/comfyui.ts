import template from '@/workflows/qwen-image-edit-2509.api.json'
import type { ComfyuiParams } from '@/types/gallery'

// ComfyUI API 格式 workflow 節點：{ class_type, inputs }
type ApiNode = { class_type: string; inputs: Record<string, unknown> }
type ApiWorkflow = Record<string, ApiNode>

/** Qwen-Image-Edit-2509 的 TextEncodeQwenImageEditPlus 最多接受 3 張參考圖。 */
export const COMFY_MAX_REFERENCE_IMAGES = 3

const IMAGE_SLOTS = [
  { load: '10', scale: '13', input: 'image1' },
  { load: '11', scale: '14', input: 'image2' },
  { load: '12', scale: '15', input: 'image3' },
] as const

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
 * 依參考圖張數、使用者參數，從模板組出可送出的 API workflow。
 * - 未使用的圖片槽（LoadImage / 縮放 / 編碼器輸入）會被移除
 * - 若有指定 poseSlotIndex，該槽位的素體白模圖會先經 DepthAnythingV2 → DWPose 轉為關鍵點骨架圖，
 *   避免 Qwen-Image-Edit 把白模關節線當成真實人偶線條畫進結果
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
  const wf = structuredClone(template) as unknown as ApiWorkflow

  wf['1'].inputs.unet_name = params.unet
  wf['2'].inputs.clip_name = params.clip
  wf['3'].inputs.vae_name = params.vae

  if (params.lora.trim()) {
    wf['4'].inputs.lora_name = params.lora
  } else {
    delete wf['4']
    wf['5'].inputs.model = ['1', 0]
  }

  IMAGE_SLOTS.forEach((slot, i) => {
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
    const poseSlot = IMAGE_SLOTS[poseSlotIndex]
    wf['16'].inputs.image = [poseSlot.load, 0]
    wf[poseSlot.scale].inputs.image = ['17', 0]
  } else {
    delete wf['16']
    delete wf['17']
  }

  wf['20'].inputs.prompt = prompt
  wf['21'].inputs.prompt = params.negativePrompt
  wf['22'].inputs.width = params.width
  wf['22'].inputs.height = params.height
  wf['23'].inputs.seed = seed
  wf['23'].inputs.steps = params.steps
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
  const workflow = buildQwenEditWorkflow({
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
