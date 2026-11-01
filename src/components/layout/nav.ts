import type { LinkProps } from '@tanstack/react-router'
import {
  BookOpenIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  PersonStandingIcon,
  ShirtIcon,
  SparklesIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  titleEn: string
  to: NonNullable<LinkProps['to']>
  icon: LucideIcon
  badge?: string
}

export interface NavGroup {
  label: string
  labelEn: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: '工作台',
    labelEn: 'Workspace',
    items: [
      { title: '圖庫總覽', titleEn: 'Overview', to: '/', icon: LayoutDashboardIcon },
      { title: 'AI 角色合成台', titleEn: 'AI Character Studio', to: '/studio', icon: SparklesIcon, badge: 'PRO' },
    ],
  },
  {
    label: '三大參考圖庫',
    labelEn: 'Reference Galleries',
    items: [
      { title: '動作姿勢庫', titleEn: 'Pose Gallery', to: '/poses', icon: PersonStandingIcon, badge: '1,439' },
      { title: '服裝穿搭庫', titleEn: 'Costume Gallery', to: '/costumes', icon: ShirtIcon, badge: '1,407' },
      { title: '人像顏值庫', titleEn: 'Portrait Gallery', to: '/portraits', icon: UserRoundIcon, badge: '1,499' },
    ],
  },
  {
    label: '配置與說明',
    labelEn: 'Settings & Guide',
    items: [
      { title: 'API 介面配置', titleEn: 'API Settings', to: '/settings', icon: KeyRoundIcon },
      { title: '使用說明與免責聲明', titleEn: 'Guide & Disclaimer', to: '/guide', icon: BookOpenIcon },
    ],
  },
]

const allItems = navGroups.flatMap((g) => g.items)

export function activeNavTo(pathname: string): string | undefined {
  let best: string | undefined
  for (const { to } of allItems) {
    const hit = to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
    if (hit && (!best || to.length > best.length)) best = to
  }
  return best
}
