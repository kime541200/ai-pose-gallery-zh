import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FlameIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { portraitsQuery } from '@/api/gallery'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { useStudio } from '@/store/studioStore'

export const Route = createFileRoute('/portraits')({
  staticData: { title: '人像顏值庫', titleEn: 'Portrait Gallery' },
  loader: ({ context }) => context.queryClient.ensureQueryData(portraitsQuery),
  pendingComponent: () => <Skeleton className="h-[540px] rounded-[22px]" />,
  component: PortraitsPage,
})

const HAIRS = ['短发', '中发', '中长发', '长发'] as const

function PortraitsPage() {
  const { data: portraits } = useSuspenseQuery(portraitsQuery)
  const { recipe, togglePortrait } = useStudio()
  const {
    locale,
    t,
    portrait: locPortrait,
    portraitSection: locSection,
    portraitHair: locHair,
    portraitStyle: locStyle,
  } = useI18n()

  const [section, setSection] = useState<'' | '正脸参考' | '造型氛围'>('')
  const [hair, setHair] = useState('')
  const [styleName, setStyleName] = useState('all')
  const [onlyHot, setOnlyHot] = useState(false)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(60)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const styleOptions = useMemo(() => {
    const sub = portraits.filter((p) => (!section || p.分区 === section) && (!hair || p.发长 === hair))
    return [...new Set(sub.map((p) => p.发型名称).filter(Boolean))].sort((a, b) =>
      locStyle(a).localeCompare(locStyle(b), locale === 'en' ? 'en' : 'zh-TW')
    )
  }, [portraits, section, hair, locStyle, locale])

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    return portraits.filter((item) => {
      if (section && item.分区 !== section) return false
      if (hair && item.发长 !== hair) return false
      if (styleName !== 'all' && item.发型名称 !== styleName) return false
      if (onlyHot && !item.热门) return false
      if (q && !item.检索.toLowerCase().includes(q)) return false
      return true
    })
  }, [portraits, section, hair, styleName, onlyHot, q])

  const currentItem = viewerIndex !== null ? filtered[viewerIndex] : null

  useEffect(() => {
    if (viewerIndex === null || !filtered.length) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setViewerIndex((viewerIndex + 1) % filtered.length)
      } else if (e.key === 'ArrowLeft') {
        setViewerIndex((viewerIndex - 1 + filtered.length) % filtered.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerIndex, filtered.length])

  return (
    <>
      <PageHeader
        title={t('人像顏值庫', 'Portrait Gallery')}
        actions={
          <Button
            variant={onlyHot ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setOnlyHot((v) => !v)
              setShown(60)
            }}
          >
            <FlameIcon className="size-3.5 text-orange-500" />
            {t('Top10 熱門', 'Top 10 Popular')}
          </Button>
        }
      />

      {/* 分區與髮長切換藥丸 */}
      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
        <button
          type="button"
          onClick={() => {
            setSection('')
            setHair('')
            setStyleName('all')
            setShown(60)
          }}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
            section === '' && hair === ''
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          {t('全部人像', 'All Portraits')} ({portraits.length})
        </button>
        {(['正脸参考', '造型氛围'] as const).map((sec) => {
          const cnt = portraits.filter((x) => x.分区 === sec).length
          return (
            <button
              key={sec}
              type="button"
              onClick={() => {
                setSection(section === sec ? '' : sec)
                setStyleName('all')
                setShown(60)
              }}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                section === sec
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {locSection(sec)} ({cnt})
            </button>
          )
        })}
        {HAIRS.map((h) => {
          const cnt = portraits.filter((x) => x.发长 === h).length
          return (
            <button
              key={h}
              type="button"
              onClick={() => {
                setHair(hair === h ? '' : h)
                setStyleName('all')
                setShown(60)
              }}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                hair === h
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {locHair(h)} ({cnt})
            </button>
          )
        })}
      </div>

      {/* 搜尋與髮型細分 */}
      <div className="grid gap-3 rounded-[22px] bg-muted p-4 md:grid-cols-[1fr_260px_auto]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShown(60)
            }}
            placeholder={t(
              '搜尋髮型款式、髮色或 ID（如：鮑伯頭、狼尾、空氣瀏海、挑染、韓式）…',
              'Search hairstyle, hair color, or ID (e.g. bob, wolf cut, bangs, highlights, Korean)…'
            )}
            className="bg-background pl-9"
          />
        </div>

        <Select
          value={styleName}
          onValueChange={(v) => {
            setStyleName(v)
            setShown(60)
          }}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder={t('全部 51 款日系髮型', 'All 51 Hairstyles')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('全部 51 款日系髮型', 'All 51 Hairstyles')}</SelectItem>
            {styleOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {locStyle(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setSection('')
            setHair('')
            setStyleName('all')
            setOnlyHot(false)
            setQuery('')
            setShown(60)
          }}
        >
          <RotateCcwIcon className="size-3.5" />
          {t('重置', 'Reset')}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('沒有找到匹配的人像參考', 'No matching portraits found')}
          description={t('試試更換髮型關鍵字或重置篩選', 'Try another hairstyle keyword or reset filters')}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.slice(0, shown).map((item, idx) => {
            const picked = recipe.portrait?.id === item.id
            const pLoc = locPortrait(item)
            return (
              <div
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-[20px] bg-muted p-2 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  onClick={() => setViewerIndex(idx)}
                  className="relative aspect-4/5 cursor-zoom-in overflow-hidden rounded-2xl bg-background"
                >
                  <img
                    src={`/${item.缩略图}`}
                    alt={pLoc.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-1">
                    <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {pLoc.section}
                    </span>
                    <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-900">
                      {pLoc.hair}
                    </span>
                  </div>
                  {item.热门 && (
                    <span className="absolute right-2 bottom-2 rounded-md bg-orange-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      🔥 Top10
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePortrait(item)
                    }}
                    className={cn(
                      'absolute bottom-2 left-2 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white shadow transition',
                      picked ? 'bg-emerald-600' : 'bg-black/75 hover:bg-primary'
                    )}
                  >
                    {picked ? <CheckIcon className="size-3" /> : <PlusIcon className="size-3" />}
                    {picked ? t('已選', 'Selected') : t('加入配方', 'Add')}
                  </button>
                </div>

                <div className="px-1.5 pt-2.5 pb-1">
                  <div className="line-clamp-2 min-h-[34px] text-xs leading-snug font-semibold">{pLoc.styleName}</div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span>{item.id}</span>
                    <span>CC0</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {shown < filtered.length && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setShown((s) => s + 60)}>
            {t(
              `載入更多（剩餘 ${filtered.length - shown} 張）`,
              `Load More (${filtered.length - shown} portraits left)`
            )}
          </Button>
        </div>
      )}

      {/* 人像大圖彈窗 */}
      <Dialog open={viewerIndex !== null} onOpenChange={(o) => !o && setViewerIndex(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto p-0 sm:max-w-4xl">
          {currentItem &&
            viewerIndex !== null &&
            (() => {
              const picked = recipe.portrait?.id === currentItem.id
              const pLoc = locPortrait(currentItem)
              return (
                <div className="grid md:grid-cols-[1fr_320px]">
                  <div className="relative flex max-h-[78vh] min-h-[380px] items-center justify-center bg-muted/60 p-4">
                    <img
                      src={`/${currentItem.原图}`}
                      alt={pLoc.title}
                      className="max-h-[72vh] w-auto rounded-lg object-contain"
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full shadow"
                      onClick={() => setViewerIndex((viewerIndex - 1 + filtered.length) % filtered.length)}
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full shadow"
                      onClick={() => setViewerIndex((viewerIndex + 1) % filtered.length)}
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>

                  <div className="flex flex-col justify-between gap-4 border-t p-5 md:border-t-0 md:border-l">
                    <div className="space-y-4">
                      <DialogHeader>
                        <div className="flex items-center gap-2">
                          <Badge>{pLoc.section}</Badge>
                          <Badge variant="outline">{pLoc.hair}</Badge>
                          {currentItem.热门 && <Badge variant="secondary">🔥 Top10</Badge>}
                        </div>
                        <DialogTitle className="mt-2 text-base leading-snug">{pLoc.title}</DialogTitle>
                      </DialogHeader>

                      <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs">
                        <span className="truncate">{currentItem.id}</span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(currentItem.id)
                            toast.success(t('已複製人像 ID', 'Portrait ID copied'))
                          }}
                          className="ml-2 shrink-0 text-primary hover:underline"
                        >
                          <CopyIcon className="size-3.5" />
                        </button>
                      </div>

                      <dl className="grid grid-cols-[76px_1fr] gap-y-1.5 text-xs">
                        <dt className="text-muted-foreground">{t('髮型款式', 'Hairstyle')}</dt>
                        <dd className="font-medium">{pLoc.styleName}</dd>
                        <dt className="text-muted-foreground">{t('原圖尺寸', 'Dimensions')}</dt>
                        <dd className="font-medium">
                          {currentItem.宽} × {currentItem.高}
                        </dd>
                        <dt className="text-muted-foreground">{t('授權協議', 'License')}</dt>
                        <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                          {t('CC0 1.0 公眾領域（可商用）', 'CC0 1.0 Public Domain (Commercial OK)')}
                        </dd>
                      </dl>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button onClick={() => togglePortrait(currentItem)} variant={picked ? 'secondary' : 'default'}>
                        {picked ? <CheckIcon className="size-4" /> : <PlusIcon className="size-4" />}
                        {picked
                          ? t('已在角色配方中（點擊移除）', 'In Recipe (Click to remove)')
                          : t('加入角色配方', 'Add to Recipe')}
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/${currentItem.原图}`} download={`${currentItem.id}.webp`}>
                            <DownloadIcon className="size-3.5" />
                            {t('下載高清原圖', 'Download HD')}
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/${currentItem.原图}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="size-3.5" />
                            {t('新分頁原圖', 'Open Original')}
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
        </DialogContent>
      </Dialog>
    </>
  )
}
