'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const NOTION_URL = 'https://www.notion.so/684c9adbff7448a38eec9b978f7eea67'
const MODES = ['work', 'life', 'mixed']
const TYPES = ['todo', 'idea', 'activity']
const URGENCY = ['high', 'medium', 'low']
const PRIORITY = ['high', 'medium', 'low']
const STATUS = ['pending', 'in-progress', 'done']
const modeColors = { work: '#185FA5', life: '#0F6E56', mixed: '#7F77DD' }
const modeIcons = { work: '💼', life: '🏠', mixed: '🌀' }
const typeColors = { todo: '#D85A30', idea: '#BA7517', activity: '#1D9E75' }
const urgencyColors = { high: '#E24B4A', medium: '#EF9F27', low: '#639922' }
const priorityColors = { high: '#7F77DD', medium: '#378ADD', low: '#888780' }
const statusColors = { pending: '#888780', 'in-progress': '#378ADD', done: '#0F6E56' }
const PRESETS = [{ label: '25/5', work: 25, brk: 5 }, { label: '50/10', work: 50, brk: 10 }, { label: '90/20', work: 90, brk: 20 }]
const DUR_QUICK = [15, 30, 45, 60, 90, 120]
const MAX_DUR = 120
const MAX_AGO = 120
const CIRC = 2 * Math.PI * 64

const mkEntry = () => ({ id: String(Date.now()), text: '', type: 'todo', mode: 'work', urgency: 'medium', priority: 'medium', status: 'pending', dueDate: '', dueTime: '', createdAt: new Date().toISOString(), notionPageId: null, notified: false, actStartMin: null, actDur: null, actAgoMin: null })

const NotionLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.387-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/>
    <path fill="white" d="M61.35.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.883c5.44-.387 6.99-2.917 6.99-7.193V19.64c0-2.21-.827-2.86-3.3-4.733L74.167 3.143C69.893.033 68.147-.357 61.35.227zM25.92 19.523c-5.247.353-6.437.433-9.417-1.99L8.927 11.4c-.777-.78-.39-1.753.97-1.947l53.2-3.887c4.467-.39 6.797 1.167 8.543 2.527l9.123 6.61c.39.197 1.363 1.36.193 1.36l-54.84 3.307-.197.153zM19.68 88.163V30.48c0-2.527.777-3.697 3.107-3.893L85.5 22.78c2.137-.193 3.107 1.167 3.107 3.693v57.1c0 2.527-.97 4.277-3.883 4.47l-60.543 3.5c-2.913.193-4.5-.973-4.5-3.38zm59.96-54.827c.387 1.75 0 3.5-1.75 3.697l-2.91.577v42.773c-2.527 1.36-4.857 2.137-6.8 2.137-3.107 0-3.883-.97-6.21-3.883l-19.03-29.96v28.99l6.02 1.363s0 3.5-4.857 3.5l-13.39.777c-.39-.78 0-2.723 1.357-3.11l3.497-.97V36.48L29.37 36.1c-.387-1.75.58-4.277 3.3-4.473l14.367-.967 19.8 30.353V33.973l-5.062-.58c-.39-2.143 1.163-3.697 3.103-3.89l13.763-.777z"/>
  </svg>
)

function useLocal(key, init) {
  const [val, setVal] = useState(() => {
    if (typeof window === 'undefined') return init
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init } catch { return init }
  })
  const save = useCallback(v => {
    setVal(v)
    try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }, [key])
  return [val, save]
}

async function notionAPI(body) {
  const r = await fetch('/api/notion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return r.json()
}

const fmtTimer = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const fmtTime = totalMin => {
  const t = ((totalMin % 1440) + 1440) % 1440
  const h = Math.floor(t / 60), m = t % 60
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12
  return `${h12}:${m < 10 ? '0' : ''}${m} ${ap}`
}
const fmtDur = m => {
  if (!m || m === 0) return ''
  if (m < 60) return `${m} min`
  if (m % 60 === 0) return `${m / 60} hr`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
const fmtCreated = iso => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const badge = (label, color) => (
  <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 500 }}>{label}</span>
)

// ── Activity Clock Component ──────────────────────────────────────────────────
function ActivityClock({ dark, agoMin, dur, onAgoChange, onDurChange }) {
  const nowRef = useRef(0)
  useEffect(() => {
    const n = new Date(); nowRef.current = n.getHours() * 60 + n.getMinutes()
  }, [])

  const dragging = useRef(null)
  const border = dark ? '#333' : '#eee'
  const textColor = dark ? '#e0e0e0' : '#111'
  const mutedColor = dark ? '#aaa' : '#666'

  function snapStart(rawAgo) {
    const rawStart = nowRef.current - rawAgo
    const snapped = Math.round(rawStart / 5) * 5
    return Math.max(0, Math.min(MAX_AGO, nowRef.current - snapped))
  }

  function angleFromEvent(e, el) {
    const rect = el.getBoundingClientRect()
    const pt = e.touches ? e.touches[0] : e
    let a = Math.atan2(pt.clientY - (rect.top + rect.height / 2), pt.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI + 90
    if (a < 0) a += 360
    return a
  }

  function handleDrag(e, type) {
    const svgId = type === 'start' ? 'svg-start' : 'svg-dur'
    const el = document.getElementById(svgId)
    if (!el) return
    const angle = angleFromEvent(e, el)
    if (type === 'start') {
      const raw = (angle / 360) * MAX_AGO
      onAgoChange(snapStart(raw))
    } else {
      const raw = Math.round((angle / 360) * MAX_DUR / 5) * 5
      onDurChange(Math.max(0, Math.min(MAX_DUR, raw)))
    }
  }

  useEffect(() => {
    const onMove = e => { if (dragging.current) handleDrag(e, dragging.current) }
    const onUp = () => { dragging.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [agoMin, dur])

  function ClockSVG({ id, frac, color, centerText, subText, onStart }) {
    const dash = frac * CIRC
    const angle = (frac * 360 - 90) * Math.PI / 180
    const hx = 80 + 64 * Math.cos(angle), hy = 80 + 64 * Math.sin(angle)
    return (
      <svg id={id} width="160" height="160" style={{ cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}
        onMouseDown={e => { dragging.current = onStart; handleDrag(e, onStart) }}
        onTouchStart={e => { dragging.current = onStart; handleDrag(e, onStart); e.preventDefault() }}>
        <circle cx="80" cy="80" r="64" fill="none" stroke={border} strokeWidth="12" />
        <circle cx="80" cy="80" r="64" fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${CIRC - dash}`} strokeLinecap="round" transform="rotate(-90 80 80)" />
        <circle cx={hx} cy={hy} r="7" fill={color} stroke={dark ? '#1e1e1e' : '#fff'} strokeWidth="2" />
        <text x="80" y="76" textAnchor="middle" fontSize="16" fontWeight="500" fill={textColor}>{centerText}</text>
        <text x="80" y="92" textAnchor="middle" fontSize="11" fill={mutedColor}>{subText}</text>
      </svg>
    )
  }

  const startMin = nowRef.current - agoMin
  const startDisplay = agoMin === 0 ? 'now' : fmtTime(Math.round(startMin / 5) * 5)
  const startSub = agoMin === 0 ? '' : `${agoMin}m ago`

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginBottom: 16 }}>
        {DUR_QUICK.map(m => (
          <button key={m} onClick={() => onDurChange(m)} style={{ padding: '6px 0', borderRadius: 20, border: `0.5px solid ${dur === m ? '#1D9E75' : dark ? '#444' : '#ddd'}`, background: dur === m ? '#1D9E7510' : 'transparent', color: dur === m ? '#1D9E75' : mutedColor, fontSize: 12, cursor: 'pointer', fontWeight: dur === m ? 500 : 400 }}>
            {m < 60 ? `${m}m` : m === 60 ? '1hr' : `${m / 60 % 1 === 0 ? m / 60 : '1.5'}hr`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 12, color: mutedColor, marginBottom: 4 }}>Start time</div>
          <ClockSVG id="svg-start" frac={agoMin / MAX_AGO} color="#185FA5" centerText={startDisplay} subText={startSub} onStart="start" />
          <div style={{ fontSize: 11, color: mutedColor }}>{fmtTime(startMin)}</div>
        </div>
        <div style={{ paddingTop: 70, color: mutedColor, fontSize: 18 }}>→</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 12, color: mutedColor, marginBottom: 4 }}>Duration</div>
          <ClockSVG id="svg-dur" frac={dur / MAX_DUR} color="#1D9E75" centerText={dur === 0 ? '0' : String(dur)} subText="min" onStart="dur" />
          <div style={{ fontSize: 11, color: mutedColor }}>{fmtDur(dur)}</div>
        </div>
      </div>

      {(agoMin > 0 || dur > 0) && (
        <div style={{ marginTop: 14, background: dark ? '#1e1e1e' : '#f5f5f5', borderRadius: 8, padding: '8px 14px', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <strong style={{ color: textColor }}>{fmtTime(startMin)}</strong>
          <span style={{ color: mutedColor }}>→</span>
          <strong style={{ color: textColor }}>{fmtTime(startMin + dur)}</strong>
          <span style={{ background: '#1D9E7518', color: '#0F6E56', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>{fmtDur(dur)}</span>
        </div>
      )}
    </div>
  )
}

// ── Entry Card ────────────────────────────────────────────────────────────────
function EntryCard({ entry: e, onEdit, onDelete, onCycleStatus, onLink, mode, dark }) {
  const mc = { work: '#185FA5', life: '#0F6E56', mixed: '#7F77DD' }
  const done = e.status === 'done'
  const cardBg = dark ? '#1e1e1e' : '#fff'
  const textColor = dark ? '#e0e0e0' : '#111'
  const mutedColor = dark ? '#aaa' : '#666'
  return (
    <div style={{ background: cardBg, border: `1px solid ${e.urgency === 'high' && !done ? '#E24B4A44' : dark ? '#333' : '#eee'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, opacity: done ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button onClick={() => onCycleStatus(e.id)} style={{ marginTop: 2, width: 18, height: 18, borderRadius: '50%', border: `2px solid ${statusColors[e.status]}`, background: done ? statusColors.done : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, textDecoration: done ? 'line-through' : 'none', marginBottom: 4, color: textColor }}>{e.text}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {badge(e.type, typeColors[e.type])}
            {e.type === 'todo' && <>{badge(`U:${e.urgency}`, urgencyColors[e.urgency])}{badge(`P:${e.priority}`, priorityColors[e.priority])}{badge(e.status, statusColors[e.status])}</>}
            {e.type === 'activity' && e.actDur > 0 && (
              <span style={{ fontSize: 11, color: mutedColor }}>
                {e.actStartMin != null ? `${fmtTime(e.actStartMin)} → ${fmtTime(e.actStartMin + e.actDur)} · ` : ''}{fmtDur(e.actDur)}
              </span>
            )}
            {mode === 'mixed' && badge(e.mode, mc[e.mode])}
            {e.dueDate && <span style={{ fontSize: 11, color: mutedColor }}>📅 {e.dueDate}{e.dueTime ? ` ${e.dueTime}` : ''}</span>}
          </div>
          <div style={{ fontSize: 11, color: dark ? '#555' : '#bbb', marginTop: 4 }}>{fmtCreated(e.createdAt)}</div>
          {e.notionPageId && <span style={{ fontSize: 11, color: '#7F77DD', display: 'inline-flex', alignItems: 'center', gap: 3 }}><NotionLogo size={11} /> synced</span>}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {e.type !== 'activity' && <button onClick={() => onLink(e)} title="Link to timer" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}>⏱</button>}
          <button onClick={() => onEdit(e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}>✏️</button>
          <button onClick={() => onDelete(e.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}>🗑</button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useLocal('fbdp_dark', false)
  const [mode, setMode] = useLocal('fbdp_mode', 'work')
  const [entries, setEntries] = useLocal('fbdp_entries', [])
  const [sessions, setSessions] = useLocal('fbdp_sessions', [])
  const [presetIdx, setPresetIdx] = useLocal('fbdp_preset', 0)
  const [activeTab, setActiveTab] = useState('dump')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterUrgency, setFilterUrgency] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(mkEntry())
  const [editId, setEditId] = useState(null)
  const [actAgo, setActAgo] = useState(0)
  const [actDur, setActDur] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerPhase, setTimerPhase] = useState('work')
  const [timerSecs, setTimerSecs] = useState(25 * 60)
  const [linkedTask, setLinkedTask] = useState(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const intervalRef = useRef(null)
  const notifRef = useRef(false)

  const bg = dark ? '#121212' : '#ffffff'
  const bgSecondary = dark ? '#1e1e1e' : '#f5f5f5'
  const text = dark ? '#e0e0e0' : '#111111'
  const textMuted = dark ? '#aaaaaa' : '#666666'
  const border = dark ? '#333333' : '#dddddd'
  const inputBg = dark ? '#2a2a2a' : '#ffffff'

  useEffect(() => {
    if (Notification?.permission === 'granted') notifRef.current = true
    else if (Notification?.permission !== 'denied') Notification.requestPermission().then(p => { notifRef.current = p === 'granted' })
  }, [])

  const preset = PRESETS[presetIdx] || PRESETS[0]

  useEffect(() => { setTimerSecs((timerPhase === 'work' ? preset.work : preset.brk) * 60) }, [presetIdx, timerPhase])

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSecs(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current); setTimerRunning(false)
            const np = timerPhase === 'work' ? 'break' : 'work'
            if (timerPhase === 'work') setSessions(prev => [{ id: Date.now(), duration: preset.work, task: linkedTask, mode, date: new Date().toISOString() }, ...prev.slice(0, 49)])
            notify(timerPhase === 'work' ? 'Focus session done! Take a break.' : 'Break over. Back to focus!')
            setTimerPhase(np)
            const p2 = PRESETS[presetIdx] || PRESETS[0]
            return (np === 'work' ? p2.work : p2.brk) * 60
          }
          return s - 1
        })
      }, 1000)
    } else clearInterval(intervalRef.current)
    return () => clearInterval(intervalRef.current)
  }, [timerRunning])

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date()
      entries.forEach(e => {
        if (e.dueDate && e.dueTime && !e.notified && e.status !== 'done') {
          if (new Date(`${e.dueDate}T${e.dueTime}`) <= now) {
            notify(`Due: ${e.text.slice(0, 50)}`)
            setEntries(prev => prev.map(x => x.id === e.id ? { ...x, notified: true } : x))
          }
        }
      })
    }, 30000)
    return () => clearInterval(iv)
  }, [entries])

  function notify(msg) { if (notifRef.current) new Notification('Focus Hub', { body: msg }) }
  function showSync(msg) { setSyncMsg(msg); setTimeout(() => setSyncMsg(''), 4000) }

  const visible = entries.filter(e => {
    if (mode !== 'mixed' && e.mode !== mode) return false
    if (filterType !== 'all' && e.type !== filterType) return false
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterUrgency !== 'all' && e.urgency !== filterUrgency) return false
    return true
  })

  const urgent = visible.filter(e => e.urgency === 'high' && e.status !== 'done')
  const inProg = visible.filter(e => e.status === 'in-progress')

  async function saveEntry() {
    if (!draft.text.trim()) return
    const entryMode = mode === 'mixed' ? draft.mode : mode
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const actStartMin = draft.type === 'activity' ? nowMin - actAgo : null
    const updated = editId
      ? { ...entries.find(e => e.id === editId), ...draft, mode: entryMode, actStartMin, actDur: draft.type === 'activity' ? actDur : null, actAgoMin: draft.type === 'activity' ? actAgo : null }
      : { ...draft, id: String(Date.now()), createdAt: now.toISOString(), mode: entryMode, actStartMin, actDur: draft.type === 'activity' ? actDur : null, actAgoMin: draft.type === 'activity' ? actAgo : null }
    if (editId) setEntries(prev => prev.map(e => e.id === editId ? updated : e))
    else setEntries(prev => [updated, ...prev])
    setDraft(mkEntry()); setShowForm(false); setEditId(null); setActAgo(0); setActDur(0)
    try {
      if (updated.notionPageId) {
        await notionAPI({ action: 'update', entry: updated })
      } else {
        const res = await notionAPI({ action: 'create', entry: updated })
        if (res.notionPageId) setEntries(prev => prev.map(e => e.id === updated.id ? { ...e, notionPageId: res.notionPageId } : e))
      }
    } catch {}
  }

  async function pushAll() {
    setSyncing(true); showSync('Pushing to Notion...')
    try {
      const toSync = (mode === 'mixed' ? entries : entries.filter(e => e.mode === mode)).slice(0, 20)
      const res = await notionAPI({ action: 'push', entries: toSync })
      if (res.results) {
        const map = Object.fromEntries(res.results.map(r => [r.id, r.notionPageId]))
        setEntries(prev => prev.map(e => map[e.id] ? { ...e, notionPageId: map[e.id] } : e))
      }
      showSync(`Pushed ${toSync.length} entries`)
    } catch { showSync('Push failed') }
    setSyncing(false)
  }

  async function pullAll() {
    setPulling(true); showSync('Pulling from Notion...')
    try {
      const res = await notionAPI({ action: 'pull' })
      if (res.entries) {
        const merged = [...entries]
        res.entries.forEach(r => {
          const i = merged.findIndex(e => e.id === r.id || e.notionPageId === r.notionPageId)
          if (i >= 0) merged[i] = { ...merged[i], ...r }
          else merged.unshift(r)
        })
        setEntries(merged)
        showSync(`Pulled ${res.entries.length} entries`)
      }
    } catch { showSync('Pull failed') }
    setPulling(false)
  }

  function startEdit(e) {
    setDraft({ ...e })
    setEditId(e.id)
    setActAgo(e.actAgoMin || 0)
    setActDur(e.actDur || 0)
    setShowForm(true)
    setActiveTab('dump')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function deleteEntry(id) { setEntries(prev => prev.filter(e => e.id !== id)) }
  function cycleStatus(id) { setEntries(prev => prev.map(e => e.id !== id ? e : { ...e, status: STATUS[(STATUS.indexOf(e.status) + 1) % STATUS.length] })) }

  const selStyle = { fontSize: 12, padding: '3px 6px', borderRadius: 6, border: `1px solid ${border}`, color: text, background: inputBg }
  const Sel = ({ val, set, opts, colors }) => (
    <select value={val} onChange={e => set(e.target.value)} style={{ ...selStyle, color: colors?.[val] || text }}>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  const btnOutline = { padding: '6px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: textMuted }
  const r = 54, circ2 = 2 * Math.PI * r
  const totalSecs = (timerPhase === 'work' ? preset.work : preset.brk) * 60
  const progress = 1 - timerSecs / totalSecs

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '1rem 0.75rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 500, fontSize: 18, color: text }}>🧠 Focus Hub</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {MODES.map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${mode === m ? modeColors[m] : border}`, background: mode === m ? modeColors[m] + '18' : 'transparent', color: mode === m ? modeColors[m] : textMuted, fontWeight: mode === m ? 500 : 400, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {modeIcons[m]} {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
            <button onClick={() => setDark(d => !d)} style={{ marginLeft: 4, padding: '5px 10px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', fontSize: 16 }}>
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: '1rem' }}>
          {[{ label: 'Urgent', val: urgent.length, color: '#E24B4A' }, { label: 'In progress', val: inProg.length, color: '#378ADD' }, { label: 'Pending', val: visible.filter(e => e.status === 'pending').length, color: '#888' }, { label: 'Done', val: visible.filter(e => e.status === 'done').length, color: '#0F6E56' }].map(s => (
            <div key={s.label} style={{ background: bgSecondary, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
          {[{ id: 'dump', label: '🧠 Brain dump' }, { id: 'timer', label: '⏱ Focus timer' }, { id: 'sessions', label: '📋 Sessions' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? `2px solid ${modeColors[mode]}` : '2px solid transparent', color: activeTab === t.id ? modeColors[mode] : textMuted, fontWeight: activeTab === t.id ? 500 : 400, fontSize: 14, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* BRAIN DUMP */}
        {activeTab === 'dump' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: textMuted }}>Filter:</span>
              <Sel val={filterType} set={setFilterType} opts={['all', ...TYPES]} />
              <Sel val={filterStatus} set={setFilterStatus} opts={['all', ...STATUS]} />
              <Sel val={filterUrgency} set={setFilterUrgency} opts={['all', ...URGENCY]} />
              <button onClick={() => { setShowForm(!showForm); setEditId(null); setDraft({ ...mkEntry(), mode: mode === 'mixed' ? 'work' : mode }); setActAgo(0); setActDur(0) }} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 8, background: modeColors[mode], color: '#fff', border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                + Add entry
              </button>
            </div>

            {showForm && (
              <div style={{ background: bgSecondary, borderRadius: 12, border: `1px solid ${border}`, padding: '1rem', marginBottom: '1rem' }}>
                {editId && <div style={{ background: '#185FA510', border: '0.5px solid #185FA544', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#185FA5', marginBottom: 10 }}>✏️ Editing entry — make changes and save</div>}
                <textarea value={draft.text} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} placeholder="Brain dump here..." style={{ width: '100%', minHeight: 70, borderRadius: 8, border: `1px solid ${border}`, padding: '8px 10px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', background: inputBg, color: text, fontFamily: 'system-ui, sans-serif' }} />
                <div style={{ fontSize: 11, color: dark ? '#555' : '#bbb', marginTop: 4, marginBottom: 10 }}>{fmtCreated(draft.createdAt || new Date().toISOString())}</div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: textMuted }}>Type</label><Sel val={draft.type} set={v => setDraft(d => ({ ...d, type: v }))} opts={TYPES} colors={typeColors} /></div>
                  {mode === 'mixed' && <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: textMuted }}>Context</label><Sel val={draft.mode} set={v => setDraft(d => ({ ...d, mode: v }))} opts={['work', 'life']} /></div>}
                  {draft.type === 'todo' && <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: textMuted }}>Urgency</label><Sel val={draft.urgency} set={v => setDraft(d => ({ ...d, urgency: v }))} opts={URGENCY} colors={urgencyColors} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: textMuted }}>Priority</label><Sel val={draft.priority} set={v => setDraft(d => ({ ...d, priority: v }))} opts={PRIORITY} colors={priorityColors} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: textMuted }}>Status</label><Sel val={draft.status} set={v => setDraft(d => ({ ...d, status: v }))} opts={STATUS} colors={statusColors} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: textMuted }}>Due date</label><input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} style={selStyle} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: textMuted }}>Due time</label><input type="time" value={draft.dueTime} onChange={e => setDraft(d => ({ ...d, dueTime: e.target.value }))} style={selStyle} /></div>
                  </>}
                </div>

                {draft.type === 'activity' && (
                  <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: textMuted, marginBottom: 12 }}>When did this happen?</div>
                    <ActivityClock dark={dark} agoMin={actAgo} dur={actDur} onAgoChange={setActAgo} onDurChange={setActDur} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={saveEntry} style={{ padding: '6px 16px', borderRadius: 8, background: modeColors[mode], color: '#fff', border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>{editId ? 'Update' : 'Save & sync'}</button>
                  <button onClick={() => { setShowForm(false); setEditId(null); setActAgo(0); setActDur(0) }} style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${border}`, fontSize: 13, cursor: 'pointer', color: textMuted }}>Cancel</button>
                </div>
              </div>
            )}

            {urgent.length > 0 && <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: 12, fontWeight: 500, color: '#E24B4A', marginBottom: 4 }}>⚠️ Urgent</div>{urgent.map(e => <EntryCard key={e.id} entry={e} onEdit={startEdit} onDelete={deleteEntry} onCycleStatus={cycleStatus} onLink={() => { setLinkedTask(e.text.slice(0, 40)); setActiveTab('timer') }} mode={mode} dark={dark} />)}</div>}
            {inProg.length > 0 && <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: 12, fontWeight: 500, color: '#378ADD', marginBottom: 4 }}>▶ In progress</div>{inProg.map(e => <EntryCard key={e.id} entry={e} onEdit={startEdit} onDelete={deleteEntry} onCycleStatus={cycleStatus} onLink={() => { setLinkedTask(e.text.slice(0, 40)); setActiveTab('timer') }} mode={mode} dark={dark} />)}</div>}
            {visible.filter(e => e.status === 'pending' && e.urgency !== 'high').length > 0 && <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: 12, fontWeight: 500, color: textMuted, marginBottom: 4 }}>Pending</div>{visible.filter(e => e.status === 'pending' && e.urgency !== 'high').map(e => <EntryCard key={e.id} entry={e} onEdit={startEdit} onDelete={deleteEntry} onCycleStatus={cycleStatus} onLink={() => { setLinkedTask(e.text.slice(0, 40)); setActiveTab('timer') }} mode={mode} dark={dark} />)}</div>}
            {visible.filter(e => e.status === 'done').length > 0 && <details><summary style={{ fontSize: 13, color: textMuted, cursor: 'pointer' }}>Completed ({visible.filter(e => e.status === 'done').length})</summary><div style={{ marginTop: 6 }}>{visible.filter(e => e.status === 'done').map(e => <EntryCard key={e.id} entry={e} onEdit={startEdit} onDelete={deleteEntry} onCycleStatus={cycleStatus} onLink={() => {}} mode={mode} dark={dark} />)}</div></details>}
            {visible.length === 0 && !showForm && <div style={{ textAlign: 'center', color: textMuted, fontSize: 14, padding: '2rem 0' }}>Your brain dump is empty. Hit "Add entry" to start.</div>}

            <div style={{ marginTop: '1.5rem', borderTop: `1px solid ${border}`, paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={pushAll} disabled={syncing || pulling} style={btnOutline}><NotionLogo size={15} /> {syncing ? 'Pushing...' : 'Push to Notion'}</button>
                <button onClick={pullAll} disabled={syncing || pulling} style={btnOutline}><NotionLogo size={15} /> {pulling ? 'Pulling...' : 'Pull from Notion'}</button>
                <a href={NOTION_URL} target="_blank" rel="noreferrer" style={{ ...btnOutline, textDecoration: 'none' }}><NotionLogo size={15} /> Open in Notion</a>
                <a href="https://calendar.google.com" target="_blank" rel="noreferrer" style={{ ...btnOutline, textDecoration: 'none' }}>📅 Google Calendar</a>
                {syncMsg && <span style={{ fontSize: 12, color: syncMsg.includes('fail') ? '#E24B4A' : '#0F6E56' }}>{syncMsg}</span>}
              </div>
              <p style={{ fontSize: 11, color: textMuted, marginTop: 8 }}>Entries auto-sync to Notion on save. Push/Pull for bulk sync or to pick up edits made in Notion.</p>
            </div>
          </div>
        )}

        {/* TIMER */}
        {activeTab === 'timer' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRESETS.map((p, i) => (
                <button key={i} onClick={() => { setPresetIdx(i); setTimerRunning(false); setTimerPhase('work') }} style={{ padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${presetIdx === i ? modeColors[mode] : border}`, background: presetIdx === i ? modeColors[mode] + '18' : 'transparent', color: presetIdx === i ? modeColors[mode] : textMuted, fontSize: 13, cursor: 'pointer' }}>{p.label}</button>
              ))}
            </div>
            <svg width="128" height="128" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={r} fill="none" stroke={dark ? '#333' : '#eee'} strokeWidth="8" />
              <circle cx="64" cy="64" r={r} fill="none" stroke={timerPhase === 'work' ? modeColors[mode] : '#0F6E56'} strokeWidth="8" strokeDasharray={circ2} strokeDashoffset={circ2 * (1 - progress)} strokeLinecap="round" transform="rotate(-90 64 64)" style={{ transition: 'stroke-dashoffset 0.5s' }} />
              <text x="64" y="60" textAnchor="middle" fontSize="22" fontWeight="500" fill={text}>{fmtTimer(timerSecs)}</text>
              <text x="64" y="78" textAnchor="middle" fontSize="12" fill={textMuted}>{timerPhase}</text>
            </svg>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setTimerRunning(r => !r)} style={{ padding: '8px 28px', borderRadius: 10, background: modeColors[mode], color: '#fff', border: 'none', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>{timerRunning ? '⏸ Pause' : '▶ Start'}</button>
              <button onClick={() => { setTimerRunning(false); setTimerPhase('work'); setTimerSecs(preset.work * 60) }} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', fontSize: 14, cursor: 'pointer', color: text }}>↺</button>
            </div>
            <div style={{ width: '100%', background: bgSecondary, borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: textMuted, marginBottom: 6 }}>Linked task</div>
              {linkedTask ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 14, color: text }}>{linkedTask}</span><button onClick={() => setLinkedTask(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textMuted }}>✕</button></div>
                : <div style={{ fontSize: 13, color: textMuted }}>No task linked. Tap ⏱ on a brain dump entry to link it.</div>}
            </div>
          </div>
        )}

        {/* SESSIONS */}
        {activeTab === 'sessions' && (
          <div>
            <div style={{ fontSize: 14, color: textMuted, marginBottom: '0.75rem' }}>
              Total sessions: <strong style={{ color: text }}>{sessions.length}</strong> &nbsp;|&nbsp; Total focus time: <strong style={{ color: text }}>{sessions.reduce((a, s) => a + (s.duration || 0), 0)} min</strong>
            </div>
            {sessions.length === 0 && <div style={{ textAlign: 'center', color: textMuted, fontSize: 14, padding: '2rem 0' }}>No sessions yet. Start the focus timer!</div>}
            {sessions.map(s => (
              <div key={s.id} style={{ background: bgSecondary, borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: text }}>{s.duration} min session</div>
                  <div style={{ fontSize: 12, color: textMuted }}>{s.task || 'No task linked'}</div>
                </div>
                <div style={{ fontSize: 11, color: textMuted }}>{new Date(s.date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
