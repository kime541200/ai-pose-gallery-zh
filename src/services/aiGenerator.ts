import type { ApiConfig, ExtraReferenceImage, ImageProviderId, RecipeState } from '@/types/gallery'
import { getCurrentLocale, type Locale, tr } from '@/i18n'
import { localizeCostume, localizePortrait, localizePose } from '@/i18n/galleryData'
import { applyWorkflowOverrides, getWorkflowImages, validateReferenceCombinations, workflowIdentity, type ComfyObjectInfo } from '@/lib/comfyWorkflowParameters'
import flux3KleinWorkflow from '@/workflows/flux3-klein-edit.api.json'
import qwen2509DepthWorkflow from '@/workflows/qwen-image-edit-2509.api.json'
import qwen2509ThreeImageWorkflow from '@/workflows/qwen_image_edit_2509_3img.api.json'

export interface ProviderModelOption {
  value: string
  label: string
  labelEn?: string
}

export const PROVIDER_META: Record<
  ImageProviderId,
  {
    id: ImageProviderId
    name: string
    nameEn: string
    shortName: string
    defaultBaseUrl: string
    docUrl: string
    models: ProviderModelOption[]
  }
> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    nameEn: 'Google Gemini',
    shortName: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    docUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
    models: [
      { value: 'gemini-3.1-flash-image-preview', label: 'gemini-3.1-flash-image-preview' },
      { value: 'gemini-3-pro-image-preview', label: 'gemini-3-pro-image-preview' },
      { value: 'gemini-2.5-flash-image', label: 'gemini-2.5-flash-image' },
      { value: 'gemini-2.5-flash-image-preview', label: 'gemini-2.5-flash-image-preview' },
      { value: 'custom', label: '自訂模型 ID', labelEn: 'Custom Model ID' },
    ],
  },
  gpt: {
    id: 'gpt',
    name: 'OpenAI GPT Image',
    nameEn: 'OpenAI GPT Image',
    shortName: 'GPT',
    defaultBaseUrl: 'https://api.openai.com/v1',
    docUrl: 'https://platform.openai.com/docs/guides/image-generation',
    models: [
      { value: 'gpt-image-2.5', label: 'gpt-image-2.5' },
      { value: 'gpt-image-2.5-sunburst', label: 'gpt-image-2.5-sunburst' },
      { value: 'gpt-image-2.5-flare', label: 'gpt-image-2.5-flare' },
      { value: 'gpt-image-2', label: 'gpt-image-2' },
      { value: 'gpt-image-1.5', label: 'gpt-image-1.5' },
      { value: 'gpt-image-1', label: 'gpt-image-1' },
      { value: 'custom', label: '自訂模型 ID', labelEn: 'Custom Model ID' },
    ],
  },
  qwen: {
    id: 'qwen',
    name: '阿里雲百煉 Qwen',
    nameEn: 'Alibaba DashScope Qwen',
    shortName: 'Qwen',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com',
    docUrl: 'https://help.aliyun.com/zh/model-studio/qwen-image-edit-api',
    models: [
      { value: 'qwen-image-3.0-pro', label: 'qwen-image-3.0-pro' },
      { value: 'qwen-image-2.1-pro', label: 'qwen-image-2.1-pro' },
      { value: 'qwen-image-2.1-turbo', label: 'qwen-image-2.1-turbo' },
      { value: 'qwen-image-2.0-pro', label: 'qwen-image-2.0-pro' },
      { value: 'qwen-image-edit-plus', label: 'qwen-image-edit-plus' },
      { value: 'custom', label: '自訂模型 ID', labelEn: 'Custom Model ID' },
    ],
  },
  doubao: {
    id: 'doubao',
    name: '字節火山方舟 Doubao',
    nameEn: 'ByteDance Seedream (Doubao)',
    shortName: 'Doubao',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com',
    docUrl: 'https://www.volcengine.com/docs/82379/1541523',
    models: [
      { value: 'doubao-seedream-5-0', label: 'doubao-seedream-5-0' },
      { value: 'doubao-seedream-5-0-lite', label: 'doubao-seedream-5-0-lite' },
      { value: 'doubao-seedream-4-5-251128', label: 'doubao-seedream-4-5-251128' },
      { value: 'doubao-seedream-4-0-250828', label: 'doubao-seedream-4-0-250828' },
      { value: 'doubao-seededit-3-0-i2i-250628', label: 'doubao-seededit-3-0-i2i-250628' },
      { value: 'custom', label: '自訂模型 ID / Endpoint', labelEn: 'Custom Model ID / Endpoint' },
    ],
  },
  comfyui: {
    id: 'comfyui',
    name: '本地 ComfyUI',
    nameEn: 'Local ComfyUI',
    shortName: 'ComfyUI',
    // 本地开发与 Docker 容器均走 /comfy 同源代理；线上静态站点直连本机 ComfyUI
    defaultBaseUrl: defaultComfyBaseUrl(),
    docUrl: 'https://docs.comfy.org/essentials/comfyui_server',
    models: [
      {
        value: 'flux3-image-klein',
        label: 'FLUX 3 Image Klein Distilled（預設推薦）',
        labelEn: 'FLUX 3 Image Klein Distilled (Recommended)',
      },
      {
        value: 'qwen_image_edit_2509',
        label: 'Qwen-Image-Edit-2509（由工作流決定）',
        labelEn: 'Qwen-Image-Edit-2509 (Defined by workflow)',
      },
      {
        value: 'custom',
        label: '自訂名稱（僅用於記錄顯示）',
        labelEn: 'Custom Name (Display only)',
      },
    ],
  },
}

export function getProviderMeta(id: ImageProviderId, locale: Locale = getCurrentLocale()) {
  const raw = PROVIDER_META[id]
  return {
    ...raw,
    name: locale === 'en' ? raw.nameEn : raw.name,
    models: raw.models.map((m) => ({
      ...m,
      label: locale === 'en' ? m.labelEn || m.label : m.label,
    })),
  }
}

export const STYLE_PRESETS: Record<
  string,
  { label: string; labelEn: string; prompt: string; promptEn: string }
> = {
  none: {
    label: '無預設（跟隨參考圖）',
    labelEn: 'None (Follow Reference Images)',
    prompt: '',
    promptEn: '',
  },
  realistic: {
    label: '寫實人像寫真',
    labelEn: 'Photorealistic Portrait',
    prompt: '寫實商業攝影級質感，85mm 人像鏡頭，自然柔和光影，真實肌膚紋理與織物細節，8k 高清畫質。',
    promptEn:
      'Commercial studio photography quality, 85mm portrait lens, soft natural lighting, realistic skin texture and fabric details, 8K ultra-detailed.',
  },
  fashion: {
    label: '日韓雜誌畫報',
    labelEn: 'Fashion Editorial Lookbook',
    prompt: '日韓時尚穿搭雜誌畫報風格，乾淨極簡攝影棚背景，高級色調，突出人物顏值與服裝剪裁。',
    promptEn:
      'East Asian fashion magazine lookbook editorial, clean minimalist studio backdrop, refined color grading highlighting facial features and tailoring.',
  },
  film: {
    label: '復古膠片寫真',
    labelEn: 'Vintage 35mm Film Photo',
    prompt: '35mm 富士膠片攝影質感，輕微膠片顆粒，柔和復古暖調，自然街拍光影與電影呼吸感。',
    promptEn:
      '35mm Fujifilm analog photography aesthetic, subtle film grain, warm vintage tones, natural candid lighting and cinematic atmosphere.',
  },
  semi_real: {
    label: '2.5D 遊戲原畫立繪',
    labelEn: '2.5D Semi-Realistic Game Art',
    prompt: '2.5D 半寫實高精度遊戲角色原畫，唯美厚塗光影，精緻五官與華麗布料金屬質感。',
    promptEn:
      '2.5D semi-realistic high-detail game character splash art, painterly lighting, refined facial features, and rich fabric and metallic textures.',
  },
  anime: {
    label: '日系二次元插畫',
    labelEn: 'Japanese Anime Illustration',
    prompt: '日系精緻二次元插畫風格，細膩賽璐璐與厚塗光影過渡，動漫角色立繪質感，色彩通透乾淨。',
    promptEn:
      'Refined Japanese anime illustration style, smooth cel-shaded and soft-painted lighting transitions, clean vibrant colors.',
  },
  cel_anime: {
    label: '新海誠感動畫電影',
    labelEn: 'Cinematic Anime Film (Shinkai Style)',
    prompt: '動畫電影級畫面質感，清澈高飽和光影，細膩體積光與髮絲高光，乾淨唯美的動漫色彩。',
    promptEn:
      'Theatrical anime film quality, crisp high-saturation lighting, delicate volumetric rays and hair highlights, vivid atmospheric colors.',
  },
  manga: {
    label: '日式黑白漫畫網點',
    labelEn: 'Monochrome Manga & Screentone',
    prompt: '日本黑白漫畫原稿風格，俐落精準的G筆線稿，細膩漫畫網點紙陰影與層次對比。',
    promptEn:
      'Japanese monochrome manga manuscript style, crisp G-pen ink lineart, detailed screentone shading and dramatic contrast.',
  },
  render3d: {
    label: '3D 次世代角色渲染',
    labelEn: 'Next-Gen 3D Character Render (UE5)',
    prompt: 'Unreal Engine 5 / Octane Render 次世代 3D 角色渲染，細膩次表面散射肌膚材質，電影級布光。',
    promptEn:
      'Unreal Engine 5 / Octane Render next-gen 3D character render, realistic subsurface scattering skin shader, cinematic studio lighting.',
  },
  chibi_box: {
    label: '3D 潮玩公仔質感',
    labelEn: 'PVC Collector Figure Style',
    prompt: '高品質 PVC 塗裝完成品公仔質感，柔和攝影棚柔光箱布光，精緻材質高光與微距景深。',
    promptEn:
      'High-end painted PVC scale figure aesthetic, softbox studio lighting, crisp material specular highlights, macro depth of field.',
  },
  cyberpunk: {
    label: '賽博龐克霓虹',
    labelEn: 'Cyberpunk Neon Sci-Fi',
    prompt: '賽博龐克科幻視覺風格，雨夜霓虹冷暖雙色輪廓光，未來感材質反光與電影級氛圍。',
    promptEn:
      'Cyberpunk sci-fi visual aesthetic, rainy neon warm/cool rim lighting, futuristic reflective materials and cinematic mood.',
  },
  concept_sheet: {
    label: '角色設定集立繪（純白底）',
    labelEn: 'Character Concept Sheet (Pure White BG)',
    prompt: '標準角色設定集全身立繪，純白乾淨無雜物背景，均勻漫反射布光，清晰展示全身服裝結構與配飾細節。',
    promptEn:
      'Full-body character concept art standing portrait on a pure clean white background, even diffused lighting clearly showcasing outfit structure and accessories.',
  },
}

// 按实际传入模型的图片顺序动态生成「图1 / 图2 / 图3...」明确指代，支持附加上传图片
const PHOTO_STYLES = new Set(['realistic', 'fashion', 'film'])

export function buildRecipePrompt(
  recipe: RecipeState,
  stylePreset = 'realistic',
  workflowImages: ExtraReferenceImage[] = [],
  locale: Locale = getCurrentLocale()
): string {
  const styleInfo = STYLE_PRESETS[stylePreset] ?? STYLE_PRESETS.realistic
  const isPhoto = PHOTO_STYLES.has(stylePreset)
  const faceless =
    !recipe.portrait &&
    !workflowImages.some((image) => image.role === 'character_sheet') &&
    Boolean(recipe.costume && recipe.pose)
  const clauses: string[] = []
  let idx = 1
  let costumeIdx = 0

  if (locale === 'en') {
    workflowImages
      .filter((image) => image.role === 'character_sheet')
      .forEach(() => {
        clauses.push(
          '• Character Sheet Reference: The provided character sheet shows multiple angles and details of the SAME character, not multiple people. Keep facial structure, features, hairstyle, hair color, skin tone, and outfit accessories consistent; use it strictly as character reference while following the current workflow output layout.'
        )
        idx++
      })

    if (recipe.portrait) {
      const pLoc = localizePortrait(recipe.portrait, 'en')
      const hairDesc =
        recipe.portrait.发型名称 && recipe.portrait.发型名称 !== '标准基础款' ? pLoc.title : pLoc.hair
      const skin =
        'Skin tone must match the person in Image 1 across all exposed skin (including cutouts), rendered naturally in the target style.'
      const outfit = recipe.costume
        ? ''
        : ' Keep the visible clothing and accessories from Image 1; do not copy the mannequin or outfit from the pose reference.'
      clauses.push(
        recipe.portrait.source === 'upload'
          ? `• Character: Use the person in Image ${idx}, preserving facial structure, features, hairstyle, and hair color. ${skin}${outfit}`
          : `• Character: Use the person in Image ${idx}, preserving facial structure, features, hairstyle (${hairDesc}), and hair color. ${skin}${outfit}`
      )
      idx++
    }
    if (recipe.costume) {
      costumeIdx = idx
      const cLoc = localizeCostume(recipe.costume, 'en')
      clauses.push(
        recipe.costume.source === 'upload'
          ? `• Outfit: Dress the character in the complete outfit and accessories shown in Image ${idx}, matching the exact colors, cut, fabrics, and details of Image ${idx}.`
          : `• Outfit: Dress the character in the complete outfit and accessories shown in Image ${idx} (reference: ${cLoc.name}), matching the exact colors, cut, fabrics, and details of Image ${idx}.`
      )
      idx++
    }
    if (recipe.pose) {
      const poseLoc = localizePose(recipe.pose, 'en')
      const wear = costumeIdx ? `, wearing the outfit from Image ${costumeIdx}` : ''
      const body = isPhoto
        ? `the final subject is a real human with natural skin texture${wear}`
        : `render the subject's skin tone and materials in the target style${wear}`
      clauses.push(
        recipe.pose.source === 'upload'
          ? `• Pose: Follow the body posture, limb placement, and camera angle in Image ${idx}; reference only the pose and composition without copying the appearance or clothing of Image ${idx}, ensuring ${body}.`
          : `• Pose: Strictly follow the body posture, limb placement, and camera perspective in Image ${idx} "${poseLoc.name}" (${poseLoc.angle}); reference only the 3D posture and spatial perspective while ignoring depth-map or white mannequin textures, ensuring ${body}.`
      )
      idx++
    }
    if (faceless) {
      clauses.push(
        '• Faceless Mannequin Display: Generate an adult display figure wearing the reference outfit with a smooth, featureless natural skin-toned face (no eyes, nose, mouth, or specific identity); keep all exposed skin tones consistent instead of copying grey/white mannequin plastic.'
      )
    }
    for (const reference of workflowImages.filter((image) => image.role !== 'character_sheet')) {
      clauses.push(
        `• Workflow Reference: Incorporate relevant elements from Image ${idx} (${reference.name || 'extra reference'}) as required by the workflow.`
      )
      idx++
    }
    for (const extra of recipe.extraImages || []) {
      clauses.push(
        `• Extra Reference: Blend elements, accessories, background, or lighting details from Image ${idx} (${extra.name || 'extra element'}).`
      )
      idx++
    }

    if (clauses.length === 0) {
      return 'Please select a Portrait / Costume / Pose or upload a reference image first.'
    }

    const lines = [
      `Based on the ${
        workflowImages.some((image) => image.role === 'character_sheet')
          ? 'provided character sheet reference'
          : `${idx - 1} reference image(s) provided`
      }, generate a complete ${
        faceless ? 'outfit showcase image' : isPhoto ? 'photorealistic portrait photo' : 'character illustration'
      }:`,
      ...clauses,
    ]
    if (styleInfo.promptEn) {
      lines.push(
        `• Style: ${styleInfo.promptEn} ${
          faceless
            ? 'Balanced body proportions, natural hands, featureless face, unified lighting.'
            : 'Balanced body proportions, natural hands and facial features, unified lighting.'
        }`
      )
    }
    lines.push('No text, logos, or watermarks in the image.')
    return lines.join('\n')
  }

  workflowImages
    .filter((image) => image.role === 'character_sheet')
    .forEach(() => {
      clauses.push(
        '• 角色設定參考：提供的設定集展示同一角色的多個視角與細節，不是多個不同人物。保持角色的臉型、五官、髮型、髮色、膚色及服裝配飾一致；只把它作為角色參考，成品佈局遵循當前工作流的輸出設定。'
      )
      idx++
    })

  if (recipe.portrait) {
    const pLoc = localizePortrait(recipe.portrait, 'zh-TW')
    const hairDesc =
      recipe.portrait.发型名称 && recipe.portrait.发型名称 !== '标准基础款' ? pLoc.title : pLoc.hair
    const skin =
      '人物的膚色必須與圖一人物一致，所有裸露皮膚（包括服裝鏤空處露出的皮膚）必須與臉部膚色統一，統一後的膚色與質感按風格要求呈現。'
    const outfit = recipe.costume ? '' : '保留圖1人物原有可見服裝與配飾，不複製姿勢參考圖的服裝或白模外觀。'
    clauses.push(
      recipe.portrait.source === 'upload'
        ? `• 人物：圖${idx}中的人物，保持其臉型、五官、髮型和髮色一致。${skin}${outfit}`
        : `• 人物：圖${idx}中的人物，保持其臉型、五官、髮型（${hairDesc}）和髮色一致。${skin}${outfit}`
    )
    idx++
  }
  if (recipe.costume) {
    costumeIdx = idx
    const cLoc = localizeCostume(recipe.costume, 'zh-TW')
    clauses.push(
      recipe.costume.source === 'upload'
        ? `• 服裝：讓人物穿上圖${idx}中展示的整套服裝和配飾，每件單品的顏色、款式、面料與配飾都以圖${idx}為準。`
        : `• 服裝：讓人物穿上圖${idx}中展示的整套服裝和配飾（參考名稱：${cLoc.name}），每件單品的顏色、款式、面料與配飾都以圖${idx}為準，名稱僅作輔助說明。`
    )
    idx++
  }
  if (recipe.pose) {
    const poseLoc = localizePose(recipe.pose, 'zh-TW')
    const wear = costumeIdx ? `，穿著圖${costumeIdx}的服裝` : ''
    const body = isPhoto
      ? `最終畫面中的人物是真人，皮膚真實自然${wear}`
      : `人物的膚色與質感按風格要求呈現${wear}`
    clauses.push(
      recipe.pose.source === 'upload'
        ? `• 姿勢：按照圖${idx}中的人物動作和鏡頭角度擺姿勢；僅參考姿勢與構圖，不複製圖${idx}人物的外觀與服裝，${body}。`
        : `• 姿勢：身體姿態、四肢動作與鏡頭透視嚴格遵循圖${idx}「${poseLoc.name}」（${poseLoc.angle}）；僅參考圖${idx}的立體姿態與空間透視，忽略深度圖或素體白模材質，${body}。`
    )
    idx++
  }
  if (faceless) {
    clauses.push(
      '• 無臉展示：生成一位穿著參考服裝的成年展示人物，臉部保持無五官的自然膚色表面，不添加眼睛、鼻子、嘴巴或具體人物身份；全身裸露皮膚的顏色統一，不照搬服裝圖或姿勢圖的灰白人台材質。'
    )
  }
  for (const reference of workflowImages.filter((image) => image.role !== 'character_sheet')) {
    clauses.push(
      `• 工作流參考：參考圖${idx}（${reference.name || '補充參考'}）中的相關元素，具體用途以工作流要求為準。`
    )
    idx++
  }
  for (const extra of recipe.extraImages || []) {
    clauses.push(
      `• 附加參考：融合圖${idx}（${extra.name || '補充元素'}）中的元素、配飾、背景或光影細節。`
    )
    idx++
  }

  if (clauses.length === 0) {
    return '請先選擇人像/服裝/姿勢或上傳附加參考圖。'
  }

  const lines = [
    `請根據${
      workflowImages.some((image) => image.role === 'character_sheet')
        ? '提供的角色設定參考'
        : `提供的 ${idx - 1} 張參考圖`
    }，生成一張完整的${faceless ? '人物穿搭展示圖' : isPhoto ? '真實人物照片' : '人物圖像'}：`,
    ...clauses,
  ]
  if (styleInfo.prompt) {
    lines.push(
      `• 風格：${styleInfo.prompt} ${
        faceless ? '人物比例協調，手部自然，臉部無五官，光影統一。' : '人物比例協調，手部與五官自然，光影統一。'
      }`
    )
  }
  lines.push('畫面中沒有任何文字、標誌或浮水印。')
  return lines.join('\n')
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(tr('讀取檔案失敗', 'Failed to read file')))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxSide = 1024
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error(tr('解析圖片失敗', 'Failed to decode image')))
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(tr(`載入圖片失敗: ${src}`, `Failed to load image: ${src}`)))
    if (src.startsWith('data:') || /^https?:\/\//i.test(src) || src.startsWith('/')) {
      img.src = src
    } else {
      img.src = `/${src}`
    }
  })
}

export async function stitchRecipeCanvas(
  recipe: RecipeState,
  locale: Locale = getCurrentLocale()
): Promise<string> {
  const list: Array<{ tag: string; sub: string; src: string }> = []
  let idx = 1

  if (recipe.portrait) {
    const pLoc = localizePortrait(recipe.portrait, locale)
    list.push({
      tag: locale === 'en' ? `Img ${idx++} · Portrait` : `圖${idx++} · 人像`,
      sub: pLoc.title,
      src: recipe.portrait.原图 || recipe.portrait.缩略图,
    })
  }
  if (recipe.costume) {
    const cLoc = localizeCostume(recipe.costume, locale)
    list.push({
      tag: locale === 'en' ? `Img ${idx++} · Costume` : `圖${idx++} · 服裝`,
      sub: `${cLoc.category} · ${cLoc.name}`,
      src: recipe.costume.预览图 || recipe.costume.原图 || recipe.costume.缩略图,
    })
  }
  if (recipe.pose) {
    const poseLoc = localizePose(recipe.pose, locale)
    list.push({
      tag: locale === 'en' ? `Img ${idx++} · Pose` : `圖${idx++} · 姿勢`,
      sub: `${poseLoc.name}${poseLoc.angle ? ` (${poseLoc.angle})` : ''}`,
      src: recipe.pose.原图 || recipe.pose.缩略图,
    })
  }
  for (const extra of recipe.extraImages || []) {
    list.push({
      tag: locale === 'en' ? `Img ${idx++} · Extra` : `圖${idx++} · 附加`,
      sub: extra.name || (locale === 'en' ? 'Custom Reference' : '自訂參考圖'),
      src: extra.url,
    })
  }

  if (!list.length) {
    throw new Error(tr('請至少選擇或上傳 1 張參考圖', 'Please select or upload at least 1 reference image'))
  }

  const imgs = await Promise.all(list.map((x) => loadImage(x.src)))
  const cardW = 480
  const cardH = 640
  const pad = 20
  const headH = 62
  const canvas = document.createElement('canvas')
  canvas.width = list.length * cardW + (list.length + 1) * pad
  canvas.height = cardH + headH + pad * 2
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#111318'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  imgs.forEach((img, i) => {
    const x = pad + i * (cardW + pad)
    const y = pad
    ctx.fillStyle = '#1e222b'
    ctx.fillRect(x, y, cardW, cardH + headH)
    ctx.fillStyle = '#f4f5f7'
    ctx.fillRect(x, y + headH, cardW, cardH)

    const scale = Math.min(cardW / img.width, cardH / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + (cardW - dw) / 2, y + headH + (cardH - dh) / 2, dw, dh)

    ctx.fillStyle = '#a1a1aa'
    ctx.font = '600 12px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    ctx.fillText(list[i].tag, x + 14, y + 23)

    ctx.fillStyle = '#ffffff'
    ctx.font = '700 15px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    ctx.fillText(list[i].sub.slice(0, 26), x + 14, y + 46)
  })

  return canvas.toDataURL('image/jpeg', 0.92)
}

// 将本地相对路径自动解析为公网可访问的 HTTPS URL
// - 若当前站点已部署在公网 HTTPS 域名，优先使用当前站点 URL
// - 若在 localhost 本地开发，自动映射为三大图库对应的 Cloudflare Pages 公网源站 CDN URL
export function toPublicHttpsUrl(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src
  const clean = src.replace(/^\/+/, '')

  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname)
  ) {
    return `${window.location.origin}/${clean}`
  }

  // 本地开发态自动映射为源站 Cloudflare Pages 公网 HTTPS 地址，方便云端生图接口直接拉取
  if (clean.startsWith('img/portrait/')) {
    const filename = clean.slice('img/portrait/'.length).replace(/\.webp$/i, '.png')
    return `https://ai-portrait-gallery.pages.dev/img/${filename}`
  }
  if (clean.startsWith('thumbs/portrait/')) {
    return `https://ai-portrait-gallery.pages.dev/thumbs/${clean.slice('thumbs/portrait/'.length)}`
  }
  if (clean.startsWith('img/costume/') || clean.startsWith('thumbs/costume/')) {
    return `https://ai-costume-gallery.pages.dev/${clean}`
  }
  return `https://ai-pose-gallery.pages.dev/${clean}`
}

async function srcToPngDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:image/')) return src
  const img = await loadImage(src)
  const maxSide = 1024
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

async function smartFetch(
  targetUrl: string,
  init: RequestInit,
  useProxy: boolean
): Promise<Response> {
  if (!useProxy) {
    return fetch(targetUrl, init)
  }
  const headers = new Headers(init.headers)
  headers.set('x-target-url', targetUrl)
  const proxyRes = await fetch('/api/proxy', {
    method: init.method || 'POST',
    headers,
    body: init.body,
  })
  // 若开启代理时遇到 Cloudflare 网关/SSL 握手错误（如 525/502/504），且上游本身支持 CORS（如第三方中转站），自动降级浏览器直连重试
  if (proxyRes.status === 502 || proxyRes.status === 504 || (proxyRes.status >= 520 && proxyRes.status <= 526)) {
    try {
      return await fetch(targetUrl, init)
    } catch {
      return proxyRes
    }
  }
  return proxyRes
}

function extractUniversalImage(json: any): string | null {
  // 1. OpenAI / Doubao Seedream standard: data[0].b64_json or data[0].url
  if (json?.data?.[0]?.b64_json) return `data:image/png;base64,${json.data[0].b64_json}`
  if (json?.data?.[0]?.url) return json.data[0].url

  // 2. OpenAI Responses API output[].result
  if (Array.isArray(json?.output)) {
    for (const item of json.output) {
      if (item?.type === 'image_generation_call' && item?.result) {
        return `data:image/png;base64,${item.result}`
      }
    }
  }

  // 3. Alibaba DashScope Qwen-Image: output.choices[0].message.content[].image or output.results[0].url
  const dashContent = json?.output?.choices?.[0]?.message?.content
  if (Array.isArray(dashContent)) {
    for (const part of dashContent) {
      if (part?.image) return part.image
    }
  }
  if (json?.output?.results?.[0]?.url) return json.output.results[0].url

  // 4. Google Gemini generateContent: candidates[0].content.parts[].inlineData
  const parts = json?.candidates?.[0]?.content?.parts || []
  for (const p of parts) {
    if (p.inlineData?.data) return `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`
    if (p.inline_data?.data) return `data:${p.inline_data.mime_type || 'image/png'};base64,${p.inline_data.data}`
  }

  // 5. OpenAI Chat Completions multimodal / markdown image
  const msg = json?.choices?.[0]?.message
  if (Array.isArray(msg?.images) && msg.images[0]?.image_url?.url) return msg.images[0].image_url.url
  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) {
      if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url
      if (part.inlineData?.data) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
    }
  }
  const text = typeof msg?.content === 'string' ? msg.content : ''
  const mdMatch = text.match(/!\[.*?\]\((data:image\/[^)]+|https?:\/\/[^\s)]+)\)/)
  if (mdMatch) return mdMatch[1]
  const urlMatch = text.match(/(https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp)[^\s"'<>]*)/i)
  if (urlMatch) return urlMatch[1]

  return null
}

// ============================================================================
// 本地 ComfyUI API 工作流模板与节点解析工具
// ============================================================================

type ComfyNode = { class_type: string; inputs: Record<string, any>; _meta?: { title?: string; studio?: { imageRole?: string; optionalSlot?: boolean; hiddenInputs?: string[] } } }
type ComfyWorkflow = Record<string, ComfyNode>

export type ComfyPresetId =
  | 'flux3_klein'
  | 'qwen2509_depth'
  | 'qwen2509_3img'
  | 'qwen2509_2img'
  | 'qwen21_3img'
  | 'qwen21_2img'

export interface ComfyNodeMappings {
  promptNodeId: string
  portraitNodeId: string
  costumeNodeId: string
  poseNodeId: string
  stitchedNodeId: string
}

/** 本地开发 / Docker nginx 使用的同源代理前缀，可绕开 ComfyUI 的 CORS 白名单限制 */
export const COMFY_DEV_PROXY = '/comfy'

export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return true
  const h = window.location.hostname
  return !h.endsWith('.anhao.app') && !h.endsWith('.pages.dev')
}

/** 自托管（Docker / Vite dev）默认走 /comfy 同源代理；公共托管静态站直连本机 8188 / 8000 */
// 注意：PROVIDER_META 在模块初始化时就会调用本函数，这里不能引用后面定义的 const
export function defaultComfyBaseUrl(): string {
  return isLocalDevHost() ? '/comfy' : 'http://127.0.0.1:8188'
}

export function comfyCandidateUrls(current = ''): string[] {
  const list = [
    current.trim(),
    isLocalDevHost() ? defaultComfyBaseUrl() : '',
    'http://127.0.0.1:8188',
    'http://127.0.0.1:8000',
  ]
    .map((x) => x.replace(/\/+$/, ''))
    .filter(Boolean)
  return Array.from(new Set(list))
}

function cloneWorkflow<T>(wf: T): T {
  return JSON.parse(JSON.stringify(wf))
}

// 双图版：图1 = 人物（含服装），图2 = 姿势（姿势图只送入视觉语言编码器，不作为像素参考）
function buildQwen2509TwoImage(): ComfyWorkflow {
  const wf = cloneWorkflow(qwen2509ThreeImageWorkflow) as ComfyWorkflow
  for (const id of ['2', '22', '23', '25', '27']) delete wf[id]
  wf['1']._meta = { title: '图1：人物/服装参考 (Person)' }
  wf['3']._meta = { title: '图2：姿势参考 (Pose)' }
  for (const id of ['12', '13']) {
    wf[id].inputs.image2 = ['3', 0]
    delete wf[id].inputs.image3
  }
  wf['14'].inputs.positive = ['24', 0]
  wf['14'].inputs.negative = ['26', 0]
  return wf
}

// 旧版 Qwen-Image 2.1 预设（需要另行安装 2.1 模型；默认已改用本机可用的 Edit 2509）
function buildQwen21Workflow(threeImages: boolean): ComfyWorkflow {
  const wf: ComfyWorkflow = {
    '1': {
      inputs: { image: 'portrait_ref.png' },
      class_type: 'LoadImage',
      _meta: { title: threeImages ? '图1：人像参考 (Portrait)' : '图2：人物/服装参考图 (Person)' },
    },
    '4': {
      inputs: { unet_name: 'image2image/qwen_image_2.1_bf16.safetensors', weight_dtype: 'default' },
      class_type: 'UNETLoader',
      _meta: { title: '加载 Qwen Image 2.1 基础模型' },
    },
    '5': {
      inputs: {
        model: ['4', 0],
        lora_name: 'qwen2.1/动作编辑VNCCS_QI2_PoseStudioV2_3294845.safetensors',
        strength_model: 1.0,
      },
      class_type: 'LoraLoaderModelOnly',
      _meta: { title: '加载姿态编辑 LoRA 适配器 (Qwen 2.1 专用)' },
    },
    '6': {
      inputs: { device: 'auto', dtype: 'default', model: ['5', 0] },
      class_type: 'QwenImage21Cache',
      _meta: { title: 'Qwen Image 2.1 条件缓存' },
    },
    '7': {
      inputs: { clip_name: 'text_encoders/qwen3vl_8b_bf16.safetensors', type: 'qwen_image', device: 'default' },
      class_type: 'CLIPLoader',
      _meta: { title: '加载 Qwen3-VL 8B 编码器' },
    },
    '8': {
      inputs: { vae_name: 'vae/qwen_image_2.1_vae_bf16.safetensors' },
      class_type: 'VAELoader',
      _meta: { title: '加载 Qwen Image 2.1 VAE' },
    },
    '9': {
      inputs: {
        prompt: '',
        negative_prompt: '',
        resolution: 1024,
        clip: ['7', 0],
        vae: ['8', 0],
      },
      class_type: 'TextEncodeQwenImage21',
      _meta: { title: '正向提示词与多图编码 (Qwen 2.1)' },
    },
    '10': {
      inputs: {
        seed: 20261031,
        steps: 25,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['6', 0],
        positive: ['9', 0],
        negative: ['9', 1],
        latent_image: ['9', 2],
      },
      class_type: 'KSampler',
      _meta: { title: 'KSampler 采样器' },
    },
    '11': {
      inputs: { samples: ['10', 0], vae: ['8', 0] },
      class_type: 'VAEDecode',
      _meta: { title: 'VAE 解码' },
    },
    '12': {
      inputs: { filename_prefix: 'pose_studio/result', images: ['11', 0] },
      class_type: 'SaveImage',
      _meta: { title: '保存生成结果' },
    },
  }
  if (threeImages) {
    wf['2'] = { inputs: { image: 'costume_ref.png' }, class_type: 'LoadImage', _meta: { title: '图2：服装参考 (Costume)' } }
    wf['3'] = { inputs: { image: 'pose_ref.png' }, class_type: 'LoadImage', _meta: { title: '图3：姿势参考 (Pose)' } }
    Object.assign(wf['9'].inputs, { 'images.image_1': ['1', 0], 'images.image_2': ['2', 0], 'images.image_3': ['3', 0] })
  } else {
    wf['2'] = { inputs: { image: 'pose_reference.png' }, class_type: 'LoadImage', _meta: { title: '图1：姿势参考图 (Pose)' } }
    Object.assign(wf['9'].inputs, { 'images.image_1': ['2', 0], 'images.image_2': ['1', 0] })
  }
  return wf
}

export const DEFAULT_COMFY_PRESET: ComfyPresetId = 'flux3_klein'

export const COMFYUI_WORKFLOW_TEMPLATES: Record<
  ComfyPresetId,
  { label: string; labelEn: string; workflow: ComfyWorkflow; defaults: ComfyNodeMappings }
> = {
  flux3_klein: {
    label: 'FLUX 3 Image Klein Distilled 三圖合成（3D 深度姿態）· 預設推薦',
    labelEn: 'FLUX 3 Image Klein Distilled · 3-Image Synthesis (3D Depth Pose) · Recommended',
    workflow: flux3KleinWorkflow as ComfyWorkflow,
    defaults: { promptNodeId: '20', portraitNodeId: '10', costumeNodeId: '11', poseNodeId: '12', stitchedNodeId: 'none' },
  },
  qwen2509_depth: {
    label: 'Qwen-Image-Edit-2509 三圖合成（GGUF + 3D 深度姿態）',
    labelEn: 'Qwen-Image-Edit-2509 · 3-Image Synthesis (GGUF + 3D Depth Pose)',
    workflow: qwen2509DepthWorkflow as ComfyWorkflow,
    defaults: { promptNodeId: '20', portraitNodeId: '10', costumeNodeId: '11', poseNodeId: '12', stitchedNodeId: 'none' },
  },
  qwen2509_3img: {
    label: 'Qwen Image Edit 2509 三圖合成（FP8 原生直傳）',
    labelEn: 'Qwen Image Edit 2509 · 3-Image Synthesis (FP8 Native)',
    workflow: qwen2509ThreeImageWorkflow as ComfyWorkflow,
    defaults: { promptNodeId: '12', portraitNodeId: '1', costumeNodeId: '2', poseNodeId: '3', stitchedNodeId: 'none' },
  },
  qwen2509_2img: {
    label: 'Qwen Image Edit 2509 雙圖姿態遷移（人物+姿勢）',
    labelEn: 'Qwen Image Edit 2509 · 2-Image Pose Transfer (Person + Pose)',
    workflow: buildQwen2509TwoImage(),
    defaults: { promptNodeId: '12', portraitNodeId: '1', costumeNodeId: 'none', poseNodeId: '3', stitchedNodeId: 'none' },
  },
  qwen21_3img: {
    label: 'Qwen-Image 2.1 三圖合成（需另裝 2.1 模型）',
    labelEn: 'Qwen-Image 2.1 · 3-Image Synthesis (Requires 2.1 Models)',
    workflow: buildQwen21Workflow(true),
    defaults: { promptNodeId: '9', portraitNodeId: '1', costumeNodeId: '2', poseNodeId: '3', stitchedNodeId: 'none' },
  },
  qwen21_2img: {
    label: 'Qwen-Image 2.1 雙圖姿態遷移（需另裝 2.1 模型）',
    labelEn: 'Qwen-Image 2.1 · 2-Image Pose Transfer (Requires 2.1 Models)',
    workflow: buildQwen21Workflow(false),
    defaults: { promptNodeId: '9', portraitNodeId: '1', costumeNodeId: 'none', poseNodeId: '2', stitchedNodeId: 'none' },
  },
}

export interface ComfyParsedNodes {
  valid: boolean
  isUiFormat: boolean
  error?: string
  imageNodes: Array<{ id: string; title: string; classType: string; currentImage: string; emptyValue?: string; role?: 'character_sheet' }>
  promptNodes: Array<{ id: string; title: string; classType: string; field: string }>
}

export function parseComfyWorkflowNodes(workflowJson: string): ComfyParsedNodes {
  if (!workflowJson.trim()) {
    return {
      valid: false,
      isUiFormat: false,
      error: tr('工作流 JSON 為空', 'Workflow JSON is empty'),
      imageNodes: [],
      promptNodes: [],
    }
  }
  try {
    const parsed = JSON.parse(workflowJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        isUiFormat: false,
        error: tr('無效的 JSON 物件', 'Invalid JSON object'),
        imageNodes: [],
        promptNodes: [],
      }
    }
    if (Array.isArray(parsed.nodes) && Array.isArray(parsed.links)) {
      return {
        valid: false,
        isUiFormat: true,
        error: tr(
          '檢測到普通畫布格式 JSON，請在 ComfyUI 中使用「工作流 → 匯出 (API)」取得 API 格式 JSON',
          'Detected UI canvas JSON format. Please use "Workflow → Export (API)" in ComfyUI to export API format JSON.'
        ),
        imageNodes: [],
        promptNodes: [],
      }
    }

    const imageNodes: ComfyParsedNodes['imageNodes'] = []
    const promptNodes: ComfyParsedNodes['promptNodes'] = []

    for (const [id, node] of Object.entries<any>(parsed)) {
      if (!node || typeof node !== 'object' || !node.class_type) continue
      const classType = String(node.class_type)
      const title = String(node._meta?.title || classType)
      const inputs = node.inputs || {}

      if (classType === 'LoadImage' || typeof inputs.image === 'string') {
        const emptyValue =
          classType === 'LoadImageGoohai'
            ? '无'
            : node._meta?.studio?.optionalSlot
              ? ''
              : undefined
        imageNodes.push({
          id,
          title,
          classType,
          currentImage: String(inputs.image || ''),
          ...(emptyValue !== undefined ? { emptyValue } : {}),
          ...(node._meta?.studio?.imageRole === 'character_sheet' ? { role: 'character_sheet' as const } : {}),
        })
      }

      for (const field of ['prompt', 'text', 'string', 'positive']) {
        if (Array.isArray(node._meta?.studio?.hiddenInputs) && node._meta.studio.hiddenInputs.includes(field)) continue
        if (typeof inputs[field] === 'string') {
          promptNodes.push({ id, title, classType, field })
          break
        }
      }
    }

    if (imageNodes.length === 0 && promptNodes.length === 0) {
      return {
        valid: false,
        isUiFormat: false,
        error: tr('未在 JSON 中找到任何 ComfyUI 節點', 'No ComfyUI nodes found in JSON'),
        imageNodes,
        promptNodes,
      }
    }
    return { valid: true, isUiFormat: false, imageNodes, promptNodes }
  } catch (err: any) {
    return {
      valid: false,
      isUiFormat: false,
      error: tr(
        `JSON 解析失敗: ${err?.message || '語法錯誤'}`,
        `Failed to parse JSON: ${err?.message || 'Syntax error'}`
      ),
      imageNodes: [],
      promptNodes: [],
    }
  }
}

export function autoDetectComfyMappings(workflowJson: string): ComfyNodeMappings {
  const parsed = parseComfyWorkflowNodes(workflowJson)
  let promptNodeId = 'none'
  let portraitNodeId = 'none'
  let costumeNodeId = 'none'
  let poseNodeId = 'none'
  let stitchedNodeId = 'none'

  const posPrompt =
    parsed.promptNodes.find((n) => !/negative|反向|负面/i.test(n.title)) || parsed.promptNodes[0]
  if (posPrompt) promptNodeId = posPrompt.id

  const usedIds = new Set<string>()
  const slotImages = parsed.imageNodes.filter((node) => node.role !== 'character_sheet')
  for (const n of slotImages) {
    if (/人像|脸|人物|portrait|face|person/i.test(n.title) && portraitNodeId === 'none') {
      portraitNodeId = n.id
      usedIds.add(n.id)
    } else if (/服装|衣|穿搭|costume|cloth|outfit/i.test(n.title) && costumeNodeId === 'none') {
      costumeNodeId = n.id
      usedIds.add(n.id)
    } else if (/姿势|动作|骨架|pose/i.test(n.title) && poseNodeId === 'none') {
      poseNodeId = n.id
      usedIds.add(n.id)
    } else if (/拼图|合成|stitch/i.test(n.title) && stitchedNodeId === 'none') {
      stitchedNodeId = n.id
      usedIds.add(n.id)
    }
  }

  const remaining = slotImages.filter((n) => !usedIds.has(n.id))
  if (portraitNodeId === 'none' && remaining[0]) portraitNodeId = remaining.shift()!.id
  if (costumeNodeId === 'none' && remaining[0]) costumeNodeId = remaining.shift()!.id
  if (poseNodeId === 'none' && remaining[0]) poseNodeId = remaining.shift()!.id

  return { promptNodeId, portraitNodeId, costumeNodeId, poseNodeId, stitchedNodeId }
}

// ---------------------------------------------------------------------------
// 网络请求与中文错误
// ---------------------------------------------------------------------------

function normalizeComfyBase(baseUrl: string): string {
  return (baseUrl.trim() || defaultComfyBaseUrl()).replace(/\/+$/, '')
}

function describeComfyNetworkError(baseUrl: string, timedOut: boolean): string {
  if (timedOut) {
    return tr(
      `[ComfyUI] 請求 ${baseUrl} 逾時：ComfyUI 可能正忙或無回應，請查看 ComfyUI 終端機日誌。`,
      `[ComfyUI] Request to ${baseUrl} timed out: ComfyUI may be busy or unresponsive, please check ComfyUI terminal logs.`
    )
  }
  if (baseUrl.startsWith('/')) {
    return tr(
      `[ComfyUI] 本機代理 ${baseUrl} 無法連通 ComfyUI：請確認 ComfyUI 已啟動，且連接埠與啟動網頁時的 COMFYUI_URL 一致（預設 http://127.0.0.1:8000）。`,
      `[ComfyUI] Local proxy ${baseUrl} could not reach ComfyUI: please verify ComfyUI is running and matches COMFYUI_URL (default http://127.0.0.1:8000).`
    )
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const reasons = [
    tr(
      `① ComfyUI 未啟動，或位址/連接埠不對（Desktop 版預設 8000，便攜版預設 8188）`,
      `① ComfyUI is not running, or the URL/port is wrong (Desktop default 8000, Portable default 8188)`
    ),
    tr(
      `② 跨域 (CORS) 被攔截：ComfyUI 啟動參數需包含 --enable-cors-header "${origin}"（該參數只能填一個來源）`,
      `② Blocked by CORS: ComfyUI startup flags must include --enable-cors-header "${origin}" (only one origin allowed)`
    ),
  ]
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    reasons.push(
      tr(
        '③ 瀏覽器「本地網路存取」權限被拒絕：請點擊網址列左側圖示允許存取本機裝置',
        '③ Browser "Local Network Access" permission denied: click the icon next to the address bar to allow local device access'
      )
    )
    if (/^http:/i.test(baseUrl) && !/\/\/(127\.0\.0\.1|localhost|\[::1\])/i.test(baseUrl)) {
      reasons.push(
        tr(
          '④ HTTPS 頁面不能存取區域網路 HTTP 位址（混合內容限制），請改用 127.0.0.1 或本機執行本站',
          '④ HTTPS pages cannot access LAN HTTP addresses (mixed content restriction); use 127.0.0.1 or run this site locally'
        )
      )
    }
  }
  return tr(
    `[ComfyUI] 無法連線 ${baseUrl}。可能原因：\n${reasons.join('\n')}`,
    `[ComfyUI] Cannot connect to ${baseUrl}. Possible causes:\n${reasons.join('\n')}`
  )
}

async function comfyFetch(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  apiKey = '',
  timeoutMs = 30000
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (apiKey.trim()) headers.set('Authorization', `Bearer ${apiKey.trim()}`)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: ctrl.signal })
  } catch (e: any) {
    throw new Error(describeComfyNetworkError(baseUrl, e?.name === 'AbortError'))
  } finally {
    clearTimeout(timer)
  }
  // 开发代理连不上后端时会返回非 JSON 的 5xx
  if (
    baseUrl.startsWith('/') &&
    res.status >= 500 &&
    !(res.headers.get('content-type') || '').includes('json')
  ) {
    throw new Error(describeComfyNetworkError(baseUrl, false))
  }
  return res
}

async function readJsonSafe(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text.slice(0, 300) }
  }
}

export async function testComfyConnection(baseUrl: string, apiKey = ''): Promise<string> {
  const cleanUrl = normalizeComfyBase(baseUrl)
  const res = await comfyFetch(cleanUrl, '/system_stats', {}, apiKey, 8000)
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      tr(
        `[ComfyUI] ${cleanUrl} 拒絕存取 (HTTP ${res.status})，請檢查 API Key / 驗證設定`,
        `[ComfyUI] ${cleanUrl} access denied (HTTP ${res.status}), please check API Key / auth settings`
      )
    )
  }
  if (!res.ok)
    throw new Error(
      tr(
        `[ComfyUI] ${cleanUrl}/system_stats 回傳 HTTP ${res.status}，該位址可能不是 ComfyUI`,
        `[ComfyUI] ${cleanUrl}/system_stats returned HTTP ${res.status}; this URL may not be ComfyUI`
      )
    )
  const data = await readJsonSafe(res)
  if (!data?.system)
    throw new Error(
      tr(
        `[ComfyUI] ${cleanUrl} 的回應不是 ComfyUI 格式，請檢查位址`,
        `[ComfyUI] Response from ${cleanUrl} is not in ComfyUI format, please check the URL`
      )
    )
  const ver = data.system.comfyui_version || tr('未知版本', 'Unknown version')
  const dev = data.devices?.[0]
  const gpu = dev?.name
    ? String(dev.name).replace(/^cuda:\d+\s*/, '').replace(/\s*:\s*\w+$/, '')
    : tr('本機裝置', 'Local device')
  const vram = dev?.vram_total
    ? tr(` · 顯存 ${(dev.vram_total / 1024 ** 3).toFixed(1)} GB`, ` · VRAM ${(dev.vram_total / 1024 ** 3).toFixed(1)} GB`)
    : ''
  return `ComfyUI ${ver} · ${gpu}${vram}`
}

/** 依次尝试候选地址，返回第一个可用的 ComfyUI 地址 */
export async function detectComfyUi(
  current = '',
  apiKey = ''
): Promise<{ baseUrl: string; info: string } | null> {
  for (const url of comfyCandidateUrls(current)) {
    try {
      const info = await testComfyConnection(url, apiKey)
      return { baseUrl: url, info }
    } catch {
      /* try next */
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 工作流与本机模型/节点匹配检测（基于 /object_info）
// ---------------------------------------------------------------------------

export interface ComfyCheckResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  fixes: string[]
  /** 自动修正模型路径后的工作流 JSON（无修正时为 undefined） */
  fixedJson?: string
}

function comboOptions(spec: any): string[] | null {
  if (!Array.isArray(spec)) return null
  if (Array.isArray(spec[0])) return spec[0].map(String)
  if (spec[0] === 'COMBO' && Array.isArray(spec[1]?.options)) return spec[1].options.map(String)
  return null
}

const baseName = (s: string) => s.split(/[\\/]/).pop()!.toLowerCase()

export async function fetchComfyObjectInfo(baseUrl: string, apiKey: string, workflowJson: string): Promise<ComfyObjectInfo> {
  const parsed = parseComfyWorkflowNodes(workflowJson)
  if (!parsed.valid) throw new Error(parsed.error || tr('工作流 JSON 無效', 'Invalid workflow JSON'))
  const workflow: ComfyWorkflow = JSON.parse(workflowJson)
  const base = normalizeComfyBase(baseUrl)
  const classes = Array.from(new Set(Object.values(workflow).map((node) => node.class_type).filter(Boolean)))
  const entries = await Promise.all(classes.map(async (cls) => {
    const res = await comfyFetch(base, `/object_info/${encodeURIComponent(cls)}`, {}, apiKey, 15000)
    if (!res.ok)
      throw new Error(
        tr(
          `[ComfyUI] 無法讀取節點「${cls}」的定義（HTTP ${res.status}），請檢查連線位址、存取權杖和閘道介面權限。`,
          `[ComfyUI] Failed to read definition for node "${cls}" (HTTP ${res.status}); please check connection URL, access token, and gateway permissions.`
        )
      )
    const json = await readJsonSafe(res)
    return [cls, json?.[cls]] as const
  }))
  return Object.fromEntries(entries.filter(([, definition]) => definition))
}

export async function checkComfyWorkflow(
  baseUrl: string,
  apiKey: string,
  workflowJson: string,
  mappedImageNodeIds: string[] = [],
  objectInfo?: ComfyObjectInfo
): Promise<ComfyCheckResult> {
  const parsedInfo = parseComfyWorkflowNodes(workflowJson)
  if (!parsedInfo.valid) {
    return { ok: false, errors: [parsedInfo.error || tr('工作流 JSON 無效', 'Invalid workflow JSON')], warnings: [], fixes: [] }
  }
  const wf: ComfyWorkflow = JSON.parse(workflowJson)
  const info = objectInfo ?? await fetchComfyObjectInfo(baseUrl, apiKey, workflowJson)

  const errors: string[] = []
  const warnings: string[] = []
  const fixes: string[] = []
  const mapped = new Set(mappedImageNodeIds.filter((x) => x && x !== 'none'))
  const imageLoaders = new Set(getWorkflowImages(workflowJson, [], info).map((node) => node.nodeId))

  for (const [id, node] of Object.entries(wf)) {
    if (!node?.class_type) continue
    const title = node._meta?.title || node.class_type
    const def = info[node.class_type]
    if (!def) {
      errors.push(
        tr(
          `缺少節點「${node.class_type}」（節點 ${id}：${title}）。請在 ComfyUI Manager 安裝對應的自訂節點，或升級 ComfyUI。`,
          `Missing node "${node.class_type}" (Node ${id}: ${title}). Please install the custom node via ComfyUI Manager or upgrade ComfyUI.`
        )
      )
      continue
    }
    const required = def.input?.required || {}
    const optional = def.input?.optional || {}
    const inputs = node.inputs || {}

    for (const [name, spec] of Object.entries<any>(required)) {
      // V3 自动扩展组使用 images.image_1 等扁平输入，组名本身不参与执行。
      if (spec?.[0] === 'COMFY_AUTOGROW_V3') {
        const template = spec[1]?.template
        if (template?.input?.required) {
          for (let i = 0; i < (template.min ?? 0); i++) {
            const child = template.names?.[i] ?? `${template.prefix}${i}`
            if (!(`${name}.${child}` in inputs)) {
              errors.push(
                tr(
                  `節點 ${id}「${title}」缺少必填輸入 ${name}.${child}`,
                  `Node ${id} "${title}" is missing required input ${name}.${child}`
                )
              )
            }
          }
        }
        continue
      }
      if (!(name in inputs))
        errors.push(
          tr(`節點 ${id}「${title}」缺少必填輸入 ${name}`, `Node ${id} "${title}" is missing required input ${name}`)
        )
    }

    for (const [name, value] of Object.entries(inputs)) {
      if (Array.isArray(value)) continue // 节点连线
      const spec = required[name] ?? optional[name]
      const options = comboOptions(spec)
      if (!options || typeof value !== 'string') continue
      if (name === 'image' && mapped.has(id) && imageLoaders.has(id)) continue
      if (node.class_type === 'LoadImage' && name === 'image') {
        if (!mapped.has(id) && !options.includes(value)) {
          warnings.push(
            tr(
              `節點 ${id}「${title}」引用的圖片 ${value} 不在 ComfyUI input 目錄中，且未映射到人像/服裝/姿勢槽位`,
              `Image "${value}" referenced by Node ${id} "${title}" is not in ComfyUI input directory and not mapped to portrait/costume/pose slots`
            )
          )
        }
        continue
      }
      if (options.includes(value)) continue
      const sameFile = options.find((o) => baseName(o) === baseName(value))
      if (sameFile) {
        inputs[name] = sameFile
        fixes.push(
          tr(
            `節點 ${id}「${title}」${name}：${value} → ${sameFile}（自動修正路徑）`,
            `Node ${id} "${title}" ${name}: ${value} → ${sameFile} (auto-corrected path)`
          )
        )
        continue
      }
      const sample = options.slice(0, 12).join(tr('、', ', '))
      errors.push(
        tr(
          `節點 ${id}「${title}」的 ${name} = ${value} 在本機不存在（通常是模型檔案未安裝或路徑不同）。本機可選：${sample || '（空）'}${options.length > 12 ? ' …' : ''}`,
          `Node ${id} "${title}" has ${name} = ${value} which does not exist locally (model file not installed or different path). Available locally: ${sample || '(empty)'}${options.length > 12 ? ' …' : ''}`
        )
      )
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    fixes,
    fixedJson: fixes.length ? JSON.stringify(wf, null, 2) : undefined,
  }
}

function translateNodeError(er: any): string {
  const detail = er?.details ? `（${er.details}）` : ''
  switch (er?.type) {
    case 'value_not_in_list':
      return tr(
        `${er.extra_info?.input_name ?? '輸入'} 的值不在本機可選列表中${detail}——通常是模型檔案不存在或路徑不同`,
        `Value of ${er.extra_info?.input_name ?? 'input'} is not in local available list${detail} — usually model file missing or path differs`
      )
    case 'required_input_missing':
      return tr(
        `缺少必填輸入 ${er.extra_info?.input_name ?? ''}`,
        `Missing required input ${er.extra_info?.input_name ?? ''}`
      )
    case 'invalid_input_type':
    case 'return_type_mismatch':
      return tr(`節點連線類型不匹配${detail}`, `Node connection type mismatch${detail}`)
    case 'value_bigger_than_max':
    case 'value_smaller_than_min':
      return tr(`參數超出範圍${detail}`, `Parameter out of range${detail}`)
    case 'image_not_found':
    case 'custom_validation_failed':
      return `${er.message || tr('校驗失敗', 'Validation failed')}${detail}`
    default:
      return `${er?.message || tr('校驗失敗', 'Validation failed')}${detail}`
  }
}

function formatComfyPromptError(json: any, wf: ComfyWorkflow, status: number): string {
  const parts: string[] = []
  const e = json?.error
  if (e) {
    if (e.type === 'missing_node_type' || /does not exist|not found/i.test(String(e.message))) {
      parts.push(
        tr(
          `缺少節點類型：${e.details || e.message}。請在 ComfyUI Manager 安裝缺失的自訂節點或升級 ComfyUI`,
          `Missing node type: ${e.details || e.message}. Please install the missing custom node via ComfyUI Manager or upgrade ComfyUI`
        )
      )
    } else if (e.type === 'prompt_no_outputs') {
      parts.push(
        tr('工作流沒有輸出節點（SaveImage / PreviewImage）', 'Workflow has no output node (SaveImage / PreviewImage)')
      )
    } else if (e.type !== 'prompt_outputs_failed_validation') {
      parts.push(`${e.message || e.type}${e.details ? `：${e.details}` : ''}`)
    }
  }
  for (const [id, ne] of Object.entries<any>(json?.node_errors || {})) {
    const title = wf[id]?._meta?.title || ne?.class_type || id
    for (const er of ne?.errors || []) {
      parts.push(tr(`節點 ${id}「${title}」：${translateNodeError(er)}`, `Node ${id} "${title}": ${translateNodeError(er)}`))
    }
  }
  if (!parts.length) parts.push(json?._raw || `HTTP ${status}`)
  return tr(`[ComfyUI] 提交工作流失敗：\n${parts.join('\n')}`, `[ComfyUI] Failed to submit workflow:\n${parts.join('\n')}`)
}

async function freeComfyMemory(baseUrl: string, apiKey: string): Promise<void> {
  try {
    await comfyFetch(
      baseUrl,
      '/free',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unload_models: true, free_memory: true }),
      },
      apiKey,
      10000
    )
  } catch {
    /* ignore */
  }
}

function formatExecutionError(messages: any[], wf: ComfyWorkflow): { text: string; oom: boolean } {
  const errMsg = (messages || []).find((m) => m?.[0] === 'execution_error')?.[1]
  if (errMsg) {
    const title = wf[errMsg.node_id]?._meta?.title || errMsg.node_type || errMsg.node_id
    const raw = `${errMsg.exception_type || ''} ${errMsg.exception_message || ''}`
    if (/out of memory|OutOfMemory|CUDA error: out of memory|allocat/i.test(raw)) {
      return {
        oom: true,
        text: tr(
          `[ComfyUI] 顯存不足（節點 ${errMsg.node_id}「${title}」）。已請求 ComfyUI 釋放顯存。\n` +
            '建議：關閉其他佔用顯示卡的程式；在工作流中把「按姿勢圖比例確定輸出尺寸」節點的 megapixels 從 1.0 調低到 0.6；然後重試。',
          `[ComfyUI] Out of VRAM (Node ${errMsg.node_id} "${title}"). Requested ComfyUI to free VRAM.\n` +
            'Tip: Close other GPU-heavy apps, or lower megapixels from 1.0 to 0.6 in the output size node, then retry.'
        ),
      }
    }
    return {
      oom: false,
      text: tr(
        `[ComfyUI] 執行出錯（節點 ${errMsg.node_id}「${title}」）：${String(errMsg.exception_message || raw).trim().slice(0, 400)}`,
        `[ComfyUI] Execution error (Node ${errMsg.node_id} "${title}"): ${String(errMsg.exception_message || raw).trim().slice(0, 400)}`
      ),
    }
  }
  if ((messages || []).some((m) => m?.[0] === 'execution_interrupted')) {
    return {
      oom: false,
      text: tr(
        '[ComfyUI] 任務已被中斷（可能在 ComfyUI 介面中點擊了取消）',
        '[ComfyUI] Task was interrupted (possibly cancelled in ComfyUI UI)'
      ),
    }
  }
  return {
    oom: false,
    text: tr(
      `[ComfyUI] 工作流執行出錯：${JSON.stringify(messages || '').slice(0, 300)}`,
      `[ComfyUI] Workflow execution error: ${JSON.stringify(messages || '').slice(0, 300)}`
    ),
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(tr('讀取生成結果失敗', 'Failed to read generated image')))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

async function uploadImageToComfy(
  baseUrl: string,
  src: string,
  filenamePrefix: string,
  apiKey: string
): Promise<string> {
  let dataUrl: string
  try {
    dataUrl = await srcToPngDataUrl(src)
  } catch {
    throw new Error(tr(`讀取參考圖失敗：${src.slice(0, 80)}`, `Failed to read reference image: ${src.slice(0, 80)}`))
  }
  const form = new FormData()
  form.append('image', dataUrlToBlob(dataUrl), `${filenamePrefix}_${Date.now()}.png`)
  form.append('subfolder', 'pose_studio')
  form.append('overwrite', 'true')

  const res = await comfyFetch(baseUrl, '/upload/image', { method: 'POST', body: form }, apiKey, 60000)
  if (!res.ok) {
    throw new Error(
      tr(
        `[ComfyUI] 上傳參考圖失敗 (HTTP ${res.status})：${(await res.text()).slice(0, 200)}`,
        `[ComfyUI] Failed to upload reference image (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`
      )
    )
  }
  const json = await res.json()
  return json.subfolder ? `${json.subfolder}/${json.name}` : json.name
}

function openComfySocket(baseUrl: string, clientId: string, onMessage: (msg: any) => void): WebSocket | null {
  try {
    const u = new URL(baseUrl, window.location.href)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = `${u.pathname.replace(/\/+$/, '')}/ws`
    u.search = `clientId=${encodeURIComponent(clientId)}`
    const ws = new WebSocket(u.toString())
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return
      try {
        onMessage(JSON.parse(e.data))
      } catch {
        /* ignore */
      }
    }
    ws.onerror = () => {
      /* 进度推送失败不影响结果轮询 */
    }
    return ws
  } catch {
    return null
  }
}

export interface GenerationProgress {
  stage: 'check' | 'upload' | 'queue' | 'running' | 'download'
  message: string
  /** 0-100，未知时为 undefined */
  percent?: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function pruneUnusedImageSlot(workflow: ComfyWorkflow, loadNodeId: string): void {
  const deleted = new Set<string>([loadNodeId])
  delete workflow[loadNodeId]

  let changed = true
  while (changed) {
    changed = false
    for (const [nid, node] of Object.entries(workflow)) {
      if (!node?.inputs) continue
      if (['DepthAnythingV2Preprocessor', 'ImageScaleToTotalPixels', 'VAEEncode'].includes(node.class_type)) {
        const ref = node.inputs.image ?? node.inputs.pixels
        if (Array.isArray(ref) && deleted.has(String(ref[0]))) {
          deleted.add(nid)
          delete workflow[nid]
          changed = true
        }
      }
    }
  }

  for (const node of Object.values(workflow)) {
    if (!node?.inputs) continue
    if (node.class_type === 'ReferenceMultiLatent') {
      const kept: unknown[] = []
      const keys = Object.keys(node.inputs)
        .filter((k) => /^images\.image\d+$/.test(k))
        .sort((a, b) => Number(a.replace('images.image', '')) - Number(b.replace('images.image', '')))
      for (const k of keys) {
        const val = node.inputs[k]
        if (!Array.isArray(val) || !deleted.has(String(val[0]))) kept.push(val)
        delete node.inputs[k]
      }
      kept.forEach((val, idx) => {
        node.inputs[`images.image${idx}`] = val
      })
    } else if (node.class_type === 'TextEncodeQwenImageEditPlus') {
      const kept: unknown[] = []
      for (const k of ['image1', 'image2', 'image3']) {
        if (!(k in node.inputs)) continue
        const val = node.inputs[k]
        if (!Array.isArray(val) || !deleted.has(String(val[0]))) kept.push(val)
        delete node.inputs[k]
      }
      kept.forEach((val, idx) => {
        node.inputs[`image${idx + 1}`] = val
      })
    }
  }
}

async function generateWithComfyUi(params: {
  recipe: RecipeState
  prompt: string
  config: ApiConfig
  baseUrl: string
  apiKey: string
  onProgress?: (p: GenerationProgress) => void
}): Promise<{ imageUrl: string; modelUsed: string; providerUsed: ImageProviderId }> {
  const { recipe, prompt, config, baseUrl, apiKey } = params
  const report = params.onProgress ?? (() => {})
  const cp = config.comfyuiParams
  const timeoutSec = Math.max(60, cp.timeoutSec || 600)
  const parsedInfo = parseComfyWorkflowNodes(cp.workflowJson)
  if (!parsedInfo.valid) {
    throw new Error(`[ComfyUI] ${parsedInfo.error || tr('工作流 JSON 無效', 'Invalid workflow JSON')}`)
  }

  // 0. 预检：服务在线 + 节点/模型与本机匹配
  report({ stage: 'check', message: tr('正在檢查 ComfyUI 服務與模型…', 'Checking ComfyUI service and models…') })
  await testComfyConnection(baseUrl, apiKey)
  const schemas = await fetchComfyObjectInfo(baseUrl, apiKey, cp.workflowJson)
  const extraImageNodes = getWorkflowImages(cp.workflowJson, [cp.portraitNodeId, cp.costumeNodeId, cp.poseNodeId, cp.stitchedNodeId], schemas)
  const extraImages = recipe.workflowImagesIdentity === workflowIdentity(cp.workflowJson) ? recipe.workflowImages || {} : {}
  const selectedJson = applyWorkflowOverrides(cp.workflowJson, cp.parameterOverrides, schemas)
  const check = await checkComfyWorkflow(baseUrl, apiKey, selectedJson, [
    cp.portraitNodeId,
    cp.costumeNodeId,
    cp.poseNodeId,
    cp.stitchedNodeId,
    ...extraImageNodes.filter((node) => extraImages[node.nodeId]?.url || (node.optional && node.role === 'character_sheet')).map((node) => node.nodeId),
  ], schemas)
  if (!check.ok) {
    throw new Error(
      tr(
        `[ComfyUI] 工作流與本機不匹配：\n${check.errors.join('\n')}`,
        `[ComfyUI] Workflow does not match local environment:\n${check.errors.join('\n')}`
      )
    )
  }
  const workflow: ComfyWorkflow = JSON.parse(check.fixedJson ?? selectedJson)

  // 1. 按映射槽位上传参考图并注入节点
  const slotUploads: Array<{ nodeId: string; src: string | null; prefix: string; label: string }> = [
    {
      nodeId: cp.portraitNodeId,
      src: recipe.portrait ? recipe.portrait.原图 || recipe.portrait.缩略图 : null,
      prefix: 'studio_portrait',
      label: tr('人像', 'Portrait'),
    },
    {
      nodeId: cp.costumeNodeId,
      src: recipe.costume ? recipe.costume.预览图 || recipe.costume.原图 || recipe.costume.缩略图 : null,
      prefix: 'studio_costume',
      label: tr('服裝', 'Costume'),
    },
    {
      nodeId: cp.poseNodeId,
      src: recipe.pose ? recipe.pose.原图 || recipe.pose.缩略图 : null,
      prefix: 'studio_pose',
      label: tr('姿勢', 'Pose'),
    },
  ]
  const combinationError = validateReferenceCombinations(cp.workflowJson, [
    ...slotUploads.filter((slot) => slot.src && slot.nodeId && slot.nodeId !== 'none').map((slot) => slot.nodeId),
    ...extraImageNodes.filter((node) => extraImages[node.nodeId]?.url).map((node) => node.nodeId),
  ])
  if (combinationError) throw new Error(`[ComfyUI] ${combinationError}`)

  const invalidSlots = slotUploads.filter((slot) => slot.nodeId && slot.nodeId !== 'none' && !parsedInfo.imageNodes.some((node) => node.id === slot.nodeId))
  if (invalidSlots.length) {
    throw new Error(
      tr(
        `[ComfyUI] ${invalidSlots.map((slot) => slot.label).join('、')}節點映射已失效，請重新識別或選擇節點`,
        `[ComfyUI] Node mapping for ${invalidSlots.map((slot) => slot.label).join(', ')} is invalid; please re-detect or select nodes`
      )
    )
  }
  const missingSlots = slotUploads.filter((slot) => slot.nodeId && slot.nodeId !== 'none' && !slot.src && parsedInfo.imageNodes.find((node) => node.id === slot.nodeId)?.emptyValue === undefined)
  if (missingSlots.length) {
    throw new Error(
      tr(
        `[ComfyUI] 請先選擇或上傳：${missingSlots.map((slot) => slot.label).join('、')}`,
        `[ComfyUI] Please select or upload first: ${missingSlots.map((slot) => slot.label).join(', ')}`
      )
    )
  }

  for (const slot of slotUploads) {
    if (!slot.nodeId || slot.nodeId === 'none' || !workflow[slot.nodeId]?.inputs) continue
    if (!slot.src) {
      const emptyValue = parsedInfo.imageNodes.find((node) => node.id === slot.nodeId)?.emptyValue
      if (emptyValue === '') {
        pruneUnusedImageSlot(workflow, slot.nodeId)
        continue
      }
      if (emptyValue !== undefined) {
        workflow[slot.nodeId].inputs.image = emptyValue
        continue
      }
      throw new Error(
        tr(
          `目前工作流需要「${slot.label}」參考圖（節點 ${slot.nodeId}），請先在圖庫中選擇`,
          `Current workflow requires a "${slot.label}" reference image (Node ${slot.nodeId}), please select one in the gallery first`
        )
      )
    }
    report({
      stage: 'upload',
      message: tr(`正在上傳${slot.label}參考圖…`, `Uploading ${slot.label} reference image…`),
    })
    workflow[slot.nodeId].inputs.image = await uploadImageToComfy(baseUrl, slot.src, slot.prefix, apiKey)
  }

  // 若包含 ModelSamplingFlux 与画布尺寸节点，同步宽高
  if (workflow['6']?.class_type === 'ModelSamplingFlux' && workflow['22']?.inputs) {
    if (typeof workflow['22'].inputs.width === 'number') workflow['6'].inputs.width = workflow['22'].inputs.width
    if (typeof workflow['22'].inputs.height === 'number') workflow['6'].inputs.height = workflow['22'].inputs.height
  }

  for (const node of extraImageNodes) {
    const image = extraImages[node.nodeId]
    if (!image?.url) {
      if (node.optional && node.role === 'character_sheet') workflow[node.nodeId].inputs.image = '无'
      continue
    }
    report({ stage: 'upload', message: tr(`正在上傳${node.label}…`, `Uploading ${node.label}…`) })
    workflow[node.nodeId].inputs.image = await uploadImageToComfy(baseUrl, image.url, 'studio_reference', apiKey)
  }

  if (cp.stitchedNodeId && cp.stitchedNodeId !== 'none' && workflow[cp.stitchedNodeId]?.inputs) {
    report({ stage: 'upload', message: tr('正在上傳參考拼圖…', 'Uploading stitched reference sheet…') })
    const stitchedDataUrl = await stitchRecipeCanvas(recipe)
    workflow[cp.stitchedNodeId].inputs.image = await uploadImageToComfy(baseUrl, stitchedDataUrl, 'studio_stitched', apiKey)
  }

  // 2. 注入提示词节点
  if (cp.promptNodeId && cp.promptNodeId !== 'none' && workflow[cp.promptNodeId]?.inputs) {
    const inputs = workflow[cp.promptNodeId].inputs
    for (const field of ['prompt', 'text', 'string', 'positive']) {
      if (typeof inputs[field] === 'string') {
        inputs[field] = prompt
        break
      }
    }
  }

  // 3. 随机化种子
  if (cp.randomizeSeed) {
    const nextSeed = Math.floor(Math.random() * 90000000000000) + 1000000
    for (const node of Object.values<any>(workflow)) {
      if (!node?.inputs) continue
      if (typeof node.inputs.seed === 'number') node.inputs.seed = nextSeed
      if (typeof node.inputs.noise_seed === 'number') node.inputs.noise_seed = nextSeed
    }
  }

  // 4. 提交任务到 ComfyUI /prompt，并通过 WebSocket 接收实时进度
  const clientId = `pose_studio_${Math.random().toString(36).slice(2, 10)}`
  let promptId = ''
  let lastNodeTitle = ''
  const ws = openComfySocket(baseUrl, clientId, (msg) => {
    const d = msg?.data
    if (!d || (promptId && d.prompt_id && d.prompt_id !== promptId)) return
    if (msg.type === 'executing' && d.node) {
      lastNodeTitle = workflow[d.node]?._meta?.title || workflow[d.node]?.class_type || d.node
      report({ stage: 'running', message: tr(`正在執行：${lastNodeTitle}`, `Executing: ${lastNodeTitle}`) })
    } else if (msg.type === 'progress' && d.max) {
      const percent = Math.round((d.value / d.max) * 100)
      report({
        stage: 'running',
        message: `${lastNodeTitle || tr('取樣中', 'Sampling')} (${d.value}/${d.max})`,
        percent,
      })
    }
  })

  try {
    report({ stage: 'queue', message: tr('正在提交工作流…', 'Submitting workflow…') })
    const promptRes = await comfyFetch(
      baseUrl,
      '/prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      },
      apiKey,
      60000
    )
    const promptJson = await readJsonSafe(promptRes)
    if (!promptRes.ok || !promptJson?.prompt_id) {
      throw new Error(formatComfyPromptError(promptJson, workflow, promptRes.status))
    }
    promptId = promptJson.prompt_id
    report({ stage: 'queue', message: tr('已提交，等待 ComfyUI 執行…', 'Submitted, waiting for ComfyUI…') })

    // 5. 轮询 /history/{prompt_id} 获取最终结果
    const startedAt = Date.now()
    for (let attempt = 0; ; attempt++) {
      await sleep(1500)
      if (Date.now() - startedAt > timeoutSec * 1000) {
        await cancelComfyPrompt(baseUrl, apiKey, promptId)
        throw new Error(
          tr(
            `[ComfyUI] 等待生成結果逾時（超過 ${Math.round(timeoutSec / 60)} 分鐘），已取消該任務。首次載入模型較慢，可在合成台調大逾時時間後重試。`,
            `[ComfyUI] Timed out waiting for generation result (over ${Math.round(timeoutSec / 60)} min), task cancelled. First model load can be slow; increase timeout in Studio and retry.`
          )
        )
      }
      let histRes: Response
      try {
        histRes = await comfyFetch(baseUrl, `/history/${promptId}`, {}, apiKey, 15000)
      } catch (e) {
        if (attempt % 4 === 3)
          report({
            stage: 'running',
            message: tr('暫時無法連線 ComfyUI，正在重試…', 'Temporarily unable to reach ComfyUI, retrying…'),
          })
        if (Date.now() - startedAt > 60000 && attempt % 20 === 19) throw e
        continue
      }
      if (!histRes.ok) continue
      const item = (await readJsonSafe(histRes))?.[promptId]
      if (!item) {
        if (attempt % 3 === 0) {
          try {
            const q = await (await comfyFetch(baseUrl, '/queue', {}, apiKey, 10000)).json()
            const pendingIdx = (q?.queue_pending || []).findIndex((x: any) => x?.[1] === promptId)
            if (pendingIdx >= 0) {
              const ahead = pendingIdx + (q.queue_running?.length || 0)
              report({
                stage: 'queue',
                message: tr(`排隊中，前方還有 ${ahead} 個任務`, `In queue, ${ahead} task(s) ahead`),
              })
            }
          } catch {
            /* ignore */
          }
        }
        continue
      }

      if (item.status?.status_str === 'error') {
        const { text, oom } = formatExecutionError(item.status?.messages, workflow)
        if (oom) await freeComfyMemory(baseUrl, apiKey)
        throw new Error(text)
      }
      if (item.status && item.status.completed === false && item.status.status_str !== 'success') continue

      let outImg: { filename: string; subfolder?: string; type?: string } | null = null
      for (const nodeOut of Object.values<any>(item.outputs || {})) {
        for (const im of nodeOut?.images || []) {
          if (!outImg || (im?.type === 'output' && outImg.type !== 'output')) outImg = im
        }
      }
      if (!outImg) {
        if (item.status?.completed)
          throw new Error(
            tr(
              '[ComfyUI] 工作流已執行完成，但沒有輸出圖片（請檢查是否有 SaveImage 節點）',
              '[ComfyUI] Workflow finished but produced no output image (please check for a SaveImage node)'
            )
          )
        continue
      }

      report({ stage: 'download', message: tr('正在取得生成結果…', 'Fetching generated image…'), percent: 100 })
      const qs = new URLSearchParams({
        filename: outImg.filename,
        subfolder: outImg.subfolder || '',
        type: outImg.type || 'output',
      })
      const viewRes = await comfyFetch(baseUrl, `/view?${qs.toString()}`, {}, apiKey, 60000)
      if (!viewRes.ok)
        throw new Error(
          tr(`[ComfyUI] 取得生成圖片失敗 (HTTP ${viewRes.status})`, `[ComfyUI] Failed to fetch generated image (HTTP ${viewRes.status})`)
        )
      const blob = await viewRes.blob()
      if (!blob.size || !blob.type.startsWith('image/')) {
        throw new Error(tr('[ComfyUI] 回傳的生成結果不是有效圖片', '[ComfyUI] Returned result is not a valid image'))
      }
      return {
        imageUrl: await blobToDataUrl(blob),
        modelUsed: tr('ComfyUI 工作流', 'ComfyUI Workflow'),
        providerUsed: 'comfyui',
      }
    }
  } finally {
    ws?.close()
  }
}

async function cancelComfyPrompt(baseUrl: string, apiKey: string, promptId: string): Promise<void> {
  try {
    const q = await (await comfyFetch(baseUrl, '/queue', {}, apiKey, 10000)).json()
    if ((q?.queue_running || []).some((x: any) => x?.[1] === promptId)) {
      await comfyFetch(baseUrl, '/interrupt', { method: 'POST' }, apiKey, 10000)
    } else {
      await comfyFetch(
        baseUrl,
        '/queue',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delete: [promptId] }) },
        apiKey,
        10000
      )
    }
  } catch {
    /* ignore */
  }
}

export async function generateCharacterImage(params: {
  recipe: RecipeState
  prompt: string
  config: ApiConfig
  onProgress?: (p: GenerationProgress) => void
}): Promise<{ imageUrl: string; modelUsed: string; providerUsed: ImageProviderId }> {
  const { recipe, prompt, config, onProgress } = params
  const provider = config.activeProvider
  const pCfg = config.providers[provider]
  const apiKey = pCfg.apiKey.trim()

  if (provider !== 'comfyui' && !apiKey) {
    throw new Error(
      tr(
        `請先設定 ${getProviderMeta(provider).name} 的 API Key`,
        `Please configure the API Key for ${getProviderMeta(provider).name} first`
      )
    )
  }

  const rawSources = [
    recipe.portrait && (recipe.portrait.原图 || recipe.portrait.缩略图),
    recipe.costume && (recipe.costume.预览图 || recipe.costume.原图 || recipe.costume.缩略图),
    recipe.pose && (recipe.pose.原图 || recipe.pose.缩略图),
    ...(recipe.extraImages || []).map((x) => x.url),
    ...(provider === 'comfyui' && recipe.workflowImagesIdentity === workflowIdentity(config.comfyuiParams.workflowJson)
      ? Object.values(recipe.workflowImages || {}).map((image) => image.url) : []),
  ].filter(Boolean) as string[]

  if (!rawSources.length) {
    throw new Error(tr('請先選擇或上傳至少 1 張參考圖', 'Please select or upload at least 1 reference image first'))
  }

  const model = pCfg.model === 'custom' ? pCfg.customModel.trim() : pCfg.model
  if (provider !== 'comfyui' && !model) {
    throw new Error(tr('請選擇或填寫有效的模型名稱', 'Please select or enter a valid model name'))
  }

  const baseUrl = (pCfg.baseUrl.trim() || PROVIDER_META[provider].defaultBaseUrl).replace(/\/+$/, '')

  if (provider === 'comfyui') {
    return generateWithComfyUi({ recipe, prompt, config, baseUrl, apiKey, onProgress })
  }

  // 判断当前请求是否需要转换为本地 Base64：
  // 1) 用户显式选择了 base64 模式
  // 2) 或者勾选了「附带三合一 Canvas 合成图」（本地动态绘制无公网 URL）
  // 3) 或者使用 Gemini Native 原生接口 / OpenAI multipart/form-data 模式
  const needBase64 =
    config.imagePassMode === 'base64' ||
    config.sendStitchedSheet ||
    (provider === 'gemini' && config.geminiParams.endpointMode === 'native') ||
    (provider === 'gpt' && config.gptParams.endpointMode === 'images_edits')

  const imageRefs: string[] = needBase64
    ? await Promise.all(rawSources.map(srcToPngDataUrl))
    : rawSources.map(toPublicHttpsUrl)

  const allImageRefs: string[] = config.sendStitchedSheet
    ? [...imageRefs, await stitchRecipeCanvas(recipe)]
    : imageRefs

  let res: Response
  let json: any

  // =========================================================================
  // 协议 1: OpenAI GPT Image (gpt-image-2.5 / gpt-image-2 / gpt-image-1.5 / 1)
  // =========================================================================
  if (provider === 'gpt') {
    const g = config.gptParams
    const v1 = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`

    if (g.endpointMode === 'images_edits_json') {
      // OpenAI 最新 /v1/images/edits JSON 协议：直接传 images: [{ image_url: "https://..." }]，无需上传文件流！
      const payload: Record<string, any> = {
        model,
        prompt,
        images: allImageRefs.map((ref) => ({ image_url: ref })),
      }
      if (g.size !== 'auto') payload.size = g.size
      if (g.quality !== 'auto') payload.quality = g.quality
      if (g.inputFidelity) payload.input_fidelity = g.inputFidelity
      if (g.background !== 'auto') payload.background = g.background
      if (g.outputFormat) payload.output_format = g.outputFormat
      if (g.moderation !== 'auto') payload.moderation = g.moderation

      res = await smartFetch(
        `${v1}/images/edits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        },
        config.useProxy
      )
      json = await res.json()
    } else if (g.endpointMode === 'images_edits') {
      // 传统 /v1/images/edits (multipart/form-data 二进制文件上传)
      const fd = new FormData()
      fd.append('model', model)
      fd.append('prompt', prompt)
      allImageRefs.forEach((du, i) => {
        fd.append('image[]', dataUrlToBlob(du), `ref_${i + 1}.png`)
      })
      if (g.size !== 'auto') fd.append('size', g.size)
      if (g.quality !== 'auto') fd.append('quality', g.quality)
      if (g.inputFidelity) fd.append('input_fidelity', g.inputFidelity)
      if (g.background !== 'auto') fd.append('background', g.background)
      if (g.outputFormat) fd.append('output_format', g.outputFormat)
      if (g.moderation !== 'auto') fd.append('moderation', g.moderation)

      res = await smartFetch(
        `${v1}/images/edits`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: fd,
        },
        config.useProxy
      )
      json = await res.json()
    } else if (g.endpointMode === 'responses') {
      // OpenAI Responses API (/v1/responses) 支持直接传 HTTPS image_url 或 Base64
      const inputContent = [
        ...allImageRefs.map((ref) => ({ type: 'input_image', image_url: ref })),
        { type: 'input_text', text: prompt },
      ]
      const toolCfg: Record<string, any> = { type: 'image_generation' }
      if (g.size !== 'auto') toolCfg.size = g.size
      if (g.quality !== 'auto') toolCfg.quality = g.quality
      if (g.background !== 'auto') toolCfg.background = g.background
      if (g.inputFidelity) toolCfg.input_fidelity = g.inputFidelity
      if (g.outputFormat) toolCfg.output_format = g.outputFormat

      res = await smartFetch(
        `${v1}/responses`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            input: [{ role: 'user', content: inputContent }],
            tools: [toolCfg],
          }),
        },
        config.useProxy
      )
      json = await res.json()
    } else {
      // 兼容中转站 Chat Completions，支持直接传 HTTPS URL
      const content = [
        { type: 'text', text: prompt },
        ...allImageRefs.map((ref) => ({ type: 'image_url', image_url: { url: ref } })),
      ]
      res = await smartFetch(
        `${v1}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content }],
            modalities: ['text', 'image'],
          }),
        },
        config.useProxy
      )
      json = await res.json()
    }
  }
  // =========================================================================
  // 协议 2: Google Gemini 原生 / Nano Banana
  // =========================================================================
  else if (provider === 'gemini') {
    const gm = config.geminiParams
    if (gm.endpointMode === 'native') {
      const root = baseUrl.replace(/\/v1(?:beta)?$/, '')
      const url = `${root}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
      const parts = [
        ...allImageRefs.map((du) => ({
          inlineData: { mimeType: 'image/png', data: du.split(',')[1] },
        })),
        { text: prompt },
      ]
      const isGemini3 = model.includes('gemini-3')
      const imageConfig: Record<string, string> = {
        aspectRatio: gm.aspectRatio,
      }
      if (isGemini3 && gm.imageSize) {
        imageConfig.imageSize = gm.imageSize
      }

      res = await smartFetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig,
            },
          }),
        },
        config.useProxy
      )
      json = await res.json()
    } else {
      const v1 = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`
      const content = [
        { type: 'text', text: `${prompt}\n(Output aspect ratio: ${gm.aspectRatio}, resolution: ${gm.imageSize})` },
        ...allImageRefs.map((ref) => ({ type: 'image_url', image_url: { url: ref } })),
      ]
      res = await smartFetch(
        `${v1}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content }],
            modalities: ['text', 'image'],
          }),
        },
        config.useProxy
      )
      json = await res.json()
    }
  }
  // =========================================================================
  // 协议 3: 阿里云百炼 Qwen-Image (DashScope multimodal-generation)
  // =========================================================================
  else if (provider === 'qwen') {
    const qw = config.qwenParams
    const endpoint = baseUrl.includes('/services/aigc/')
      ? baseUrl
      : `${baseUrl.replace(/\/api\/v1$/, '')}/api/v1/services/aigc/multimodal-generation/generation`

    // Qwen-Image 原生支持直接传入公网 HTTPS URL 或 Base64 Data URL: {"image": "https://..."}
    const content = [
      ...imageRefs.map((ref) => ({ image: ref })),
      { text: prompt },
    ]

    res = await smartFetch(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: {
            messages: [
              {
                role: 'user',
                content,
              },
            ],
          },
          parameters: {
            size: qw.size,
            n: qw.n || 1,
            prompt_extend: qw.promptExtend,
            watermark: qw.watermark,
            ...(qw.negativePrompt.trim() ? { negative_prompt: qw.negativePrompt.trim() } : {}),
          },
        }),
      },
      config.useProxy
    )
    json = await res.json()
  }
  // =========================================================================
  // 协议 4: 字节火山方舟 Doubao Seedream (/api/v3/images/generations)
  // =========================================================================
  else {
    const db = config.doubaoParams
    let endpoint = baseUrl
    if (!endpoint.endsWith('/images/generations')) {
      if (endpoint.endsWith('/api/v3') || endpoint.endsWith('/v1')) {
        endpoint = `${endpoint}/images/generations`
      } else {
        endpoint = `${endpoint}/api/v3/images/generations`
      }
    }

    res = await smartFetch(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          image: allImageRefs, // Seedream 4.0 / 4.5 / 5.0 原生支持传入多张参考图 URL 数组或 Base64 数组
          size: db.size,
          sequential_image_generation: db.sequentialImageGeneration,
          watermark: db.watermark,
          response_format: db.responseFormat,
        }),
      },
      config.useProxy
    )
    json = await res.json()
  }

  if (!res.ok) {
    const errMsg =
      json?.error?.message ||
      json?.message ||
      json?.code ||
      tr(`請求失敗 (HTTP ${res.status})`, `Request failed (HTTP ${res.status})`)
    throw new Error(`[${getProviderMeta(provider).shortName}] ${errMsg}`)
  }

  const imageUrl = extractUniversalImage(json)
  if (!imageUrl) {
    const fallbackText =
      json?.choices?.[0]?.message?.content ||
      json?.output?.choices?.[0]?.message?.content?.[0]?.text ||
      JSON.stringify(json).slice(0, 260)
    throw new Error(
      tr(
        `介面已回應但未解析到圖片輸出：${fallbackText}`,
        `API responded but no image output could be parsed: ${fallbackText}`
      )
    )
  }

  return { imageUrl, modelUsed: model, providerUsed: provider }
}
