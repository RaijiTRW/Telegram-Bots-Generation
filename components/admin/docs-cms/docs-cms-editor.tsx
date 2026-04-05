'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  FilePlus2,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import Image from 'next/image'

import {
  createDocsPageAction,
  createRedirectAction,
  deleteDocsPageAction,
  deleteRedirectAction,
  getDocsEditorPayloadAction,
  getDocsTreeAction,
  moveDocsPageAction,
  publishDocsPageAction,
  reorderDocsSiblingsAction,
  restoreDocsRevisionAction,
  saveDocsDraftAction,
  syncDocsCmsFromLegacyAction,
  updateDocsPageMetaAction,
} from '@/app/actions/docs-admin'
import { validateDocsBlocksByMode } from '@/lib/docs-cms/blocks'
import type { DocsBlock, DocsLocale, DocsPageNode, DocsRevision, DocsSeo } from '@/lib/docs-cms/types'
import { TipTapEditor } from './tiptap-editor'
import { DocsCmsBlockEditor } from './docs-cms-block-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getLocaleFlag } from '@/lib/i18n/locale-flags'

type Notice = {
  type: 'success' | 'error' | 'warning' | 'info'
  text: string
} | null

type BlockUploadState = {
  uploading: boolean
  progress: number
}

function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 rounded-md border px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#24A1DE]/30 ${className || ''}`}
    >
      {children}
    </select>
  )
}

const DEFAULT_SEO: DocsSeo = {}

const CMS_TEXT = {
  ru: {
    localeLabel: 'Язык документации',
    localeDescription: '🇷🇺 и 🇺🇸 редактируются отдельно.',
    pagesTitle: 'Страницы',
    newPage: 'Новая страница',
    newPageTitle: 'Название',
    newPageSlug: 'Слаг (URL)',
    createPage: 'Создать страницу',
    rootDrop: 'Перетащи страницу сюда, чтобы сделать корневой',
    importCurrentDocs: 'Импортировать текущую документацию',
    importHint:
      'Один раз перенесите существующие docs в CMS, после этого вы сможете редактировать все страницы визуально.',
    syncCurrentDocs: 'Синхронизировать полную документацию',
    syncHint:
      'Перезапишет CMS-страницы актуальным контентом текущей документации (включая все разделы и таблицы).',
    syncConfirm:
      'Синхронизировать CMS с текущей документацией? Текущий текст в CMS будет перезаписан.',
    syncSuccess: 'CMS синхронизирована с текущей документацией',
    loading: 'Загрузка...',
    noPagesTitle: 'Страницы пока не созданы',
    noPagesText:
      'Нажмите «Импортировать текущую документацию», чтобы забрать текущие docs в CMS и начать редактирование.',
    editor: 'Редактор документации',
    path: 'Путь',
    selectPage: 'Выберите страницу',
    up: 'Выше',
    down: 'Ниже',
    openPublished: 'Открыть опубликованную',
    openSettings: 'Настройки страницы',
    deletePage: 'Удалить',
    saveDraft: 'Сохранить черновик',
    publish: 'Опубликовать',
    modeEdit: 'Редактор',
    modePreview: 'Визуальный просмотр',
    addBlock: 'Добавить блок',
    unsaved: 'Есть несохраненные изменения (автосохранение каждые 8 секунд)',
    saved: 'Сохранено',
    addFirstBlock: 'Добавьте первый блок',
    livePreviewDescription:
      'Это живой предпросмотр текущего черновика. Здесь вы видите, как страница будет выглядеть после публикации.',
    emptyPreview: 'В этой странице пока нет блоков.',
    meta: 'Параметры страницы',
    pageTitle: 'Название страницы',
    parent: 'Родительская страница',
    noParent: 'Без родителя',
    homePage: 'Сделать главной страницей документации',
    seo: 'SEO',
    seoTitle: 'SEO заголовок',
    seoDescription: 'SEO описание',
    ogImage: 'OG изображение (URL)',
    noIndex: 'Не индексировать (noindex)',
    redirects: 'Редиректы',
    oldPath: 'Старый путь',
    history: 'История версий',
    restore: 'Откатить',
    settingsTitle: 'Настройки страницы',
    createPageTitle: 'Создание страницы',
    closeModal: 'Закрыть',
    quickGuideTitle: 'Как работать',
    quickGuideLine1: '1. Заполните название и слаг страницы.',
    quickGuideLine2: '2. Нажмите «Сохранить черновик».',
    quickGuideLine3: '3. Проверьте в «Визуальный просмотр».',
    quickGuideLine4: '4. Нажмите «Опубликовать».',
    homeBadge: 'ГЛАВНАЯ',
    blockLabel: 'Тип блока',
    dragMedia: 'Перетащите файл сюда или выберите файл',
    selectFile: 'Выбрать',
    caption: 'Подпись',
    embedUrl: 'Ссылка embed',
    label: 'Текст кнопки',
    blockPath: 'Ссылка кнопки',
  },
  en: {
    localeLabel: 'Documentation language',
    localeDescription: '🇷🇺 and 🇺🇸 are edited separately.',
    pagesTitle: 'Pages',
    newPage: 'New page',
    newPageTitle: 'Title',
    newPageSlug: 'Slug (URL)',
    createPage: 'Create page',
    rootDrop: 'Drop page here to move it to root level',
    importCurrentDocs: 'Import current documentation',
    importHint:
      'Run once to migrate existing docs into CMS, then edit all pages visually.',
    syncCurrentDocs: 'Sync full docs',
    syncHint:
      'Overwrite CMS pages with the full current documentation content (including all sections and tables).',
    syncConfirm:
      'Sync CMS with current documentation? Existing CMS text for these pages will be replaced.',
    syncSuccess: 'CMS synced with current documentation',
    loading: 'Loading...',
    noPagesTitle: 'No pages yet',
    noPagesText: 'Click “Import current documentation” to bring existing docs into CMS and start editing.',
    editor: 'Documentation editor',
    path: 'Path',
    selectPage: 'Select a page',
    up: 'Up',
    down: 'Down',
    openPublished: 'Open published',
    openSettings: 'Page settings',
    deletePage: 'Delete',
    saveDraft: 'Save draft',
    publish: 'Publish',
    modeEdit: 'Editor',
    modePreview: 'Live preview',
    addBlock: 'Add block',
    unsaved: 'You have unsaved changes (autosave every 8 seconds)',
    saved: 'Saved',
    addFirstBlock: 'Add your first block',
    livePreviewDescription:
      'This is a live preview of your current draft. It shows how the page will look after publishing.',
    emptyPreview: 'This page has no blocks yet.',
    meta: 'Page settings',
    pageTitle: 'Page title',
    parent: 'Parent page',
    noParent: 'No parent',
    homePage: 'Set as docs home page',
    seo: 'SEO',
    seoTitle: 'SEO title',
    seoDescription: 'SEO description',
    ogImage: 'OG image URL',
    noIndex: 'Do not index (noindex)',
    redirects: 'Redirects',
    oldPath: 'Old path',
    history: 'Version history',
    restore: 'Restore',
    settingsTitle: 'Page settings',
    createPageTitle: 'Create page',
    closeModal: 'Close',
    quickGuideTitle: 'How to use',
    quickGuideLine1: '1. Fill in page title and slug.',
    quickGuideLine2: '2. Click “Save draft”.',
    quickGuideLine3: '3. Check “Live preview”.',
    quickGuideLine4: '4. Click “Publish”.',
    homeBadge: 'HOME',
    blockLabel: 'Block type',
    dragMedia: 'Drag & drop file here or choose file',
    selectFile: 'Select',
    caption: 'Caption',
    embedUrl: 'Embed URL',
    label: 'Button label',
    blockPath: 'Button link',
  },
} as const

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}



function flattenTree(nodes: DocsPageNode[], out: DocsPageNode[] = []): DocsPageNode[] {
  for (const node of nodes) {
    out.push(node)
    if (node.children.length > 0) {
      flattenTree(node.children, out)
    }
  }
  return out
}

function findSiblings(nodes: DocsPageNode[], targetId: string): DocsPageNode[] {
  const walk = (list: DocsPageNode[]): DocsPageNode[] | null => {
    for (const node of list) {
      if (node.id === targetId) {
        return list
      }
      const nested = walk(node.children)
      if (nested) return nested
    }
    return null
  }
  return walk(nodes) || []
}


function convertBlocksToHtml(blocks: DocsBlock[]): string {
  if (!blocks || blocks.length === 0) return ''
  if (blocks.length === 1 && blocks[0].type === 'richText') return (blocks[0] as any).content

  let html = ''
  for (const block of blocks) {
    if (block.type === 'richText') {
      html += (block as any).content
    } else if (block.type === 'heading') {
      html += `<h${(block as any).level}>${(block as any).text}</h${(block as any).level}>`
    } else if (block.type === 'paragraph') {
      html += `<p>${(block as any).richText.replace(/\n/g, '<br/>')}</p>`
    } else if (block.type === 'list') {
      const tag = (block as any).ordered ? 'ol' : 'ul'
      html += `<${tag}>${(block as any).items.map((i: string) => `<li>${i}</li>`).join('')}</${tag}>`
    } else if (block.type === 'image') {
      html += `<img src="${(block as any).url}" alt="${(block as any).alt || ''}" />`
    } else if (block.type === 'video') {
      html += `<custom-video src="${(block as any).url}" caption="${(block as any).caption || ''}"></custom-video>`
    } else if (block.type === 'code') {
      html += `<pre><code>${(block as any).code}</code></pre>`
    } else if (block.type === 'divider') {
      html += `<hr/>`
    } else if (block.type === 'callout') {
      html += `<blockquote><strong>${(block as any).title}</strong><br/>${(block as any).text}</blockquote>`
    }
  }
  return html
}

export function DocsCmsEditor() {
  const [locale, setLocale] = useState<DocsLocale>('ru')
  const isRu = locale === 'ru'
  const text = isRu ? CMS_TEXT.ru : CMS_TEXT.en
  const [tree, setTree] = useState<DocsPageNode[]>([])
  const [isLoadingTree, setIsLoadingTree] = useState(true)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isCreatePageModalOpen, setIsCreatePageModalOpen] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [loadedPageId, setLoadedPageId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [isHome, setIsHome] = useState(false)
  const [seo, setSeo] = useState<DocsSeo>(DEFAULT_SEO)
  const [blocks, setBlocks] = useState<DocsBlock[]>([])
  const [revisions, setRevisions] = useState<DocsRevision[]>([])
  const [redirects, setRedirects] = useState<Array<{ id: string; fromPath: string; isActive: boolean; createdAt: string }>>([])
  const [newRedirectPath, setNewRedirectPath] = useState('')
  const [newPageTitle, setNewPageTitle] = useState('')
  const [newPageSlug, setNewPageSlug] = useState('')
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
  const [dragTargetId, setDragTargetId] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState<'before' | 'inside' | 'after'>('inside')
  const [isDirty, setIsDirty] = useState(false)
  const saveTimerRef = useRef<number | null>(null)
  const loadContentRequestIdRef = useRef<string | null>(null)
  const syncedLocalesRef = useRef<Partial<Record<DocsLocale, boolean>>>({})

  const flatPages = useMemo(() => flattenTree(tree), [tree])
  const selectedPage = useMemo(
    () => flatPages.find((page) => page.id === selectedPageId) || null,
    [flatPages, selectedPageId]
  )

  const loadTree = useCallback(async () => {
    setIsLoadingTree(true)
    try {
      const response = await getDocsTreeAction(locale)
      if (!response.success) {
        throw new Error(response.error)
      }
      const nextTree = response.data
      setTree(nextTree)
      const flat = flattenTree(nextTree)
      setSelectedPageId((prev) => {
        if (prev && flat.some((item) => item.id === prev)) {
          return prev
        }
        return flat[0]?.id || null
      })
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Не удалось загрузить дерево страниц' : 'Failed to load pages tree'}: ${String(error)}`,
      })
    } finally {
      setIsLoadingTree(false)
    }
  }, [locale, isRu])

  const loadPage = useCallback(
    async (pageId: string) => {
      loadContentRequestIdRef.current = pageId
      setIsLoadingPage(true)
      setLoadedPageId(null)
      try {
        const response = await getDocsEditorPayloadAction(locale, pageId)
        if (!response.success) {
          throw new Error(response.error)
        }
        const payload = response.data
        if (!payload) {
          throw new Error('Страница не найдена')
        }

        if (loadContentRequestIdRef.current !== pageId) return // Abort if another page was requested since


        setSelectedPageId(payload.page.id)
        setLoadedPageId(payload.page.id)
        setTitle(payload.page.title)
        setSlug(payload.page.slug)
        setParentId(payload.page.parentId)
        setIsHome(payload.page.isHome)
        setSeo(payload.draft.seo || DEFAULT_SEO)
        setBlocks(payload.draft.blocks || [])
        setRevisions(payload.revisions)
        setRedirects(payload.redirects)
        setIsDirty(false)
      } catch (error) {
        setNotice({
          type: 'error',
          text: `${isRu ? 'Не удалось загрузить страницу' : 'Failed to load page'}: ${String(error)}`,
        })
      } finally {
        if (loadContentRequestIdRef.current === pageId) {
          setIsLoadingPage(false)
        }
      }
    },
    [locale, isRu]
  )

  useEffect(() => {
    let isActive = true

    const syncAndLoad = async () => {
      setIsLoadingTree(true)
      try {
        if (!syncedLocalesRef.current[locale]) {
          const syncResponse = await syncDocsCmsFromLegacyAction()
          if (!syncResponse.success) {
            throw new Error(syncResponse.error)
          }
          syncedLocalesRef.current[locale] = true
        }
      } catch (error) {
        if (isActive) {
          setNotice({
            type: 'error',
            text: `${isRu ? 'Не удалось синхронизировать документацию' : 'Failed to sync docs'}: ${String(error)}`,
          })
        }
      } finally {
        if (isActive) {
          await loadTree()
        }
      }
    }

    void syncAndLoad()

    return () => {
      isActive = false
    }
  }, [locale, isRu, loadTree])

  useEffect(() => {
    if (!selectedPageId) return
    void loadPage(selectedPageId)
  }, [selectedPageId, loadPage, locale])

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!selectedPageId) return false
    setIsSaving(true)
    setNotice(null)
    try {
      const validate = validateDocsBlocksByMode(blocks as never, 'draft')
      if (!validate.valid) {
        throw new Error(validate.errors.join(' '))
      }

      const metaResponse = await updateDocsPageMetaAction({
        locale,
        pageId: selectedPageId,
        title,
        slug,
        parentId,
        isHome,
        seo,
      })
      if (!metaResponse.success) {
        throw new Error(metaResponse.error)
      }

      const saveResponse = await saveDocsDraftAction({
        locale,
        pageId: selectedPageId,
        titleSnapshot: title,
        blocks,
        seo,
      })
      if (!saveResponse.success) {
        throw new Error(saveResponse.error)
      }

      setIsDirty(false)
      setNotice({ type: 'success', text: isRu ? 'Черновик сохранен' : 'Draft saved' })
      await loadTree()
      await loadPage(selectedPageId)
      return true
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Сохранение не удалось' : 'Save failed'}: ${String(error)}`,
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }, [selectedPageId, locale, title, slug, parentId, isHome, seo, blocks, loadTree, loadPage, isRu])

  useEffect(() => {
    if (!isDirty || !selectedPageId) return
    if (saveTimerRef.current) {
      window.clearInterval(saveTimerRef.current)
    }
    saveTimerRef.current = window.setInterval(() => {
      void saveDraft()
    }, 8000)
    return () => {
      if (saveTimerRef.current) {
        window.clearInterval(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [isDirty, selectedPageId, saveDraft])

  const markDirty = () => {
    setIsDirty(true)
    setNotice(null)
  }

  const handleCreatePage = async () => {
    const rawTitle = newPageTitle.trim() || (isRu ? 'Новая страница' : 'New page')
    const rawSlug = slugify(newPageSlug || rawTitle)

    try {
      const response = await createDocsPageAction({
        locale,
        parentId: selectedPage?.id || null,
        title: rawTitle,
        slug: rawSlug,
        isHome: false,
      })
      if (!response.success) throw new Error(response.error)
      setNewPageTitle('')
      setNewPageSlug('')
      setIsCreatePageModalOpen(false)
      setNotice({ type: 'success', text: isRu ? 'Страница создана' : 'Page created' })
      await loadTree()
      setSelectedPageId(response.data.id)
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Не удалось создать страницу' : 'Failed to create page'}: ${String(error)}`,
      })
    }
  }

  const handlePublish = async () => {
    if (!selectedPageId) return
    setIsPublishing(true)
    setNotice(null)

    try {
      if (isDirty) {
        const saved = await saveDraft()
        if (!saved) throw new Error(isRu ? 'Не удалось сохранить черновик перед публикацией' : 'Failed to save draft before publishing')
      }

      const validate = validateDocsBlocksByMode(blocks as never, 'publish')
      if (!validate.valid) {
        throw new Error(validate.errors.join(' '))
      }

      const response = await publishDocsPageAction({
        locale,
        pageId: selectedPageId,
      })
      if (!response.success) throw new Error(response.error)
      setNotice({
        type: 'success',
        text: isRu
          ? `Опубликована ревизия #${response.data.revisionNo}`
          : `Published revision #${response.data.revisionNo}`,
      })
      setIsDirty(false)
      await loadTree()
      await loadPage(selectedPageId)
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Публикация не удалась' : 'Publish failed'}: ${String(error)}`,
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleRestore = async (revisionId: string) => {
    if (!selectedPageId) return
    try {
      const response = await restoreDocsRevisionAction({
        locale,
        pageId: selectedPageId,
        revisionId,
      })
      if (!response.success) throw new Error(response.error)
      setNotice({
        type: 'success',
        text: isRu
          ? `Восстановлена ревизия #${response.data.revisionNo}`
          : `Restored revision #${response.data.revisionNo}`,
      })
      await loadPage(selectedPageId)
      setIsDirty(true)
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Не удалось восстановить ревизию' : 'Failed to restore revision'}: ${String(error)}`,
      })
    }
  }

  const handleDeletePage = async () => {
    if (!selectedPageId) return
    const confirmed = window.confirm(
      isRu ? 'Удалить текущую страницу?' : 'Delete current page?'
    )
    if (!confirmed) return

    try {
      const response = await deleteDocsPageAction({
        locale,
        pageId: selectedPageId,
      })
      if (!response.success) throw new Error(response.error)
      setNotice({ type: 'warning', text: isRu ? 'Страница удалена' : 'Page deleted' })
      setSelectedPageId(null)
      setBlocks([])
      await loadTree()
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Удаление не удалось' : 'Delete failed'}: ${String(error)}`,
      })
    }
  }

  const moveSibling = async (nodeId: string, direction: 'up' | 'down') => {
    const siblings = findSiblings(tree, nodeId)
    const index = siblings.findIndex((item) => item.id === nodeId)
    if (index < 0) return

    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= siblings.length) return

    const ordered = [...siblings]
    const [current] = ordered.splice(index, 1)
    ordered.splice(nextIndex, 0, current)

    try {
      const response = await reorderDocsSiblingsAction({
        locale,
        parentId: current.parentId || null,
        orderedPageIds: ordered.map((item) => item.id),
      })
      if (!response.success) throw new Error(response.error)
      await loadTree()
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Не удалось изменить порядок' : 'Failed to reorder'}: ${String(error)}`,
      })
    }
  }

  const handleCreateRedirect = async () => {
    if (!selectedPageId) return
    const fromPath = newRedirectPath.trim()
    if (!fromPath) return
    try {
      const response = await createRedirectAction({
        locale,
        fromPath,
        toPageId: selectedPageId,
      })
      if (!response.success) throw new Error(response.error)
      setNewRedirectPath('')
      await loadPage(selectedPageId)
      setNotice({ type: 'success', text: isRu ? 'Редирект добавлен' : 'Redirect added' })
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Не удалось добавить редирект' : 'Failed to add redirect'}: ${String(error)}`,
      })
    }
  }

  const handleDeleteRedirect = async (redirectId: string) => {
    if (!selectedPageId) return
    try {
      const response = await deleteRedirectAction(redirectId, locale)
      if (!response.success) throw new Error(response.error)
      await loadPage(selectedPageId)
      setNotice({ type: 'success', text: isRu ? 'Редирект удален' : 'Redirect deleted' })
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Не удалось удалить редирект' : 'Failed to delete redirect'}: ${String(error)}`,
      })
    }
  }

  const handleDropOnNode = async (targetId: string, position: 'before' | 'inside' | 'after') => {
    if (!draggedPageId || draggedPageId === targetId) return
    try {
      if (position === 'inside') {
        const response = await moveDocsPageAction({
          locale,
          pageId: draggedPageId,
          newParentId: targetId,
        })
        if (!response.success) throw new Error(response.error)
      } else {
        const siblings = findSiblings(tree, targetId)
        if (siblings.length === 0) return
        const targetParentId = siblings[0].parentId

        const newOrdered = [...siblings]
        const draggedIndex = newOrdered.findIndex(s => s.id === draggedPageId)
        if (draggedIndex > -1) {
          newOrdered.splice(draggedIndex, 1)
        }

        let targetIndex = newOrdered.findIndex(s => s.id === targetId)
        if (targetIndex === -1) targetIndex = 0

        if (position === 'after') targetIndex += 1

        newOrdered.splice(targetIndex, 0, { id: draggedPageId } as any)

        const response = await reorderDocsSiblingsAction({
          locale,
          parentId: targetParentId,
          orderedPageIds: newOrdered.map(s => s.id)
        })
        if (!response.success) throw new Error(response.error)
      }

      await loadTree()
      setNotice({
        type: 'success',
        text: isRu ? 'Страница перемещена' : 'Page moved',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Перемещение не удалось' : 'Move failed'}: ${String(error)}`,
      })
    } finally {
      setDraggedPageId(null)
      setDragTargetId(null)
    }
  }

  const onDropPageToRoot = async () => {
    if (!draggedPageId) return
    try {
      const response = await moveDocsPageAction({
        locale,
        pageId: draggedPageId,
        newParentId: null,
      })
      if (!response.success) throw new Error(response.error)
      await loadTree()
      setNotice({
        type: 'success',
        text: isRu ? 'Страница перемещена в корень' : 'Page moved to root',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${isRu ? 'Перемещение в корень не удалось' : 'Move to root failed'}: ${String(error)}`,
      })
    } finally {
      setDraggedPageId(null)
      setDragTargetId(null)
    }
  }








  const previewUrl = selectedPage
    ? selectedPage.isHome
      ? `/${locale}/docs`
      : `/${locale}/docs/${selectedPage.path}`
    : null
  const isSingleRichText =
    blocks.length === 1 && blocks[0]?.type === 'richText'

  const renderPageNode = (node: DocsPageNode, depth = 0) => {
    const selected = selectedPageId === node.id
    return (
      <div key={node.id} className="space-y-1">
        <div
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            setDraggedPageId(node.id)
          }}
          onDragEnd={(e) => {
            e.stopPropagation()
            setDraggedPageId(null)
            setDragTargetId(null)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            const y = event.clientY - rect.top
            const threshold = rect.height * 0.25

            let pos: 'before' | 'inside' | 'after' = 'inside'
            if (y < threshold) pos = 'before'
            else if (y > rect.height - threshold) pos = 'after'

            if (draggedPageId === node.id) pos = 'inside'

            setDragTargetId(node.id)
            setDragPosition(pos)
          }}
          onDragLeave={() => {
            setDragTargetId(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const pos = dragPosition
            setDragTargetId(null)
            if (draggedPageId === node.id) return
            void handleDropOnNode(node.id, pos)
          }}
          className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition relative ${selected
            ? 'border-[#24A1DE]/50 bg-[#24A1DE]/10 text-white'
            : 'border-white/10 bg-zinc-900/50 text-zinc-300 hover:bg-white/5'
            } ${dragTargetId === node.id && draggedPageId !== node.id
              ? dragPosition === 'before'
                ? 'border-t-[#24A1DE] border-t-2 opacity-100'
                : dragPosition === 'after'
                  ? 'border-b-[#24A1DE] border-b-2 opacity-100'
                  : 'bg-[#24A1DE]/20 ring-1 ring-[#24A1DE] opacity-100'
              : ''
            }`}
          style={{ marginLeft: `${depth * 12}px` }}
          onClick={() => setSelectedPageId(node.id)}
        >
          <span className="truncate text-sm flex-1">{node.title}</span>
          {node.isHome ? (
            <span className="rounded border border-emerald-400/30 px-1.5 py-0.5 text-[10px] text-emerald-300 shrink-0 mx-1">
              {text.homeBadge}
            </span>
          ) : null}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" disabled={isLoadingPage} className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => void moveSibling(node.id, 'up')}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" disabled={isLoadingPage} className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => void moveSibling(node.id, 'down')}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map((child) => renderPageNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
      <aside className="rounded-xl border border-white/10 bg-zinc-900/50 p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-zinc-200">{text.localeLabel}</Label>
          <p className="text-xs text-zinc-400">{text.localeDescription}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={locale === 'ru' ? 'default' : 'outline'}
              onClick={() => setLocale('ru')}
              aria-label="Русский"
            >
              {getLocaleFlag('ru')}
            </Button>
            <Button
              size="sm"
              variant={locale === 'en' ? 'default' : 'outline'}
              onClick={() => setLocale('en')}
              aria-label="English"
            >
              {getLocaleFlag('en')}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-white/10 p-3">
          <div className="text-sm font-medium text-zinc-200">{text.pagesTitle}</div>
          <Button size="sm" onClick={() => setIsCreatePageModalOpen(true)}>
            <FilePlus2 className="h-4 w-4 mr-2" />
            {text.newPage}
          </Button>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${draggedPageId ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#24A1DE] bg-[#24A1DE]/10 p-3 text-[#24A1DE] cursor-pointer hover:bg-[#24A1DE]/20"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void onDropPageToRoot()
            }}
          >
            <ArrowUp className="h-4 w-4" />
            <span className="text-xs font-medium">{text.rootDrop}</span>
          </div>
        </div>

        <div className="space-y-2">
          {isLoadingTree ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> {text.loading}
            </div>
          ) : tree.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 px-3 py-4 space-y-2">
              <div className="text-sm font-medium text-zinc-200">{text.noPagesTitle}</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{text.noPagesText}</p>
            </div>
          ) : (
            tree.map((node) => renderPageNode(node))
          )}
        </div>


      </aside>

      <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{text.editor}</h2>
            <p className="text-xs text-zinc-400">
              {selectedPage
                ? `${text.path}: /${locale}/docs/${selectedPage.path}`
                : text.selectPage}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="border-white/10" disabled={!selectedPageId || !previewUrl} onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
              <Eye className="h-4 w-4 mr-1" />
              {text.openPublished}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/10"
              disabled={!selectedPageId || isLoadingPage}
              onClick={() => setIsSettingsModalOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              {text.openSettings}
            </Button>
            <Button size="sm" variant="outline" className="border-red-500/30 text-red-300 hover:bg-red-500/10" disabled={!selectedPageId || isLoadingPage} onClick={() => void handleDeletePage()}>
              <Trash2 className="h-4 w-4 mr-1" />
              {text.deletePage}
            </Button>
            <Button size="sm" variant="outline" className="border-white/10" disabled={!selectedPageId || isLoadingPage || isSaving} onClick={() => void saveDraft()}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {text.saveDraft}
            </Button>
            <Button size="sm" disabled={!selectedPageId || isLoadingPage || isPublishing} onClick={() => void handlePublish()}>
              {isPublishing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {text.publish}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="text-sm font-medium text-zinc-300">
            {isRu ? 'Содержимое страницы' : 'Page content'}
          </div>
          {isDirty ? (
            <div className="text-xs text-amber-300 flex items-center">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              {text.unsaved}
            </div>
          ) : (
            <div className="text-xs text-emerald-300 flex items-center">
              <Check className="h-3.5 w-3.5 mr-1" />
              {text.saved}
            </div>
          )}
        </div>

        <div className="min-h-[500px]">
          {isLoadingPage || loadedPageId !== selectedPageId ? (
            <div className="rounded-lg border border-white/10 p-12 flex flex-col items-center justify-center text-center text-zinc-500 bg-zinc-950/30">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#24A1DE]" />
              <p>{isRu ? 'Загрузка страницы...' : 'Loading page...'}</p>
            </div>
          ) : selectedPageId ? (
            isSingleRichText ? (
              <TipTapEditor
                key={selectedPageId}
                content={convertBlocksToHtml(blocks)}
                isRu={isRu}
                pageId={selectedPageId}
                onChange={(html) => {
                  const id = blocks.length === 1 && blocks[0].type === 'richText' ? blocks[0].id : `richText-${Date.now()}`
                  setBlocks([{ id, type: 'richText' as any, content: html } as any])
                  markDirty()
                }}
              />
            ) : (
              <DocsCmsBlockEditor
                blocks={blocks}
                setBlocks={setBlocks}
                markDirty={markDirty}
                isRu={isRu}
              />
            )
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 p-12 flex flex-col items-center justify-center text-center text-zinc-500 bg-zinc-950/30">
              <p>{isRu ? 'Выберите или создайте страницу для редактирования' : 'Select or create a page to edit'}</p>
            </div>
          )}
        </div>


        {notice ? (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-xs ${notice.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : notice.type === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : notice.type === 'info'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
          >
            {notice.text}
          </div>
        ) : null}
      </section>

      {isCreatePageModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setIsCreatePageModalOpen(false)}
            aria-label={text.closeModal}
          />
          <div className="relative w-full max-w-xl rounded-2xl border border-white/15 bg-[#0B0E14] p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{text.createPageTitle}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {selectedPage
                    ? isRu
                      ? `Будет создана внутри: ${selectedPage.title}`
                      : `Will be created under: ${selectedPage.title}`
                    : isRu
                      ? 'Будет создана в корне документации'
                      : 'Will be created in docs root'}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsCreatePageModalOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                placeholder={text.newPageTitle}
                value={newPageTitle}
                onChange={(event) => setNewPageTitle(event.target.value)}
                className="bg-zinc-900/60 border-white/10"
              />
              <Input
                placeholder={text.newPageSlug}
                value={newPageSlug}
                onChange={(event) => setNewPageSlug(event.target.value)}
                className="bg-zinc-900/60 border-white/10"
              />
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-400 space-y-1">
              <div className="text-zinc-300 font-medium">{text.quickGuideTitle}</div>
              <div>{text.quickGuideLine1}</div>
              <div>{text.quickGuideLine2}</div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="border-white/10" onClick={() => setIsCreatePageModalOpen(false)}>
                {text.closeModal}
              </Button>
              <Button onClick={() => void handleCreatePage()}>
                <FilePlus2 className="h-4 w-4 mr-2" />
                {text.createPage}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setIsSettingsModalOpen(false)}
            aria-label={text.closeModal}
          />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/15 bg-[#0B0E14] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{text.settingsTitle}</h3>
                <p className="mt-1 text-xs text-zinc-400">{text.quickGuideLine3} {text.quickGuideLine4}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsSettingsModalOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-74px)] p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">{text.meta}</h4>
                  <Input
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value)
                      if (!slug) setSlug(slugify(event.target.value))
                      markDirty()
                    }}
                    placeholder={text.pageTitle}
                    className="bg-zinc-900/60 border-white/10"
                  />
                  <Input
                    value={slug}
                    onChange={(event) => {
                      setSlug(slugify(event.target.value))
                      markDirty()
                    }}
                    placeholder={text.newPageSlug}
                    className="bg-zinc-900/60 border-white/10"
                  />
                  <div className="text-xs text-zinc-400">{text.parent}</div>
                  <Select
                    value={parentId || ''}
                    onChange={(event) => {
                      setParentId(event.target.value || null)
                      markDirty()
                    }}
                    className="bg-zinc-900/60 border-white/10"
                  >
                    <option value="">{text.noParent}</option>
                    {flatPages
                      .filter((page) => page.id !== selectedPageId)
                      .map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                  </Select>
                  <label className="text-xs text-zinc-300 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isHome}
                      onChange={(event) => {
                        setIsHome(event.target.checked)
                        markDirty()
                      }}
                    />
                    {text.homePage}
                  </label>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">{text.seo}</h4>
                  <Input
                    value={seo.title || ''}
                    onChange={(event) => {
                      setSeo((prev) => ({ ...prev, title: event.target.value }))
                      markDirty()
                    }}
                    placeholder={text.seoTitle}
                    className="bg-zinc-900/60 border-white/10"
                  />
                  <Textarea
                    value={seo.description || ''}
                    onChange={(event) => {
                      setSeo((prev) => ({ ...prev, description: event.target.value }))
                      markDirty()
                    }}
                    rows={3}
                    placeholder={text.seoDescription}
                    className="bg-zinc-900/60 border-white/10"
                  />
                  <Input
                    value={seo.ogImage || ''}
                    onChange={(event) => {
                      setSeo((prev) => ({ ...prev, ogImage: event.target.value }))
                      markDirty()
                    }}
                    placeholder={text.ogImage}
                    className="bg-zinc-900/60 border-white/10"
                  />
                  <label className="text-xs text-zinc-300 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(seo.noIndex)}
                      onChange={(event) => {
                        setSeo((prev) => ({ ...prev, noIndex: event.target.checked }))
                        markDirty()
                      }}
                    />
                    {text.noIndex}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">{text.redirects}</h4>
                <div className="flex gap-2">
                  <Input
                    value={newRedirectPath}
                    onChange={(event) => setNewRedirectPath(event.target.value)}
                    placeholder={text.oldPath}
                    className="bg-zinc-900/60 border-white/10"
                  />
                  <Button size="icon" onClick={() => void handleCreateRedirect()} disabled={!selectedPageId}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {redirects.map((redirect) => (
                    <div key={redirect.id} className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-zinc-300 flex items-center justify-between gap-2">
                      <span className="truncate">{redirect.fromPath}</span>
                      <button
                        type="button"
                        className="text-red-300 hover:text-red-200"
                        onClick={() => void handleDeleteRedirect(redirect.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">{text.history}</h4>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {revisions.map((revision) => (
                    <div
                      key={revision.id}
                      className="rounded-md border border-white/10 px-2 py-2 text-xs text-zinc-300"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>#{revision.revisionNo} · {revision.status}</span>
                        <button
                          type="button"
                          className="text-[#5EC8FF] hover:text-[#80d7ff]"
                          onClick={() => void handleRestore(revision.id)}
                        >
                          {text.restore}
                        </button>
                      </div>
                      <div className="mt-1 text-zinc-500">{new Date(revision.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-400 space-y-1">
                <div className="text-zinc-300 font-medium">{text.quickGuideTitle}</div>
                <div>{text.quickGuideLine1}</div>
                <div>{text.quickGuideLine2}</div>
                <div>{text.quickGuideLine3}</div>
                <div>{text.quickGuideLine4}</div>
              </div>

              <div className="flex items-center justify-end">
                <Button variant="outline" className="border-white/10" onClick={() => setIsSettingsModalOpen(false)}>
                  {text.closeModal}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
