import { LanguagesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Locale, useI18n } from '@/i18n'

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('切換語言', 'Switch language')}
          className="gap-1.5 px-2.5 text-xs font-medium"
        >
          <LanguagesIcon className="size-4" />
          <span>{locale === 'en' ? 'EN' : '繁中'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          <DropdownMenuRadioItem value="zh-TW">繁體中文 (zh-TW)</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">English (en)</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
