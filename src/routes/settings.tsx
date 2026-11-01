import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ActivityIcon,
  CheckIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  ScanSearchIcon,
  SparklesIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, Section } from '@/components/common/FormSection'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { detectComfyUi, getProviderMeta, PROVIDER_META, testComfyConnection } from '@/services/aiGenerator'
import { useStudio } from '@/store/studioStore'
import type { ImagePassMode, ImageProviderId } from '@/types/gallery'

export const Route = createFileRoute('/settings')({
  staticData: { title: 'API 配置', titleEn: 'API Settings' },
  component: SettingsPage,
})

const PROVIDER_ORDER: ImageProviderId[] = ['gemini', 'gpt', 'qwen', 'doubao', 'comfyui']

function SettingsPage() {
  const { apiConfig, updateApiConfig, updateProviderConfig } = useStudio()
  const { locale, t } = useI18n()
  const [showKey, setShowKey] = useState(false)
  const [testingComfy, setTestingComfy] = useState(false)

  const pid = apiConfig.activeProvider
  const meta = getProviderMeta(pid, locale)
  const pCfg = apiConfig.providers[pid]

  const handleTestComfy = async () => {
    setTestingComfy(true)
    try {
      const info = await testComfyConnection(pCfg.baseUrl, pCfg.apiKey)
      toast.success(t(`連線成功：${info}`, `Connected: ${info}`))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('連線失敗', 'Connection failed'), { duration: 10000 })
    } finally {
      setTestingComfy(false)
    }
  }

  const handleDetectComfy = async () => {
    setTestingComfy(true)
    try {
      const found = await detectComfyUi(pCfg.baseUrl, pCfg.apiKey)
      if (!found) {
        toast.error(
          t(
            '未找到可用的 ComfyUI（已嘗試當前位址、/comfy、127.0.0.1:8188、127.0.0.1:8000），請確認已啟動並檢查跨域設定',
            'No available ComfyUI found (tried current URL, /comfy, 127.0.0.1:8188, 127.0.0.1:8000). Ensure ComfyUI is running and check CORS settings.'
          ),
          { duration: 10000 }
        )
        return
      }
      updateProviderConfig('comfyui', { baseUrl: found.baseUrl })
      toast.success(t(`已識別：${found.info}（${found.baseUrl}）`, `Detected: ${found.info} (${found.baseUrl})`))
    } finally {
      setTestingComfy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={t('API 介面配置', 'API Endpoint Settings')}
        actions={
          <Button size="sm" asChild>
            <Link to="/studio">
              <SparklesIcon className="size-4" />
              {t('返回合成台', 'Back to Studio')}
            </Link>
          </Button>
        }
      />

      {/* 五大協議切換標籤 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PROVIDER_ORDER.map((id) => {
          const itemMeta = getProviderMeta(id, locale)
          const isActive = pid === id
          const hasKey =
            id === 'comfyui'
              ? Boolean(apiConfig.providers.comfyui.baseUrl.trim())
              : Boolean(apiConfig.providers[id].apiKey.trim())
          return (
            <button
              key={id}
              type="button"
              onClick={() => updateApiConfig({ activeProvider: id })}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                isActive
                  ? 'border-primary bg-primary/6 font-semibold shadow-xs'
                  : 'border-border/60 bg-card hover:bg-muted/40'
              }`}
            >
              <span className="truncate text-xs sm:text-sm">{itemMeta.name}</span>
              <span
                className={`size-2 shrink-0 rounded-full ${
                  hasKey ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                }`}
                title={hasKey ? t('已就緒', 'Ready') : t('未配置 Key', 'API Key not set')}
              />
            </button>
          )
        })}
      </div>

      {/* 當前廠商連線配置 */}
      <Section
        title={t(`${meta.name} 連線配置`, `${meta.name} Connection`)}
        actions={
          <div className="flex items-center gap-1.5">
            {pid === 'comfyui' && (
              <>
                <Button variant="outline" size="sm" onClick={handleDetectComfy} disabled={testingComfy}>
                  <ScanSearchIcon className="size-3.5" />
                  {t('自動識別', 'Auto Detect')}
                </Button>
                <Button variant="outline" size="sm" onClick={handleTestComfy} disabled={testingComfy}>
                  <ActivityIcon className="size-3.5" />
                  {testingComfy ? t('檢測中…', 'Testing…') : t('測試連線', 'Test Connection')}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" asChild>
              <a href={meta.docUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-3.5" />
                {t('文件', 'Docs')}
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                updateProviderConfig(pid, {
                  baseUrl: PROVIDER_META[pid].defaultBaseUrl,
                  model: PROVIDER_META[pid].models[0].value,
                })
                toast.success(t('已恢復預設', 'Restored defaults'))
              }}
            >
              <RotateCcwIcon className="size-3.5" />
              {t('重置', 'Reset')}
            </Button>
          </div>
        }
      >
        <Field
          label={pid === 'comfyui' ? t('ComfyUI 位址 (Base URL)', 'ComfyUI Base URL') : 'Base URL'}
          hint={
            pid === 'comfyui'
              ? t(
                  `Docker 或本地開發運行本站時預設填 /comfy（同源代理，Docker 由 nginx 轉發到 COMFYUI_UPSTREAM，無需改跨域設定）；瀏覽器直連時 ComfyUI 需加啟動參數 --enable-cors-header "${typeof window !== 'undefined' ? window.location.origin : '*'}"`,
                  `Use /comfy by default when running via Docker or local dev server (same-origin proxy via nginx/Vite, no CORS setup required). For direct browser connection, launch ComfyUI with --enable-cors-header "${typeof window !== 'undefined' ? window.location.origin : '*'}"`
                )
              : undefined
          }
        >
          <Input
            type={pid === 'comfyui' ? 'text' : 'url'}
            value={pCfg.baseUrl}
            onChange={(e) => updateProviderConfig(pid, { baseUrl: e.target.value })}
            placeholder={meta.defaultBaseUrl}
          />
        </Field>

        <Field label={pid === 'comfyui' ? t('API Key（可選，本地留空）', 'API Key (Optional for local)') : 'API Key'}>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={pCfg.apiKey}
              onChange={(e) => updateProviderConfig(pid, { apiKey: e.target.value })}
              placeholder={
                pid === 'comfyui'
                  ? t('本地 ComfyUI 無需填寫，遠端鑑權可填 Token', 'Leave blank for local ComfyUI, or enter Bearer token')
                  : t('輸入 API Key（僅保存在本地瀏覽器）', 'Enter API Key (stored locally in your browser only)')
              }
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </Field>

        {pid !== 'comfyui' && (
          <Field label={t('預設模型 ID', 'Default Model ID')}>
            <Select value={pCfg.model} onValueChange={(v) => updateProviderConfig(pid, { model: v })}>
              <SelectTrigger className="w-full font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meta.models.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="font-mono text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {pid !== 'comfyui' && pCfg.model === 'custom' && (
          <Field label={t('自訂模型 ID', 'Custom Model ID')}>
            <Input
              value={pCfg.customModel}
              onChange={(e) => updateProviderConfig(pid, { customModel: e.target.value })}
              placeholder={
                pid === 'doubao' ? t('ep-2026xxxx 或模型 ID', 'ep-2026xxxx or model ID') : t('輸入模型 ID', 'Enter model ID')
              }
              className="font-mono text-xs"
            />
          </Field>
        )}
      </Section>

      {pid === 'comfyui' && (
        <p className="text-sm text-muted-foreground">
          {t(
            '模型由工作流決定。請返回合成台匯入工作流，並設定人像、服裝和姿勢節點。',
            'Models are determined by the ComfyUI workflow. Return to the Studio to select or import a workflow and map Portrait, Costume, and Pose nodes.'
          )}
        </p>
      )}

      {/* 全域傳輸設定 */}
      {pid !== 'comfyui' && (
        <Section title={t('全域請求選項', 'Global Request Options')}>
          <Field label={t('參考圖傳參方式', 'Reference Image Passing Mode')}>
            <Select
              value={apiConfig.imagePassMode}
              onValueChange={(v) => updateApiConfig({ imagePassMode: v as ImagePassMode })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="url">
                  {t('傳遞圖片 URL（免上傳檔案，推薦）', 'Pass Image URL (No file upload, recommended)')}
                </SelectItem>
                <SelectItem value="base64">{t('轉 Base64 編碼傳輸', 'Convert to Base64 Data URL')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('伺服端 CORS 代理 (/api/proxy)', 'Server CORS Proxy (/api/proxy)')}>
            <div className="flex h-9 items-center justify-between rounded-xl border bg-background px-3">
              <span className="text-xs text-muted-foreground">
                {apiConfig.useProxy
                  ? t('已啟用（解決跨域限制）', 'Enabled (bypasses browser CORS limits)')
                  : t('已關閉（瀏覽器直連）', 'Disabled (direct browser connection)')}
              </span>
              <Switch checked={apiConfig.useProxy} onCheckedChange={(v) => updateApiConfig({ useProxy: v })} />
            </div>
          </Field>
        </Section>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => toast.success(t('配置已保存', 'Settings saved'))}>
          <CheckIcon className="size-4" />
          {t('保存配置', 'Save Settings')}
        </Button>
      </div>
    </>
  )
}
