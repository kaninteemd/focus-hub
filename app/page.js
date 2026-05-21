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

const mkEntry = () => ({ id: String(Date.now()), text: '', type: 'todo', mode: 'work', urgency: 'medium', priority: 'medium', status: 'pending', dueDate: '', dueTime: '', createdAt: new Date().toISOString(), notionPageId: null, notified: false })

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

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const badge = (label, color) => (
  <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 500 }}>{label}</span>
)

const Sel = ({ val, set, opts, colors }) => (
  <select value={val} onChange={e => set(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #ddd', color: colors?.[val] || '#333', background: '#fff' }}>
    {opts.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
)

function EntryCard({ entry: e, onEdit, onDelete, onCycleStatus, onLink, mode }) {
  const mc = { work: '#185FA5', life: '#0F6E56', mixed: '#7F77DD' }
  const done = e.status === 'done'
  return (
    <div style={{ background: '#fff', border: `1px solid ${e.urgency === 'high' && !done ? '#E24B4A44' : '#eee'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, opacity: done ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button onClick={() => onCycleStatus(e.id)} style={{ marginTop: 2, width: 18, height: 18, borderRadius: '50%', border: `2px solid ${statusColors[e.status]}`, background: done ? statusColors.done : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, textDecoration: done ? 'line-through' : 'none', marginBottom: 4, color: '#111' }}>{e.text}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {badge(e.type, typeColors[e.type])}
            {e.type === 'todo' && <>{badge(`U:${e.urgency}`, urgencyColors[e.urgency])}{badge(`P:${e.priority}`, priorityColors[e.priority])}{badge(e.status, statusColors[e.status])}</>}
            {mode === 'mixed' && badge(e.mode, mc[e.mode])}
            {e.dueDate && <span style={{ fontSize: 11, color: '#888' }}>📅 {e.dueDate}{e.dueTime ? ` ${e.dueTime}` : ''}</span>}
            {e.notionPageId && <span style={{ fontSize: 11, color: '#7F77DD' }} title="Synced to Notion">N</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onLink(e)} title="Link to timer" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}>⏱</button>
          <button onClick={() => onEdit(e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}>✏️</button>
          <button onClick={() => onDelete(e.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}>🗑</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
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
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerPhase, setTimerPhase] = useState('work')
  const [timerSecs, setTimerSecs] = useState(25 * 60)
  const [linkedTask, setLinkedTask] = useState(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const intervalRef = useRef(null)
  const notifRef = useRef(false)

  useEffect(() => {
    if (Notification?.permission === 'granted') notifRef.current = true
    else if (Notification?.permission !== 'denied') Notification.requestPermission().then(p => { notifRef.current = p === 'granted' })
  }, [])

  const preset = PRESETS[presetIdx] || PRESETS[0]

  useEffect(() => {
    setTimerSecs((timerPhase === 'work' ? preset.work : preset.brk) * 60)
  }, [presetIdx, timerPhase])

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSecs(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setTimerRunning(false)
            const np = timerPhase === 'work' ? 'break' : 'work'
            if (timerPhase === 'work') {
              const ns = { id: Date.now(), duration: preset.work, task: linkedTask, mode, date: new Date().toISOString() }
              setSessions(prev => [ns, ...prev.slice(0, 49)])
            }
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
    const updated = editId
      ? { ...entries.find(e => e.id === editId), ...draft, mode: entryMode }
      : { ...draft, id: String(Date.now()), createdAt: new Date().toISOString(), mode: entryMode }

    if (editId) setEntries(prev => prev.map(e => e.id === editId ? updated : e))
    else setEntries(prev => [updated, ...prev])
    setDraft(mkEntry()); setShowForm(false); setEditId(null)

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

  function startEdit(e) { setDraft({ ...e }); setEditId(e.id); setShowForm(true); setActiveTab('dump') }
  function deleteEntry(id) { setEntries(prev => prev.filter(e => e.id !== id)) }
  function cycleStatus(id) { setEntries(prev => prev.map(e => e.id !== id ? e : { ...e, status: STATUS[(STATUS.indexOf(e.status) + 1) % STATUS.length] })) }

  const r = 54, circ = 2 * Math.PI * r
  const totalSecs = (timerPhase === 'work' ? preset.work : preset.brk) * 60
  const progress = 1 - timerSecs / totalSecs

  const btnStyle = (active, color) => ({
    padding: '5px 10px', borderRadius: 8,
    border: `1.5px solid ${active ? color : '#ddd'}`,
    background: active ? color + '18' : 'transparent',
    color: active ? color : '#666',
    fontWeight: active ? 500 : 400, fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4
  })

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1rem 0.75rem', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontWeight: 500, fontSize: 18 }}>🧠 Focus Hub</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {MODES.map(m => (
            <button key={m} onClick={() => setMode(m)} style={btnStyle(mode === m, modeColors[m])}>
              {modeIcons[m]} {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1rem' }}>
        {[
          { label: 'Urgent', val: urgent.length, color: '#E24B4A' },
          { label: 'In progress', val: inProg.length, color: '#378ADD' },
          { label: 'Pending', val: visible.filter(e => e.status === 'pending').length, color: '#888' },
          { label: 'Done', val: visible.filter(e => e.status === 'done').length, color: '#0F6E56' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f5f5f5', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: '1rem' }}>
        {[{ id: 'dump', label: '🧠 Brain dump' }, { id: 'timer', label: '⏱ Focus timer' }, { id: 'sessions', label: '📋 Sessions' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? `2px solid ${modeColors[mode]}` : '2px solid transparent', color: activeTab === t.id ? modeColors[mode] : '#666', fontWeight: activeTab === t.id ? 500 : 400, fontSize: 14, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BRAIN DUMP */}
      {activeTab === 'dump' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#666' }}>Filter:</span>
            <Sel val={filterType} set={setFilterType} opts={['all', ...TYPES]} />
            <Sel val={filterStatus} set={setFilterStatus} opts={['all', ...STATUS]} />
            <Sel val={filterUrgency} set={setFilterUrgency} opts={['all', ...URGENCY]} />
            <button onClick={() => { setShowForm(!showForm); setEditId(null); setDraft({ ...mkEntry(), mode: mode === 'mixed' ? 'work' : mode }) }} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 8, background: modeColors[mode], color: '#fff', border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
              + Add entry
            </button>
          </div>

          {showForm && (
            <div style={{ background: '#f9f9f9', borderRadius: 12, border: '1px solid #eee', padding: '1rem', marginBottom: '1rem' }}>
              <textarea value={draft.text} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} placeholder="Brain dump here..." style={{ width: '100%', minHeight: 70, borderRadius: 8, border: '1px solid #ddd', padding: '8px 10px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: '#666' }}>Type</label><Sel val={draft.type} set={v => setDraft(d => ({ ...d, type: v }))} opts={TYPES} colors={typeColors} /></div>
                {mode === 'mixed' && <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: '#666' }}>Context</label><Sel val={draft.mode} set={v => setDraft(d => ({ ...d, mode: v }))} opts={['work', 'life']} /></div>}
                {draft.type === 'todo' && <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: '#666' }}>Urgency</label><Sel val={draft.urgency} set={v => setDraft(d => ({ ...d, urgency: v }))} opts={URGENCY} colors={urgencyColors} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: '#666' }}>Priority</label><Sel val={draft.priority} set={v => setDraft(d => ({ ...d, priority: v }))} opts={PRIORITY} colors={priorityColors} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: '#666' }}>Status</label><Sel val={draft.status} set={v => setDraft(d => ({ ...d, status: v }))} opts={STATUS} colors={statusColors} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: '#666' }}>Due date</label><input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #ddd' }} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><label style={{ fontSize: 11, color: '#666' }}>Due time</label><input type="time" value={draft.dueTime} onChange={e => setDraft(d => ({ ...d, dueTime: e.target.value }))} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #ddd' }} /></div>
                </>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={saveEntry} style={{ padding: '6px 16px', borderRadius: 8, background: modeColors[mode], color: '#fff', border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>{editId ? 'Update' : 'Save & sync'}</button>
                <button onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: '1px solid #ddd', fontSize: 13, cursor: 'pointer', color: '#666' }}>Cancel</button>
              </div>
            </div>
          )}

          {urgent.length > 0 && <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: 12, fontWeight: 500, color: '#E24B4A', marginBottom: 4 }}>⚠️ Urgent</div>{urgent.map(e => <EntryCard key={e.id} entry={e} onEdit={startEdit} onDelete={deleteEntry} onCycleStatus={cycleStatus} onLink={() => { setLinkedTask(e.text.slice(0, 40)); setActiveTab('timer') }} mode={mode} />)}</div>}
          {inProg.length > 0 && <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: 12, fontWeight: 500, color: '#378ADD', marginBottom: 4 }}>▶ In progress</div>{inProg.map(e => <EntryCard key={e.id} entry={e} onEdit={startEdit} onDelete={deleteEntry} onCycleStatus={cycleStatus} onLink={() => { setLinkedTask(e.text.slice(0, 40)); setActiveTab('timer') }} mode={mode} />)}</div>}
          {visible.filter(e => e.status === 'pending' && e.urgency !== 'high').length > 0 && <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 4 }}>Pending</div>{visible.filter(e => e.status === 'pending' && e.urgency !== 'high').map(e => <EntryCard key={e.id} entry={e} onEdit={startEdit} onDelete={deleteEntry} onCycleStatus={cycleStatus} onLink={() => { setLinkedTask(e.text.slice(0, 40)); setActiveTab('timer') }} mode={mode} />)}</div>}
          {visible.filter(e => e.status === 'done').length > 0 && <details><summary style={{ fontSize: 13, color: '#888', cursor: 'pointer' }}>Completed ({visible.filter(e => e.status === 'done').length})</summary><div style={{ marginTop: 6 }}>{visible.filter(e => e.status === 'done').map(e => <EntryCard key={e.id} entry={e} onEdit={startEdit} onDelete={deleteEntry} onCycleStatus={cycleStatus} onLink={() => {}} mode={mode} />)}</div></details>}
          {visible.length === 0 && !showForm && <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '2rem 0' }}>Your brain dump is empty. Hit "Add entry" to start.</div>}

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={pushAll} disabled={syncing || pulling} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#666' }}>
                ⬆️ {syncing ? 'Pushing...' : 'Push to Notion'}
              </button>
              <button onClick={pullAll} disabled={syncing || pulling} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#666' }}>
                ⬇️ {pulling ? 'Pulling...' : 'Pull from Notion'}
              </button>
              <a href={NOTION_URL} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: '#666', textDecoration: 'none' }}>↗ Open in Notion</a>
              <a href="https://calendar.google.com" target="_blank" rel="noreferrer" style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: '#666', textDecoration: 'none' }}>📅 Google Calendar</a>
              {syncMsg && <span style={{ fontSize: 12, color: syncMsg.includes('fail') ? '#E24B4A' : '#0F6E56' }}>{syncMsg}</span>}
            </div>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>Entries auto-sync to Notion on save. Push/Pull for bulk sync or to pick up edits made directly in Notion.</p>
          </div>
        </div>
      )}

      {/* TIMER */}
      {activeTab === 'timer' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => { setPresetIdx(i); setTimerRunning(false); setTimerPhase('work') }} style={btnStyle(presetIdx === i, modeColors[mode])}>{p.label}</button>
            ))}
          </div>
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={r} fill="none" stroke="#eee" strokeWidth="8" />
            <circle cx="64" cy="64" r={r} fill="none" stroke={timerPhase === 'work' ? modeColors[mode] : '#0F6E56'} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} strokeLinecap="round" transform="rotate(-90 64 64)" style={{ transition: 'stroke-dashoffset 0.5s' }} />
            <text x="64" y="60" textAnchor="middle" fontSize="22" fontWeight="500" fill="#111">{fmt(timerSecs)}</text>
            <text x="64" y="78" textAnchor="middle" fontSize="12" fill="#888">{timerPhase}</text>
          </svg>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setTimerRunning(r => !r)} style={{ padding: '8px 28px', borderRadius: 10, background: modeColors[mode], color: '#fff', border: 'none', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>
              {timerRunning ? '⏸ Pause' : '▶ Start'}
            </button>
            <button onClick={() => { setTimerRunning(false); setTimerPhase('work'); setTimerSecs(preset.work * 60) }} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #ddd', background: 'transparent', fontSize: 14, cursor: 'pointer' }}>↺</button>
          </div>
          <div style={{ width: '100%', background: '#f5f5f5', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Linked task</div>
            {linkedTask
              ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 14 }}>{linkedTask}</span><button onClick={() => setLinkedTask(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button></div>
              : <div style={{ fontSize: 13, color: '#aaa' }}>No task linked. Tap ⏱ on a brain dump entry to link it.</div>}
          </div>
        </div>
      )}

      {/* SESSIONS */}
      {activeTab === 'sessions' && (
        <div>
          <div style={{ fontSize: 14, color: '#666', marginBottom: '0.75rem' }}>
            Total sessions: <strong>{sessions.length}</strong> &nbsp;|&nbsp; Total focus time: <strong>{sessions.reduce((a, s) => a + (s.duration || 0), 0)} min</strong>
          </div>
          {sessions.length === 0 && <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '2rem 0' }}>No sessions yet. Start the focus timer!</div>}
          {sessions.map(s => (
            <div key={s.id} style={{ background: '#f5f5f5', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.duration} min session</div>
                <div style={{ fontSize: 12, color: '#666' }}>{s.task || 'No task linked'}</div>
              </div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{new Date(s.date).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
