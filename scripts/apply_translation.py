# -*- coding: utf-8 -*-
"""把日文/英文数据回填为多语（简中 / 繁中 / 英文）检索与前端词典：
- Pose:     data/pose-zh.json / meta-zh.json
- Costume:  data/costume-zh.json / costume-meta-zh.json
- Portrait: data/portrait-zh.json / portrait-meta-zh.json
- 对照表:   data/translations.csv
- 前端词典: src/i18n/galleryData.ts

用法（在仓库根目录）: python3 scripts/apply_translation.py
"""
import csv
import json
import os
import sys
from collections import Counter

import i18n

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SRC_I18N = os.path.join(ROOT, "src", "i18n")

# ==============================================================================
# 1. POSE 翻译
# ==============================================================================
with open(os.path.join(DATA, "pose.json"), encoding="utf-8") as f:
    pose_data = json.load(f)
with open(os.path.join(DATA, "meta.json"), encoding="utf-8") as f:
    pose_meta = json.load(f)

pose_maps = {
    "系統": i18n.SYSTEM,
    "分類": i18n.CATEGORY,
    "アングル": i18n.ANGLE,
    "ポーズ名": i18n.POSE,
}

missing = {k: sorted({x.get(k) for x in pose_data} - set(m)) for k, m in pose_maps.items()}
bad = {k: v for k, v in missing.items() if v}
if bad:
    print("!! Pose 缺失译词：")
    for k, v in bad.items():
        for s in v:
            print(f"  [{k}] {s}")
    sys.exit(1)

pose_out = []
for x in pose_data:
    sys_cn = i18n.SYSTEM[x["系統"]]
    sys_tw = i18n.SYSTEM_ZH_TW[x["系統"]]
    sys_en = i18n.SYSTEM_EN[x["系統"]]
    cat_cn = i18n.CATEGORY[x["分類"]]
    cat_tw = i18n.CATEGORY_ZH_TW[x["分類"]]
    cat_en = i18n.CATEGORY_EN[x["分類"]]
    pose_cn = i18n.POSE[x["ポーズ名"]]
    pose_tw = i18n.POSE_ZH_TW[x["ポーズ名"]]
    pose_en = i18n.POSE_EN[x["ポーズ名"]]
    ang_cn = i18n.ANGLE[x["アングル"]]
    ang_tw = i18n.ANGLE_ZH_TW[x["アングル"]]
    ang_en = i18n.ANGLE_EN[x["アングル"]]

    pose_out.append({
        "id": x["id"],
        "体系": sys_cn,
        "姿势编号": x["ポーズ番号"],
        "分类": cat_cn,
        "姿势名称": pose_cn,
        "角度": ang_cn,
        "缩略图": x["サムネ"],
        "原图": x["原寸"],
        "检索": f'{x["id"]} {sys_cn}{cat_cn}{pose_cn}{ang_cn} {sys_tw}{cat_tw}{pose_tw}{ang_tw} {sys_en} {cat_en} {pose_en} {ang_en}',
    })
with open(os.path.join(DATA, "pose-zh.json"), "w", encoding="utf-8") as f:
    json.dump(pose_out, f, ensure_ascii=False, indent=1)

with open(os.path.join(DATA, "meta-zh.json"), "w", encoding="utf-8") as f:
    json.dump({"体系分类": [i18n.SYSTEM[s] for s in pose_meta["lines"]]}, f, ensure_ascii=False, indent=2)

# ==============================================================================
# 2. COSTUME 翻译
# ==============================================================================
costume_path = os.path.join(DATA, "costume.json")
costume_out = []
costume_name_tw_map: dict[str, str] = {}
costume_name_en_map: dict[str, str] = {}
if os.path.exists(costume_path):
    with open(costume_path, encoding="utf-8") as f:
        costume_data = json.load(f)
    with open(os.path.join(DATA, "costume-meta.json"), encoding="utf-8") as f:
        costume_meta = json.load(f)

    missing_cats = sorted({x["カテゴリ"] for x in costume_data} - set(i18n.COSTUME_CATEGORY))
    missing_words = sorted({w for x in costume_data for w in x["キーワード"].split()} - set(i18n.COSTUME_WORD_ALL))
    if missing_cats or missing_words:
        print("!! Costume 缺失译词：", missing_cats, missing_words)
        sys.exit(1)

    for x in costume_data:
        cid = x["id"]
        cat_zh = i18n.COSTUME_CATEGORY[x["カテゴリ"]]
        cat_tw = i18n.COSTUME_CATEGORY_ZH_TW[x["カテゴリ"]]
        cat_en = i18n.COSTUME_CATEGORY_EN[x["カテゴリ"]]
        name_zh, tags_zh = i18n.translate_costume_keywords(x["キーワード"])
        name_tw, tags_tw = i18n.translate_costume_keywords_zh_tw(x["キーワード"])
        name_en, tags_en = i18n.translate_costume_keywords_en(x["キーワード"])
        costume_name_tw_map[name_zh] = name_tw
        costume_name_en_map[name_zh] = name_en
        thumb_rel = f"thumbs/costume/{cid}.webp"
        img_rel = f"img/costume/{cid}.webp"
        costume_out.append({
            "id": cid,
            "分类": cat_zh,
            "服装名称": name_zh,
            "标签": tags_zh,
            "关键词": x["キーワード"],
            "缩略图": thumb_rel,
            "预览图": img_rel,
            "原图": img_rel,
            "检索": f'{cid} {cat_zh} {name_zh} {" ".join(tags_zh)} {cat_tw} {name_tw} {" ".join(tags_tw)} {cat_en} {name_en} {x["キーワード"]}',
        })

    with open(os.path.join(DATA, "costume-zh.json"), "w", encoding="utf-8") as f:
        json.dump(costume_out, f, ensure_ascii=False, indent=1)

    with open(os.path.join(DATA, "costume-meta-zh.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "total": costume_meta["total"],
                "分类列表": [i18n.COSTUME_CATEGORY[c] for c in costume_meta["cats"]],
                "各分类数量": {i18n.COSTUME_CATEGORY[k]: v for k, v in costume_meta["counts"].items()},
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

# ==============================================================================
# 3. PORTRAIT 翻译
# ==============================================================================
portrait_path = os.path.join(DATA, "portrait.json")
portrait_out = []
if os.path.exists(portrait_path):
    with open(portrait_path, encoding="utf-8") as f:
        portrait_data = json.load(f)
    with open(os.path.join(DATA, "portrait-ranking.json"), encoding="utf-8") as f:
        portrait_rank = json.load(f)

    missing_sec = sorted({x["section"] for x in portrait_data} - set(i18n.PORTRAIT_SECTION))
    missing_hair = sorted({x["hair"] for x in portrait_data} - set(i18n.PORTRAIT_HAIR))
    missing_style = sorted({x.get("style", "") for x in portrait_data} - set(i18n.PORTRAIT_STYLE))
    if missing_sec or missing_hair or missing_style:
        print("!! Portrait 缺失译词：", missing_sec, missing_hair, missing_style)
        sys.exit(1)

    rank_set = set(portrait_rank.get("top", {}).get("総合", []))
    for x in portrait_data:
        pid = x["id"]
        sec_zh = i18n.PORTRAIT_SECTION[x["section"]]
        sec_tw = i18n.PORTRAIT_SECTION_ZH_TW[x["section"]]
        sec_en = i18n.PORTRAIT_SECTION_EN[x["section"]]
        hair_zh = i18n.PORTRAIT_HAIR[x["hair"]]
        hair_tw = i18n.PORTRAIT_HAIR_ZH_TW[x["hair"]]
        hair_en = i18n.PORTRAIT_HAIR_EN[x["hair"]]
        raw_style = x.get("style", "")
        style_zh = i18n.PORTRAIT_STYLE[raw_style]
        style_tw = i18n.PORTRAIT_STYLE_ZH_TW[raw_style]
        style_en = i18n.PORTRAIT_STYLE_EN[raw_style]
        if not raw_style:
            title_zh = f"{hair_zh}・标准款"
        elif hair_zh in style_zh:
            title_zh = style_zh
        else:
            title_zh = f"{hair_zh}・{style_zh}"
        thumb_rel = f"thumbs/portrait/{pid}.webp"
        full_rel = f"img/portrait/{pid}.webp"
        portrait_out.append({
            "id": pid,
            "分区": sec_zh,
            "发长": hair_zh,
            "发型名称": style_zh,
            "标题": title_zh,
            "宽": x["w"],
            "高": x["h"],
            "字节数": x.get("bytes", 0),
            "精选": bool(x.get("hero")),
            "热门": pid in rank_set,
            "缩略图": thumb_rel,
            "原图": full_rel,
            "检索": f"{pid} {sec_zh} {hair_zh} {style_zh} {sec_tw} {hair_tw} {style_tw} {sec_en} {hair_en} {style_en}",
        })

    with open(os.path.join(DATA, "portrait-zh.json"), "w", encoding="utf-8") as f:
        json.dump(portrait_out, f, ensure_ascii=False, indent=1)

    with open(os.path.join(DATA, "portrait-meta-zh.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "total": len(portrait_out),
                "分区列表": [i18n.PORTRAIT_SECTION["face"], i18n.PORTRAIT_SECTION["styling"]],
                "发长列表": [i18n.PORTRAIT_HAIR[h] for h in ["ショート", "ミディアム", "セミロング", "ロング"]],
                "排行榜分类": [i18n.PORTRAIT_HAIR[c] for c in portrait_rank.get("cats", [])],
                "排行榜Top10": {
                    i18n.PORTRAIT_HAIR[k]: v for k, v in portrait_rank.get("top", {}).items()
                },
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

# ==============================================================================
# 4. 导出多语对照表 translations.csv
# ==============================================================================
with open(os.path.join(DATA, "translations.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["字段", "原文", "简体中文", "繁體中文", "English", "出现次数"])
    pose_tw_maps = {
        "系統": i18n.SYSTEM_ZH_TW,
        "分類": i18n.CATEGORY_ZH_TW,
        "アングル": i18n.ANGLE_ZH_TW,
        "ポーズ名": i18n.POSE_ZH_TW,
    }
    pose_en_maps = {
        "系統": i18n.SYSTEM_EN,
        "分類": i18n.CATEGORY_EN,
        "アングル": i18n.ANGLE_EN,
        "ポーズ名": i18n.POSE_EN,
    }
    for k in ["系統", "分類", "角度", "ポーズ名"]:
        field = {"系統": "系統", "分類": "分類", "角度": "アングル", "ポーズ名": "ポーズ名"}[k]
        cnt = Counter(x[field] for x in pose_data)
        for jp in sorted(pose_maps[field]):
            w.writerow([f"姿势:{k}", jp, pose_maps[field][jp], pose_tw_maps[field][jp], pose_en_maps[field][jp], cnt[jp]])

    if costume_out:
        cat_cnt = Counter(x["カテゴリ"] for x in costume_data)
        for jp in sorted(i18n.COSTUME_CATEGORY):
            w.writerow(["服装:分类", jp, i18n.COSTUME_CATEGORY[jp], i18n.COSTUME_CATEGORY_ZH_TW[jp], i18n.COSTUME_CATEGORY_EN[jp], cat_cnt[jp]])
        word_cnt = Counter(w_tok for x in costume_data for w_tok in x["キーワード"].split())
        for en in sorted(i18n.COSTUME_WORD_ALL):
            w.writerow(["服装:词条", en, i18n.COSTUME_WORD_ALL[en], i18n.COSTUME_WORD_ALL_ZH_TW[en], i18n.COSTUME_WORD_EN[en], word_cnt[en]])

    if portrait_out:
        sec_cnt = Counter(x["section"] for x in portrait_data)
        for en in sorted(i18n.PORTRAIT_SECTION):
            w.writerow(["人像:分区", en, i18n.PORTRAIT_SECTION[en], i18n.PORTRAIT_SECTION_ZH_TW[en], i18n.PORTRAIT_SECTION_EN[en], sec_cnt[en]])
        hair_cnt = Counter(x["hair"] for x in portrait_data)
        for jp in sorted(i18n.PORTRAIT_HAIR):
            if jp in hair_cnt:
                w.writerow(["人像:发长", jp, i18n.PORTRAIT_HAIR[jp], i18n.PORTRAIT_HAIR_ZH_TW[jp], i18n.PORTRAIT_HAIR_EN[jp], hair_cnt[jp]])
        style_cnt = Counter(x.get("style", "") for x in portrait_data)
        for jp in sorted(i18n.PORTRAIT_STYLE):
            w.writerow(["人像:发型", jp or "(空/默认)", i18n.PORTRAIT_STYLE[jp], i18n.PORTRAIT_STYLE_ZH_TW[jp], i18n.PORTRAIT_STYLE_EN[jp], style_cnt[jp]])

# ==============================================================================
# 5. 生成前端多语词典 src/i18n/galleryData.ts
# ==============================================================================
os.makedirs(SRC_I18N, exist_ok=True)

cn_to_tw_system = {i18n.SYSTEM[k]: i18n.SYSTEM_ZH_TW[k] for k in i18n.SYSTEM}
cn_to_en_system = {i18n.SYSTEM[k]: i18n.SYSTEM_EN[k] for k in i18n.SYSTEM}

cn_to_tw_pose_cat = {i18n.CATEGORY[k]: i18n.CATEGORY_ZH_TW[k] for k in i18n.CATEGORY}
cn_to_en_pose_cat = {i18n.CATEGORY[k]: i18n.CATEGORY_EN[k] for k in i18n.CATEGORY}

cn_to_tw_angle = {i18n.ANGLE[k]: i18n.ANGLE_ZH_TW[k] for k in i18n.ANGLE}
cn_to_en_angle = {i18n.ANGLE[k]: i18n.ANGLE_EN[k] for k in i18n.ANGLE}

cn_to_tw_pose_name = {i18n.POSE[k]: i18n.POSE_ZH_TW[k] for k in i18n.POSE}
cn_to_en_pose_name = {i18n.POSE[k]: i18n.POSE_EN[k] for k in i18n.POSE}

cn_to_tw_costume_cat = {i18n.COSTUME_CATEGORY[k]: i18n.COSTUME_CATEGORY_ZH_TW[k] for k in i18n.COSTUME_CATEGORY}
cn_to_en_costume_cat = {i18n.COSTUME_CATEGORY[k]: i18n.COSTUME_CATEGORY_EN[k] for k in i18n.COSTUME_CATEGORY}

cn_to_tw_costume_tag = {i18n.COSTUME_WORD_ALL[k]: i18n.COSTUME_WORD_ALL_ZH_TW[k] for k in i18n.COSTUME_WORD_ALL}
cn_to_en_costume_tag = {i18n.COSTUME_WORD_ALL[k]: i18n.COSTUME_WORD_EN[k] for k in i18n.COSTUME_WORD_ALL}

cn_to_tw_portrait_sec = {i18n.PORTRAIT_SECTION[k]: i18n.PORTRAIT_SECTION_ZH_TW[k] for k in i18n.PORTRAIT_SECTION}
cn_to_en_portrait_sec = {i18n.PORTRAIT_SECTION[k]: i18n.PORTRAIT_SECTION_EN[k] for k in i18n.PORTRAIT_SECTION}

cn_to_tw_portrait_hair = {i18n.PORTRAIT_HAIR[k]: i18n.PORTRAIT_HAIR_ZH_TW[k] for k in i18n.PORTRAIT_HAIR}
cn_to_en_portrait_hair = {i18n.PORTRAIT_HAIR[k]: i18n.PORTRAIT_HAIR_EN[k] for k in i18n.PORTRAIT_HAIR}

cn_to_tw_portrait_style = {i18n.PORTRAIT_STYLE[k]: i18n.PORTRAIT_STYLE_ZH_TW[k] for k in i18n.PORTRAIT_STYLE}
cn_to_en_portrait_style = {i18n.PORTRAIT_STYLE[k]: i18n.PORTRAIT_STYLE_EN[k] for k in i18n.PORTRAIT_STYLE}

ts_code = f"""// Auto-generated by scripts/apply_translation.py — DO NOT EDIT MANUALLY
import type {{ CostumeItem, PortraitItem, PoseGroup, PoseItem }} from '@/types/gallery'

export type Locale = 'zh-TW' | 'en'

export const POSE_SYSTEM_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_system, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_system, ensure_ascii=False, indent=4)},
}}

export const POSE_CATEGORY_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_pose_cat, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_pose_cat, ensure_ascii=False, indent=4)},
}}

export const POSE_ANGLE_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_angle, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_angle, ensure_ascii=False, indent=4)},
}}

export const POSE_NAME_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_pose_name, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_pose_name, ensure_ascii=False, indent=4)},
}}

export const COSTUME_CATEGORY_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_costume_cat, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_costume_cat, ensure_ascii=False, indent=4)},
}}

export const COSTUME_TAG_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_costume_tag, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_costume_tag, ensure_ascii=False, indent=4)},
}}

export const COSTUME_NAME_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(costume_name_tw_map, ensure_ascii=False, indent=4)},
  en: {json.dumps(costume_name_en_map, ensure_ascii=False, indent=4)},
}}

export const PORTRAIT_SECTION_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_portrait_sec, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_portrait_sec, ensure_ascii=False, indent=4)},
}}

export const PORTRAIT_HAIR_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_portrait_hair, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_portrait_hair, ensure_ascii=False, indent=4)},
}}

export const PORTRAIT_STYLE_MAP: Record<Locale, Record<string, string>> = {{
  'zh-TW': {json.dumps(cn_to_tw_portrait_style, ensure_ascii=False, indent=4)},
  en: {json.dumps(cn_to_en_portrait_style, ensure_ascii=False, indent=4)},
}}

export function localizePoseSystem(val: string, locale: Locale): string {{
  if (val === '上传') return locale === 'en' ? 'Uploaded' : '本機上傳'
  return POSE_SYSTEM_MAP[locale][val] ?? val
}}

export function localizePoseCategory(val: string, locale: Locale): string {{
  if (val === '上传') return locale === 'en' ? 'Uploaded' : '本機上傳'
  return POSE_CATEGORY_MAP[locale][val] ?? val
}}

export function localizePoseAngle(val: string, locale: Locale): string {{
  return POSE_ANGLE_MAP[locale][val] ?? val
}}

export function localizePoseName(val: string, locale: Locale): string {{
  return POSE_NAME_MAP[locale][val] ?? val
}}

export function localizePose(item: PoseItem, locale: Locale) {{
  return {{
    system: localizePoseSystem(item.体系, locale),
    category: localizePoseCategory(item.分类, locale),
    angle: localizePoseAngle(item.角度, locale),
    name: localizePoseName(item.姿势名称, locale),
  }}
}}

export function localizePoseGroup(group: PoseGroup, locale: Locale) {{
  return {{
    system: localizePoseSystem(group.system, locale),
    category: localizePoseCategory(group.category, locale),
    name: localizePoseName(group.name, locale),
  }}
}}

export function localizeCostumeCategory(val: string, locale: Locale): string {{
  if (val === '上传') return locale === 'en' ? 'Uploaded' : '本機上傳'
  return COSTUME_CATEGORY_MAP[locale][val] ?? val
}}

export function localizeCostumeTag(val: string, locale: Locale): string {{
  return COSTUME_TAG_MAP[locale][val] ?? val
}}

export function localizeCostumeName(val: string, locale: Locale): string {{
  return COSTUME_NAME_MAP[locale][val] ?? val
}}

export function localizeCostume(item: CostumeItem, locale: Locale) {{
  return {{
    category: localizeCostumeCategory(item.分类, locale),
    name: localizeCostumeName(item.服装名称, locale),
    tags: (item.标签 || []).map((t) => localizeCostumeTag(t, locale)),
  }}
}}

export function localizePortraitSection(val: string, locale: Locale): string {{
  if (val === '上传') return locale === 'en' ? 'Uploaded' : '本機上傳'
  return PORTRAIT_SECTION_MAP[locale][val] ?? val
}}

export function localizePortraitHair(val: string, locale: Locale): string {{
  return PORTRAIT_HAIR_MAP[locale][val] ?? val
}}

export function localizePortraitStyle(val: string, locale: Locale): string {{
  return PORTRAIT_STYLE_MAP[locale][val] ?? val
}}

export function localizePortrait(item: PortraitItem, locale: Locale) {{
  const section = localizePortraitSection(item.分区, locale)
  const hair = localizePortraitHair(item.发长, locale)
  const styleName = localizePortraitStyle(item.发型名称, locale)
  let title = item.标题
  if (item.source !== 'upload') {{
    if (item.发型名称 === '标准基础款' || !item.发型名称) {{
      title = locale === 'en' ? `${{hair}} · Standard` : `${{hair}}・標準款`
    }} else if (styleName.toLowerCase().includes(hair.toLowerCase())) {{
      title = styleName
    }} else {{
      title = locale === 'en' ? `${{hair}} · ${{styleName}}` : `${{hair}}・${{styleName}}`
    }}
  }}
  return {{ section, hair, styleName, title }}
}}
"""

with open(os.path.join(SRC_I18N, "galleryData.ts"), "w", encoding="utf-8") as f:
    f.write(ts_code)

print(f"OK 姿势记录数: {len(pose_out)}, 服装记录数: {len(costume_out)}, 人像记录数: {len(portrait_out)}")
print("OK 合计翻译记录数:", len(pose_out) + len(costume_out) + len(portrait_out))
