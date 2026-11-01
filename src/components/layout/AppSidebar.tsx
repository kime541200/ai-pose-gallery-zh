import { Link, useLocation } from '@tanstack/react-router'
import { ExternalLinkIcon, LayersIcon, SparklesIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useI18n } from '@/i18n'
import { useStudio } from '@/store/studioStore'
import { activeNavTo, navGroups } from './nav'

export function AppSidebar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const active = activeNavTo(pathname)
  const { recipe } = useStudio()
  const { t } = useI18n()
  const count = [recipe.portrait, recipe.costume, recipe.pose].filter(Boolean).length

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LayersIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">POSE &amp; CHARACTER</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t('AI 角色三合一參考台', '3-in-1 Character Reference')}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{t(group.label, group.labelEn)}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const label = t(item.title, item.titleEn)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={item.to === active} tooltip={label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span className="flex-1 truncate">{label}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px] font-medium">
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={t('當前角色配方', 'Current Character Recipe')}>
              <Link to="/studio" className="bg-sidebar-accent/70 hover:bg-sidebar-accent">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SparklesIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-semibold">
                    {t(`角色配方槽 (${count}/3)`, `Recipe Slots (${count}/3)`)}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {count === 0
                      ? t('未選擇 · 點擊去捏人', 'Empty · Click to build')
                      : t('點擊進入 AI 合成台', 'Open AI Studio')}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild tooltip={t('訪問 GitHub 倉庫', 'Visit GitHub Repository')}>
              <a
                href="https://github.com/kime541200/ai-pose-gallery-zh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground"
              >
                <ExternalLinkIcon className="size-3.5" />
                <span>GitHub · ai-pose-gallery-zh</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
