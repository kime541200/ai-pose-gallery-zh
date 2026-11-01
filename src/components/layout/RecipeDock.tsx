import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import {
  CopyIcon,
  DicesIcon,
  LoaderCircleIcon,
  PersonStandingIcon,
  ShirtIcon,
  SparklesIcon,
  Trash2Icon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { costumesQuery, portraitsQuery, posesQuery } from '@/api/gallery'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { workflowIdentity } from '@/lib/comfyWorkflowParameters'
import { referenceImageUrl } from '@/lib/recipeImages'
import { buildRecipePrompt } from '@/services/aiGenerator'
import { useStudio } from '@/store/studioStore'

export function RecipeDock() {
  const { pathname } = useLocation()
  const { recipe, apiConfig, isGenerating, setPortrait, setCostume, setPose, clearRecipe, randomizeRecipe } =
    useStudio()
  const { locale, t, portrait: locPortrait, costume: locCostume, pose: locPose } = useI18n()
  const qc = useQueryClient()
  const extraCount = (recipe.extraImages || []).length
  const workflowImages =
    apiConfig.activeProvider === 'comfyui' &&
    recipe.workflowImagesIdentity === workflowIdentity(apiConfig.comfyuiParams.workflowJson)
      ? Object.values(recipe.workflowImages || {})
      : []
  const count = [recipe.portrait, recipe.costume, recipe.pose].filter(Boolean).length + extraCount + workflowImages.length

  if (pathname.startsWith('/studio') || pathname.startsWith('/settings') || pathname.startsWith('/guide')) {
    return null
  }

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

  const handleCopyPrompt = async () => {
    const text = buildRecipePrompt(recipe, apiConfig.stylePreset, workflowImages, locale)
    await navigator.clipboard.writeText(text)
    toast.success(t('已複製提示詞', 'Prompt copied to clipboard'))
  }

  const pLoc = recipe.portrait ? locPortrait(recipe.portrait) : null
  const cLoc = recipe.costume ? locCostume(recipe.costume) : null
  const poseLoc = recipe.pose ? locPose(recipe.pose) : null

  return (
    <div className="sticky bottom-3 z-30 mx-auto mt-4 w-full max-w-5xl">
      <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-card/95 p-2 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-3.5 sm:py-2.5">
        <div className="grid flex-1 grid-cols-3 gap-1.5 sm:gap-2">
          {/* Slot 1: Portrait */}
          <div className="relative flex items-center gap-1.5 rounded-xl bg-muted/80 p-1.5 sm:gap-2 sm:p-2">
            {recipe.portrait && pLoc ? (
              <>
                <img
                  src={referenceImageUrl(recipe.portrait.缩略图)}
                  alt={pLoc.title}
                  className="h-8 w-7 shrink-0 rounded-md object-cover sm:h-10 sm:w-8"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium sm:text-xs">{pLoc.styleName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPortrait(null)}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </>
            ) : (
              <Link
                to="/portraits"
                className="flex flex-1 items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <div className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md bg-background/80 sm:h-10 sm:w-8">
                  <UserRoundIcon className="size-3.5" />
                </div>
                <span className="truncate text-[11px] sm:text-xs">{t('人像', 'Portrait')}</span>
              </Link>
            )}
          </div>

          {/* Slot 2: Costume */}
          <div className="relative flex items-center gap-1.5 rounded-xl bg-muted/80 p-1.5 sm:gap-2 sm:p-2">
            {recipe.costume && cLoc ? (
              <>
                <img
                  src={referenceImageUrl(recipe.costume.缩略图)}
                  alt={cLoc.name}
                  className="h-8 w-7 shrink-0 rounded-md object-cover sm:h-10 sm:w-8"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium sm:text-xs">{cLoc.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setCostume(null)}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </>
            ) : (
              <Link
                to="/costumes"
                className="flex flex-1 items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <div className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md bg-background/80 sm:h-10 sm:w-8">
                  <ShirtIcon className="size-3.5" />
                </div>
                <span className="truncate text-[11px] sm:text-xs">{t('服裝', 'Costume')}</span>
              </Link>
            )}
          </div>

          {/* Slot 3: Pose */}
          <div className="relative flex items-center gap-1.5 rounded-xl bg-muted/80 p-1.5 sm:gap-2 sm:p-2">
            {recipe.pose && poseLoc ? (
              <>
                <img
                  src={referenceImageUrl(recipe.pose.缩略图)}
                  alt={poseLoc.name}
                  className="h-8 w-7 shrink-0 rounded-md object-cover sm:h-10 sm:w-8"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium sm:text-xs">{poseLoc.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPose(null)}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </>
            ) : (
              <Link to="/poses" className="flex flex-1 items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <div className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md bg-background/80 sm:h-10 sm:w-8">
                  <PersonStandingIcon className="size-3.5" />
                </div>
                <span className="truncate text-[11px] sm:text-xs">{t('姿勢', 'Pose')}</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={handleRandom}>
            <DicesIcon className="size-3.5" />
            {t('隨機', 'Random')}
          </Button>
          {count > 0 && (
            <>
              <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={handleCopyPrompt}>
                <CopyIcon className="size-3.5" />
                <span className="hidden md:inline">{t('複製詞', 'Copy Prompt')}</span>
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={clearRecipe}>
                <Trash2Icon className="size-3.5" />
              </Button>
            </>
          )}
          <Button size="sm" className="h-8 px-3 text-xs" asChild>
            <Link to="/studio">
              {isGenerating ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  {t('生成中…', 'Generating…')}
                </>
              ) : (
                <>
                  <SparklesIcon className="size-3.5" />
                  {t(`合成 (${count})`, `Studio (${count})`)}
                </>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
