import { Client } from '@notionhq/client'
import { NextResponse } from 'next/server'

const notion = new Client({ auth: process.env.NOTION_API_TOKEN })
const DB = process.env.NOTION_DATABASE_ID

function toNotionProps(entry) {
  const props = {
    Name: { title: [{ text: { content: entry.text || '' } }] },
    'App ID': { rich_text: [{ text: { content: entry.id || '' } }] },
    Notes: { rich_text: [{ text: { content: entry.text || '' } }] },
  }
  if (entry.type) props.Type = { select: { name: entry.type } }
  if (entry.mode) props.Mode = { select: { name: entry.mode } }
  if (entry.status) props.Status = { select: { name: entry.status } }
  if (entry.urgency) props.Urgency = { select: { name: entry.urgency } }
  if (entry.priority) props.Priority = { select: { name: entry.priority } }
  if (entry.dueDate) {
    props['Due Date'] = {
      date: {
        start: entry.dueTime ? `${entry.dueDate}T${entry.dueTime}:00` : entry.dueDate,
      }
    }
  }
  return props
}

function fromNotionPage(page) {
  const p = page.properties
  const getText = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || ''
  const getSelect = (prop) => prop?.select?.name || ''
  const getDate = (prop) => prop?.date?.start || ''
  return {
    id: getText(p['App ID']) || page.id,
    text: getText(p['Name']),
    type: getSelect(p['Type']) || 'todo',
    mode: getSelect(p['Mode']) || 'work',
    status: getSelect(p['Status']) || 'pending',
    urgency: getSelect(p['Urgency']) || 'medium',
    priority: getSelect(p['Priority']) || 'medium',
    dueDate: getDate(p['Due Date'])?.split('T')[0] || '',
    dueTime: getDate(p['Due Date'])?.includes('T') ? getDate(p['Due Date']).split('T')[1]?.slice(0, 5) : '',
    notionPageId: page.id,
    createdAt: page.created_time,
    notified: false,
  }
}

export async function POST(req) {
  try {
    const { action, entry, entries } = await req.json()

    // Create a single entry
    if (action === 'create') {
      const page = await notion.pages.create({
        parent: { database_id: DB },
        properties: toNotionProps(entry),
      })
      return NextResponse.json({ notionPageId: page.id })
    }

    // Update a single entry
    if (action === 'update') {
      await notion.pages.update({
        page_id: entry.notionPageId,
        properties: toNotionProps(entry),
      })
      return NextResponse.json({ ok: true })
    }

    // Bulk push entries (upsert by App ID)
    if (action === 'push') {
      const results = []
      for (const e of entries) {
        if (e.notionPageId) {
          await notion.pages.update({ page_id: e.notionPageId, properties: toNotionProps(e) })
          results.push({ id: e.id, notionPageId: e.notionPageId })
        } else {
          const page = await notion.pages.create({ parent: { database_id: DB }, properties: toNotionProps(e) })
          results.push({ id: e.id, notionPageId: page.id })
        }
      }
      return NextResponse.json({ results })
    }

    // Pull all entries from Notion
    if (action === 'pull') {
      const pages = []
      let cursor
      do {
        const res = await notion.databases.query({
          database_id: DB,
          start_cursor: cursor,
          page_size: 100,
        })
        pages.push(...res.results)
        cursor = res.has_more ? res.next_cursor : undefined
      } while (cursor)
      return NextResponse.json({ entries: pages.map(fromNotionPage) })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Notion API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
