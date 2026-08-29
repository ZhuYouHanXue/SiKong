import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSavedCards, deleteAllSavedCards, getModelConfig, saveModelConfig } from '../services/cards.js'

const cleanText = (value, fallback = '') => String(value ?? fallback).replace(/\s+/g, ' ').trim()

const truncate = (value, maxLength) => {
  const chars = Array.from(String(value ?? ''))
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join('')}...` : chars.join('')
}

const SURFACE_TYPES = new Set(['sand-sea', 'magic-tone', 'unruled', 'word-reverse'])
const FIRST_USE_KEY = 'sikong-first-use'

function cardSummary(card) {
  const surface = card?.surface && typeof card.surface === 'object' ? card.surface : {}
  if (SURFACE_TYPES.has(card?.type)) {
    return truncate(cleanText(surface.tailReading, '这张留印暂时没有摘要。'), 22)
  }
  const humanReading = surface.humanReading && typeof surface.humanReading === 'object'
    ? surface.humanReading
    : {}
  const candidate = humanReading.interpret
    || humanReading.title
    || surface.tailReading
    || card?.content?.stream
    || (Array.isArray(card?.content?.lines) ? card.content.lines.join('，') : '')
    || '这张留印暂时没有摘要。'
  return truncate(cleanText(candidate), 22)
}

function cardKind(card) {
  return cleanText(card?.typeName || card?.type, '卡片')
}

function formatSavedAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} · ${hour}:${minute}`
}

const SavedCardsDrawer = forwardRef(function SavedCardsDrawer({
  variant = 'icon',
  onOpenCard,
  onReturnHome,
}, ref) {
  const [open, setOpen] = useState(false)
  const [cards, setCards] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelProvider, setModelProvider] = useState('deepseek')
  const [modelName, setModelName] = useState('')
  const [modelBaseUrl, setModelBaseUrl] = useState('')
  const [modelApiKey, setModelApiKey] = useState('')
  const [modelConfig, setModelConfig] = useState(null)
  const [settingsStatus, setSettingsStatus] = useState('idle')
  const [settingsMessage, setSettingsMessage] = useState('')
  const controllerRef = useRef(null)

  const loadCards = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setStatus('loading')
    setError(null)
    try {
      const nextCards = await getSavedCards({ signal: controller.signal })
      setCards(nextCards)
      setStatus('done')
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError('留印暂时读取不到，请稍后再试。')
      setStatus('error')
    }
  }, [])

  const openDrawer = useCallback(() => {
    setOpen(true)
    loadCards()
  }, [loadCards])

  const closeDrawer = useCallback(() => {
    controllerRef.current?.abort()
    setOpen(false)
  }, [])

  const loadModelSettings = useCallback(async () => {
    setSettingsStatus('loading')
    setSettingsMessage('')
    try {
      const config = await getModelConfig()
      setModelConfig(config)
      setModelProvider(config?.provider || 'deepseek')
      setModelName(config?.model || '')
      setModelBaseUrl(config?.baseUrl || '')
      setModelApiKey('')
      setSettingsStatus('idle')
    } catch {
      setSettingsStatus('error')
      setSettingsMessage('模型配置读取失败，请稍后再试。')
    }
  }, [])

  const openSettings = useCallback(() => {
    setSettingsOpen(true)
    loadModelSettings()
  }, [loadModelSettings])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
  }, [])

  const handleSaveModelConfig = useCallback(async () => {
    setSettingsStatus('saving')
    setSettingsMessage('')
    try {
      const result = await saveModelConfig({
        provider: modelProvider,
        model: modelName.trim(),
        baseUrl: modelBaseUrl.trim(),
        apiKey: modelApiKey.trim(),
      })
      setModelConfig(result?.config || result)
      setSettingsStatus('saved')
      setSettingsMessage('模型配置已保存并完成连通性检查，正在刷新。')
      window.setTimeout(() => window.location.reload(), 700)
    } catch (requestError) {
      setSettingsStatus('error')
      setSettingsMessage(requestError?.message || '模型配置保存失败，请检查后重试。')
    }
  }, [modelApiKey, modelBaseUrl, modelName, modelProvider])

  const handleDeleteAll = useCallback(async () => {
    const confirmed = window.confirm('确定删除所有留印？此操作不可恢复。')
    if (!confirmed) return
    setSettingsStatus('deleting')
    try {
      await deleteAllSavedCards()
      setCards([])
      setStatus('done')
      setSettingsStatus('idle')
    } catch {
      setSettingsStatus('idle')
    }
  }, [])

  const handleResetTutorial = useCallback(() => {
    try {
      window.localStorage.setItem(FIRST_USE_KEY, '1')
    } catch {
      // 忽略本地存储不可用的情况；按钮本身仍可点击。
    }
    window.location.reload()
  }, [])

  useImperativeHandle(ref, () => ({ open: openDrawer }), [openDrawer])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, closeDrawer])

  const trigger = variant === 'icon' ? (
    <button className="saved-cards-trigger saved-cards-trigger--icon" type="button" aria-label="打开留印" onClick={openDrawer}>
      <svg className="saved-cards-trigger__svg" viewBox="0 0 24 24" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  ) : variant === 'text' ? (
    <button className="saved-cards-trigger saved-cards-trigger--text" type="button" onClick={openDrawer}>
      留印
    </button>
  ) : null

  const overlay = (
    <>
      {open && <button className="saved-cards-backdrop" type="button" aria-label="关闭留印" onClick={closeDrawer} />}

      <aside className={`saved-cards-drawer${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <header className="saved-cards-drawer__header">
          <div className="saved-cards-drawer__logo logo" aria-label="司空 SIKONG">
            <div className="logo__seal" aria-hidden="true">
              <span className="logo__si">司</span>
              <span className="logo__kong">空</span>
              <i className="logo__seal-dot" />
            </div>
            <div className="logo__wordmark">
              <span>司空</span>
              <small>SIKONG</small>
            </div>
          </div>
          <button type="button" onClick={closeDrawer} aria-label="关闭留印">×</button>
        </header>

        <button
          className="saved-cards-drawer__home"
          type="button"
          onClick={() => {
            closeDrawer()
            onReturnHome?.()
          }}
        >
          <span className="saved-cards-drawer__home-label">回到首页</span>
        </button>

        <div className="saved-cards-drawer__body">
          <div className="saved-cards-drawer__section-title">
            留印
            <small>SAVED CARDS</small>
          </div>

          {status === 'loading' && <p className="saved-cards-state">正在读取留印……</p>}
          {status === 'error' && <p className="saved-cards-state">{error}</p>}
          {status === 'done' && cards.length === 0 && <p className="saved-cards-state">还没有留印。</p>}
          {status === 'done' && cards.length > 0 && (
            <ol className="saved-cards-list">
              {cards.map((card, index) => (
                <li className="saved-card-item" key={card.id || `${card.type}-${index}`}>
                  <button
                    className="saved-card-item__button"
                    type="button"
                    onClick={() => {
                      closeDrawer()
                      onOpenCard?.(card)
                    }}
                  >
                    <div className="saved-card-item__meta">
                      <span>{cardKind(card)}</span>
                      <small>{formatSavedAt(card.savedAt)}</small>
                    </div>
                    <p className="saved-card-item__route">
                      <span>{truncate(cleanText(card.head || card.input, '程序在这里发生了一个意外 但你完全可以放任不管'), 7)}</span>
                      <i>{'   '}→{'   '}</i>
                      <span>{truncate(cleanText(card.tail || card.content?.lines?.at(-1), '程序在这里发生了一个意外 但你完全可以放任不管'), 7)}</span>
                    </p>
                    <p className="saved-card-item__summary">{cardSummary(card)}</p>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="saved-cards-drawer__footer">
          <button className="saved-cards-drawer__settings" type="button" onClick={openSettings}>设置</button>
        </div>
      </aside>

      {settingsOpen && (
        <div className="saved-cards-settings-layer">
          <button className="saved-cards-settings-backdrop" type="button" aria-label="关闭设置" onClick={closeSettings} />
          <section className="saved-cards-settings-dialog" role="dialog" aria-modal="true" aria-label="设置">
            <div className="saved-cards-settings-dialog__frame" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            <header className="saved-cards-settings-dialog__header">
              <p>设置</p>
              <button type="button" onClick={closeSettings}>×</button>
            </header>
            <div className="saved-cards-settings-dialog__body">
              <section className="saved-cards-settings-section">
                <h2 className="saved-cards-settings-section__title">LLM 配置</h2>

                {settingsStatus === 'loading' && (
                  <p className="saved-cards-settings-dialog__status">正在读取模型配置…</p>
                )}

                <label className="saved-cards-settings-dialog__label" htmlFor="sikong-model-provider">模型服务</label>
                <input
                  id="sikong-model-provider"
                  type="text"
                  value="DeepSeek"
                  readOnly
                  disabled={settingsStatus === 'saving'}
                />

                <label className="saved-cards-settings-dialog__label" htmlFor="sikong-model-name">模型名称</label>
                <input
                  id="sikong-model-name"
                  type="text"
                  value={modelName}
                  disabled={settingsStatus === 'saving'}
                  onChange={(event) => setModelName(event.target.value)}
                  placeholder="deepseek-chat"
                />

                <label className="saved-cards-settings-dialog__label" htmlFor="sikong-model-base-url">API Base URL</label>
                <input
                  id="sikong-model-base-url"
                  type="text"
                  value={modelBaseUrl}
                  disabled={settingsStatus === 'saving'}
                  onChange={(event) => setModelBaseUrl(event.target.value)}
                  placeholder="https://api.deepseek.com/v1"
                />

                <label className="saved-cards-settings-dialog__label" htmlFor="sikong-model-api-key">API Key</label>
                <input
                  id="sikong-model-api-key"
                  type="password"
                  value={modelApiKey}
                  disabled={settingsStatus === 'saving'}
                  onChange={(event) => setModelApiKey(event.target.value)}
                  placeholder={modelConfig?.configured ? '已配置，留空保持不变' : 'sk-...'}
                  autoComplete="off"
                />

                {modelConfig && settingsStatus !== 'loading' && (
                  <p className="saved-cards-settings-dialog__status">
                    当前：{modelConfig.provider} · {modelConfig.model || '未设置模型'} · {modelConfig.available ? '已连接' : '未连接'}
                  </p>
                )}

                <button type="button" className="saved-cards-settings-dialog__primary" onClick={handleSaveModelConfig} disabled={settingsStatus === 'saving'}>
                  {settingsStatus === 'saving' ? '正在保存并检查…' : '保存并刷新'}
                </button>
                {settingsMessage && (
                  <p className={`saved-cards-settings-dialog__status${settingsStatus === 'error' ? ' saved-cards-settings-dialog__status--error' : ''}`}>
                    {settingsMessage}
                  </p>
                )}
              </section>

              <section className="saved-cards-settings-section">
                <h2 className="saved-cards-settings-section__title">留印管理</h2>
                <button type="button" className="saved-cards-settings-dialog__danger" onClick={handleDeleteAll} disabled={settingsStatus === 'deleting' || settingsStatus === 'saving'}>
                  {settingsStatus === 'deleting' ? '正在删除…' : '删除所有留印'}
                </button>
              </section>

              <section className="saved-cards-settings-section">
                <h2 className="saved-cards-settings-section__title">教程</h2>
                <button type="button" className="saved-cards-settings-dialog__primary" onClick={handleResetTutorial}>
                  重置教程
                </button>
              </section>
            </div>
          </section>
        </div>
      )}
    </>
  )

  return (
    <>
      {trigger}
      {createPortal(overlay, document.body)}
    </>
  )
})

export default SavedCardsDrawer
