import { createFileRoute } from '@tanstack/react-router'
import { Section } from '@/components/common/FormSection'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n'

export const Route = createFileRoute('/guide')({
  staticData: { title: '使用指南與免責聲明', titleEn: 'Guide & Disclaimer' },
  component: GuidePage,
})

function GuidePage() {
  const { locale, t } = useI18n()

  return (
    <>
      <PageHeader title={t('使用指南與免責聲明', 'User Guide & Disclaimer')} />

      <Section title={t('角色合成流程', 'Character Synthesis Workflow')} className="md:grid-cols-3">
        <div className="rounded-2xl bg-background p-4">
          <Badge>{t('1. 人像', '1. Portrait')}</Badge>
          <h3 className="mt-2 text-sm font-semibold">{t('人像顏值庫 (1,499)', 'Portrait Gallery (1,499)')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              '挑選五官與髮型參考，或在合成台直接上傳自訂人像圖，鎖定角色臉部特徵。',
              'Pick facial features and hairstyle references, or upload a custom portrait directly in the Studio to lock character identity.'
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-background p-4">
          <Badge>{t('2. 服裝', '2. Costume')}</Badge>
          <h3 className="mt-2 text-sm font-semibold">{t('服裝穿搭庫 (1,407)', 'Costume Gallery (1,407)')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              '依分類或標籤挑選服飾，內建中英雙語生圖詞條，也支援上傳本地服裝參考圖。',
              'Browse outfits by category or tag with built-in bilingual prompt keywords, or upload your own outfit reference image.'
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-background p-4">
          <Badge>{t('3. 姿勢 + 附圖', '3. Pose + Extras')}</Badge>
          <h3 className="mt-2 text-sm font-semibold">{t('動作姿勢庫 (1,439)', 'Pose Gallery (1,439)')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              '挑選 5 視角 3D 素體姿勢，結合雲端 API 或本地 ComfyUI 一鍵生成角色立繪。',
              'Choose 5-angle 3D mannequin poses and combine with Cloud APIs or local ComfyUI to generate full character illustrations.'
            )}
          </p>
        </div>
      </Section>

      <Section
        title={t('免責聲明與合規使用規範（必讀）', 'Disclaimer & Acceptable Use Policy (Must Read)')}
        className="md:grid-cols-1"
      >
        {locale === 'en' ? (
          <div className="space-y-2.5 rounded-2xl bg-background p-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">1. For Personal Study & Lawful Artistic Creation Only: </strong>
              This project (including the web studio, local ComfyUI plugin, and workflow templates) is{' '}
              <strong className="text-foreground">
                provided strictly for personal learning, anatomy study, illustration composition reference, and
                technical research
              </strong>
              . Generating or distributing illegal, non-consensual, violent, or prohibited content, or uploading real
              persons&apos; photos without explicit authorization for face-swapping / deepfakes that infringe portrait,
              privacy, or reputation rights is strictly prohibited.
            </p>
            <p>
              <strong className="text-foreground">2. NSFW (18+) Sensitive Content Notice: </strong>
              The gallery contains adult-oriented 3D mannequin poses (Sensual Solo, Couple Duo) and lingerie/sensual
              outfit references intended for figure drawing practice. &ldquo;Safe Mode (SFW)&rdquo; is enabled by
              default to hide these categories.{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                Minors under 18 years old are strictly prohibited from disabling Safe Mode or accessing 18+ content.
              </strong>
            </p>
            <p>
              <strong className="text-foreground">3. Privacy & User Responsibility: </strong>
              This studio is a pure client-side local web application. All AI generation requests are executed directly
              via your own configured Cloud API keys or your local ComfyUI instance; this platform does not collect or
              store any uploaded images or generated outputs.{' '}
              <strong className="text-foreground">
                Users bear sole legal responsibility for any misuse or improper distribution of generated content.
              </strong>
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 rounded-2xl bg-background p-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">1. 僅供學習與合法藝術創作（嚴禁違法）：</strong>
              本專案（含網頁工作台、本地 ComfyUI 外掛與工作流模板）
              <strong className="text-foreground">僅供個人學習、人體結構研究、插畫構圖參考與技術交流使用</strong>
              。嚴禁使用本工具生成、製作或散播任何違反法律法規、淫穢色情、暴力違禁內容，嚴禁未經他人明確授權上傳真實人物照片進行換臉或深偽合成（Deepfake）等侵犯他人肖像權、隱私權與名譽權的行為。
            </p>
            <p>
              <strong className="text-foreground">2. NSFW（18+）敏感內容提示：</strong>
              圖庫中包含部分成人向 3D 素體姿勢（全身單人・性感系、雙人纏綿）與內衣/性感穿搭參考，旨在服務繪畫與動作設計練習。系統預設開啟「安全模式 (SFW)」屏蔽上述分類，
              <strong className="text-rose-600 dark:text-rose-400">
                未滿 18 歲的未成年人嚴禁關閉安全模式或存取相關內容
              </strong>
              。
            </p>
            <p>
              <strong className="text-foreground">3. 隱私保護與使用者責任歸屬：</strong>
              本工作台為純前端本地應用，所有 AI 生圖請求均由使用者自行配置的雲端 API Key 或使用者本機 ComfyUI 環境直接執行，平台不收集、不儲存任何使用者上傳的圖片或生成結果。
              <strong className="text-foreground">
                因使用者違規使用或不當散播所產生的一切法律責任，均由使用者本人獨立承擔，與本專案及維護者無關。
              </strong>
            </p>
          </div>
        )}
      </Section>

      <Section title={t('資料來源與版權說明', 'Data Sources & Copyright')} className="md:grid-cols-1">
        {locale === 'en' ? (
          <div className="space-y-2.5 rounded-2xl bg-background p-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">• Original Creator Copyright: </strong>
              All pose (<code>ai-pose-gallery.pages.dev</code>), costume (<code>ai-costume-gallery.pages.dev</code>),
              and portrait (<code>ai-portrait-gallery.pages.dev</code>) reference images and metadata in this repository
              originate from public sites by <strong className="text-foreground">ギア (@giaaibusi)</strong>. Copyright
              remains with the original author. This repository only provides multilingual localization and frontend
              tooling without claiming ownership over the original images.
            </p>
            <p>
              <strong className="text-foreground">• Usage & Distribution Restrictions: </strong>
              The Portrait Gallery follows the{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">CC0 1.0 Public Domain Dedication</strong>; the
              Pose and Costume galleries are free for personal study and AI generation reference.{' '}
              <strong className="text-foreground">
                Repackaging, reselling, or redistributing the original gallery images for profit is strictly prohibited.
              </strong>
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 rounded-2xl bg-background p-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">• 原作者版權歸屬：</strong>
              本倉庫收錄的全部姿勢（<code>ai-pose-gallery.pages.dev</code>）、服裝（<code>ai-costume-gallery.pages.dev</code>）、人像（<code>ai-portrait-gallery.pages.dev</code>）參考圖與原始元資料均源自原作者{' '}
              <strong className="text-foreground">ギア（@giaaibusi）</strong> 公開站點，著作權歸原作者所有。本倉庫僅為多語系本地化翻譯整理與前端工程學習存檔，不對原始圖片主張任何所有權。
            </p>
            <p>
              <strong className="text-foreground">• 使用與分發限制：</strong>
              人像庫遵循 <strong className="text-emerald-600 dark:text-emerald-400">CC0 1.0 協議</strong>；姿勢庫與服裝庫免費供個人學習與 AI 生圖參考使用，
              <strong className="text-foreground">嚴禁將本圖庫原始圖片打包轉售或用於付費分發</strong>。
            </p>
          </div>
        )}
      </Section>
    </>
  )
}
