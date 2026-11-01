import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, RotateCcwIcon, SparklesIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, Section } from '@/components/common/FormSection'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PROVIDER_META } from '@/services/aiGenerator'
import { useStudio } from '@/store/studioStore'
import type { ImagePassMode, ImageProviderId } from '@/types/gallery'

export const Route = createFileRoute('/settings')({
  staticData: { title: 'API 配置' },
  component: SettingsPage,
})

const PROVIDER_ORDER: ImageProviderId[] = ['gemini', 'gpt', 'qwen', 'doubao', 'comfyui']

function SettingsPage() {
  const { apiConfig, updateApiConfig, updateProviderConfig, updateComfyuiParams } = useStudio()
  const [showKey, setShowKey] = useState(false)

  const pid = apiConfig.activeProvider
  const meta = PROVIDER_META[pid]
  const pCfg = apiConfig.providers[pid]

  return (
    <>
      <PageHeader
        title="API 接口配置"
        actions={
          <Button size="sm" asChild>
            <Link to="/studio">
              <SparklesIcon className="size-4" />
              返回合成台
            </Link>
          </Button>
        }
      />

      {/* 四大协议切换标签 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PROVIDER_ORDER.map((id) => {
          const itemMeta = PROVIDER_META[id]
          const isActive = pid === id
          const hasKey = id === 'comfyui' || Boolean(apiConfig.providers[id].apiKey.trim())
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
                title={hasKey ? '已配置 Key' : '未配置 Key'}
              />
            </button>
          )
        })}
      </div>

      {/* 当前厂商连接配置 */}
      <Section
        title={`${meta.name} 连接配置`}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild>
              <a href={meta.docUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-3.5" />
                文档
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                updateProviderConfig(pid, {
                  baseUrl: meta.defaultBaseUrl,
                  model: meta.models[0].value,
                })
                toast.success('已恢复默认')
              }}
            >
              <RotateCcwIcon className="size-3.5" />
              重置
            </Button>
          </div>
        }
      >
        <Field label="Base URL">
          <Input
            type="url"
            value={pCfg.baseUrl}
            onChange={(e) => updateProviderConfig(pid, { baseUrl: e.target.value })}
            placeholder={meta.defaultBaseUrl}
          />
        </Field>

        {pid !== 'comfyui' && (
        <Field label="API Key">
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={pCfg.apiKey}
              onChange={(e) => updateProviderConfig(pid, { apiKey: e.target.value })}
              placeholder="输入 API Key（仅保存在本地浏览器）"
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
        )}

        {pid === 'comfyui' && (
          <>
            <p className="text-xs text-muted-foreground">
              无需 API Key。Base URL 默认 /comfy（Docker 由 nginx 转发到环境变量 COMFYUI_UPSTREAM，
              开发模式由 Vite 转发到本机 8188）。以下为 ComfyUI models/ 下的相对路径，需与你已安装的文件一致。
            </p>
            {(
              [
                ['unet', '扩散模型（models/diffusion_models 或 models/unet）'],
                ['clip', '文本编码器（models/text_encoders）'],
                ['vae', 'VAE（models/vae）'],
                ['lora', '加速 LoRA（models/loras，僅 Qwen-Edit 使用，FLUX 3 留空）'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  value={apiConfig.comfyuiParams[key]}
                  onChange={(e) => updateComfyuiParams({ [key]: e.target.value })}
                  className="font-mono text-xs"
                />
              </Field>
            ))}
          </>
        )}

        <Field label="默认模型 ID">
          <Select
            value={pCfg.model}
            onValueChange={(v) => updateProviderConfig(pid, { model: v })}
          >
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

        {pCfg.model === 'custom' && (
          <Field label="自定义模型 ID">
            <Input
              value={pCfg.customModel}
              onChange={(e) => updateProviderConfig(pid, { customModel: e.target.value })}
              placeholder={pid === 'doubao' ? 'ep-2026xxxx 或模型 ID' : '输入模型 ID'}
              className="font-mono text-xs"
            />
          </Field>
        )}
      </Section>

      {/* 全局传输设置 */}
      <Section title="全局请求选项">
        <Field label="参考图传参方式">
          <Select
            value={apiConfig.imagePassMode}
            onValueChange={(v) => updateApiConfig({ imagePassMode: v as ImagePassMode })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="url">传递图片 URL（免上传文件，推荐）</SelectItem>
              <SelectItem value="base64">转 Base64 编码传输</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="服务端 CORS 代理 (/api/proxy)">
          <div className="flex h-9 items-center justify-between rounded-xl border bg-background px-3">
            <span className="text-xs text-muted-foreground">
              {apiConfig.useProxy ? '已启用（解决跨域限制）' : '已关闭（浏览器直连）'}
            </span>
            <Switch
              checked={apiConfig.useProxy}
              onCheckedChange={(v) => updateApiConfig({ useProxy: v })}
            />
          </div>
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => toast.success('配置已保存')}>
          <CheckIcon className="size-4" />
          保存配置
        </Button>
      </div>
    </>
  )
}
