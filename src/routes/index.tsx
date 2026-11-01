import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  CheckIcon,
  FlameIcon,
  LayersIcon,
  PersonStandingIcon,
  PlusIcon,
  ShirtIcon,
  UserRoundIcon,
} from 'lucide-react'
import { costumesQuery, portraitsQuery, posesQuery } from '@/api/gallery'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'
import { useStudio } from '@/store/studioStore'

export const Route = createFileRoute('/')({
  staticData: { title: '圖庫總覽', titleEn: 'Overview' },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(posesQuery),
      context.queryClient.ensureQueryData(costumesQuery),
      context.queryClient.ensureQueryData(portraitsQuery),
    ]),
  pendingComponent: () => <Skeleton className="h-[520px] rounded-[22px]" />,
  component: DashboardPage,
})

function DashboardPage() {
  const { data: posesData } = useSuspenseQuery(posesQuery)
  const { data: costumes } = useSuspenseQuery(costumesQuery)
  const { data: portraits } = useSuspenseQuery(portraitsQuery)
  const { recipe, togglePortrait } = useStudio()
  const { locale, t, poseGroup: locPoseGroup, costume: locCostume, portrait: locPortrait } = useI18n()

  const topPortraits = portraits.filter((p) => p.热门).slice(0, 10)
  const totalImages = posesData.items.length + costumes.length + portraits.length
  const numLocale = locale === 'en' ? 'en-US' : 'zh-TW'

  return (
    <>
      <PageHeader title={t('AI 角色參考庫', 'AI Character Reference Library')} />

      {/* 核心資料指標卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title={t('總參考圖', 'Total References')}
          value={totalImages.toLocaleString(numLocale)}
          icon={<LayersIcon />}
          desc={t('8,690 本地高清圖', '8,690 Local HD Images')}
        />
        <StatCard
          title={t('動作姿勢 (Pose)', 'Action Poses')}
          value={t(`${posesData.groups.length} 組`, `${posesData.groups.length} Groups`)}
          icon={<PersonStandingIcon />}
          desc={t(`${posesData.items.length} 張 · 5 視角`, `${posesData.items.length} Images · 5 Angles`)}
        />
        <StatCard
          title={t('服裝穿搭 (Costume)', 'Costume Outfits')}
          value={t(`${costumes.length.toLocaleString(numLocale)} 套`, `${costumes.length.toLocaleString(numLocale)} Sets`)}
          icon={<ShirtIcon />}
          desc={t('8 大分類 · 雙語標籤', '8 Categories · Bilingual Tags')}
        />
        <StatCard
          title={t('人像顏值 (Portrait)', 'Face Portraits')}
          value={t(`${portraits.length.toLocaleString(numLocale)} 張`, `${portraits.length.toLocaleString(numLocale)} Portraits`)}
          icon={<UserRoundIcon />}
          desc={t('CC0 授權 · 51 款髮型', 'CC0 License · 51 Hairstyles')}
        />
      </div>

      {/* 三大核心圖庫入口卡片 */}
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <Link
          to="/poses"
          className="group flex flex-col justify-between rounded-[20px] bg-muted p-4 transition hover:bg-muted/70"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">🕺 {t('動作姿勢庫', 'Pose Gallery')}</h2>
            <Badge variant="secondary">1,439</Badge>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {posesData.groups.slice(0, 4).map((g) => (
              <img
                key={g.key}
                src={`/${g.order[0].缩略图}`}
                alt={locPoseGroup(g).name}
                loading="lazy"
                className="aspect-3/4 w-full rounded-lg bg-background object-cover"
              />
            ))}
          </div>
        </Link>

        <Link
          to="/costumes"
          className="group flex flex-col justify-between rounded-[20px] bg-muted p-4 transition hover:bg-muted/70"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">👗 {t('服裝穿搭庫', 'Costume Gallery')}</h2>
            <Badge variant="secondary">1,407</Badge>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {costumes.slice(0, 4).map((c) => (
              <img
                key={c.id}
                src={`/${c.缩略图}`}
                alt={locCostume(c).name}
                loading="lazy"
                className="aspect-3/4 w-full rounded-lg bg-background object-cover"
              />
            ))}
          </div>
        </Link>

        <Link
          to="/portraits"
          className="group flex flex-col justify-between rounded-[20px] bg-muted p-4 transition hover:bg-muted/70"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">👤 {t('人像顏值庫', 'Portrait Gallery')}</h2>
            <Badge variant="secondary">1,499</Badge>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {portraits.slice(0, 4).map((p) => (
              <img
                key={p.id}
                src={`/${p.缩略图}`}
                alt={locPortrait(p).title}
                loading="lazy"
                className="aspect-3/4 w-full rounded-lg bg-background object-cover"
              />
            ))}
          </div>
        </Link>
      </div>

      {/* 熱門人像 Top10 速選區 */}
      <section className="rounded-[20px] bg-muted p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold sm:text-base">
            <FlameIcon className="size-4 text-orange-500" />
            {t('熱門人像 Top 10', 'Top 10 Popular Portraits')}
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/portraits">
              {t('全部', 'View All')}
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:grid-cols-10">
          {topPortraits.map((item, idx) => {
            const picked = recipe.portrait?.id === item.id
            const pLoc = locPortrait(item)
            return (
              <div
                key={item.id}
                onClick={() => togglePortrait(item)}
                className="group relative cursor-pointer overflow-hidden rounded-xl bg-background transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-4/5 overflow-hidden">
                  <img
                    src={`/${item.缩略图}`}
                    alt={pLoc.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    #{idx + 1}
                  </span>
                  <span
                    className={`absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full text-white shadow ${
                      picked ? 'bg-emerald-600' : 'bg-black/65 group-hover:bg-primary'
                    }`}
                  >
                    {picked ? <CheckIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
                  </span>
                </div>
                <div className="p-1.5">
                  <div className="truncate text-[11px] font-medium">{pLoc.styleName}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 底部免責聲明提示條 */}
      <footer className="rounded-[18px] border border-border/60 bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">⚠️ {t('免責聲明：', 'Disclaimer: ')}</strong>
        {locale === 'en' ? (
          <>
            Pose and costume reference images are sourced from public shares by X creator{' '}
            <a
              href="https://x.com/giaaibusi"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              ギア (@giaaibusi)
            </a>
            . Copyright belongs to the original creator; commercial resale is strictly prohibited. "Safe Mode (SFW)" is
            enabled by default to hide 18+ categories (do not disable if under 18). This tool and its assets are{' '}
            <strong className="text-foreground">
              strictly for personal study and lawful artistic creation; any illegal use or portrait rights infringement
              is prohibited
            </strong>
            .{' '}
            <Link to="/guide" className="font-medium text-primary underline">
              Read full disclaimer →
            </Link>
          </>
        ) : (
          <>
            本站姿勢與服飾參考圖源自 X 創作者{' '}
            <a
              href="https://x.com/giaaibusi"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              ギア (@giaaibusi)
            </a>{' '}
            公開分享，版權歸原作者所有，嚴禁商業倒賣。預設已開啟「安全模式 (SFW)」隱藏 18+ 敏感分類，未滿 18 歲請勿關閉。本工具與素材
            <strong className="text-foreground">
              僅供個人學習與合法藝術創作使用，嚴禁用於任何違法違規或侵害他人肖像權用途
            </strong>
            。{' '}
            <Link to="/guide" className="font-medium text-primary underline">
              查看完整免責聲明 →
            </Link>
          </>
        )}
      </footer>
    </>
  )
}
