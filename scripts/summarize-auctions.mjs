/**
 * summarize-auctions.mjs
 * ======================
 * 用 Google Gemini 免费 API 读取每套法拍房的司法专家鉴定报告 (Gutachten) PDF，
 * 生成简体中文摘要 + 风险标签，写回 public/data/auctions.json。
 *
 * 运行：GEMINI_API_KEY=xxx node scripts/summarize-auctions.mjs
 *
 * 设计：
 *   - 只处理「有 pdfUrl 且尚无 summarizedAt」的记录（增量，不重复扣额度）
 *   - 结果写入 summary（中文）、riskTags（中文数组）、summarizedAt（ISO 时间戳）
 *   - 任何单条失败都跳过、不中断整体；下次运行会重试该条
 *   - 没有 GEMINI_API_KEY 时直接退出 0（不影响抓取流程）
 *
 * 免费额度（gemini-2.0-flash）：15 RPM / 1500 RPD —— 脚本内置节流。
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'public', 'data', 'auctions.json')

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const MAX_PER_RUN = Number(process.env.GEMINI_MAX_PER_RUN || 80)
const MAX_PDF_BYTES = 45 * 1024 * 1024 // File API 支持到 50MB，留余量
const THROTTLE_MS = 4500 // ~13 RPM，低于 15 RPM 限制

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PDF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'de-AT,de;q=0.9',
  Accept: 'application/pdf,*/*',
}

const PROMPT = `你是一位为华人客户服务的维也纳房地产投资顾问。下面是一份奥地利法拍房的司法专家鉴定报告（Gutachten / Schätzgutachten）PDF。

请只依据报告内容（不要编造），用简体中文输出：

1) summary：一段 150–250 字的摘要，尽量涵盖：房产类型与所在区域/楼层、面积与房间结构、建筑年代与状况、估值依据与市场参考、当前使用状态（自用 / 出租 / 空置）、是否存在租约及租金水平、明显的维修或翻新需求。语气客观专业。

2) riskTags：从报告中提炼对买家重要的风险/注意点，每个标签 2–8 个汉字，例如「有租约」「需翻新」「地役权」「终身居住权」「欠缺施工许可」「共有产权」「文物保护」「拖欠管理费」「地下室潮湿」等。没有明显风险则返回空数组。

如果报告信息过少无法判断，summary 写「报告信息有限，建议查阅原始 PDF」，riskTags 返回空数组。`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    riskTags: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'riskTags'],
}

async function downloadPdf(url) {
  const res = await fetch(url, { headers: PDF_HEADERS, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`PDF HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_PDF_BYTES) throw new Error(`PDF too large (${(buf.length / 1e6).toFixed(1)}MB)`)
  if (buf.length < 1000) throw new Error('PDF suspiciously small')
  return buf
}

const FILE_BASE = 'https://generativelanguage.googleapis.com'

/**
 * Upload a PDF via the Gemini File API (resumable protocol). These court
 * appraisals are scanned 10–15MB documents — well over the ~20MB inline
 * request ceiling once base64-inflated — so we upload first and reference
 * the file by URI. Returns the active file resource ({ uri, mimeType, name }).
 */
async function uploadPdf(buffer, displayName) {
  // Step 1 — initiate resumable upload session
  const start = await fetch(`${FILE_BASE}/upload/v1beta/files?key=${API_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.length),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
    signal: AbortSignal.timeout(60000),
  })
  if (!start.ok) throw new Error(`upload start HTTP ${start.status}`)
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('no upload URL returned')

  // Step 2 — upload bytes and finalize
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: buffer,
    signal: AbortSignal.timeout(120000),
  })
  if (!up.ok) throw new Error(`upload HTTP ${up.status}`)
  let file = (await up.json()).file
  if (!file?.name) throw new Error('upload returned no file')

  // Step 3 — wait until the file finishes processing
  let tries = 0
  while (file.state === 'PROCESSING' && tries++ < 30) {
    await sleep(2000)
    file = await fetch(`${FILE_BASE}/v1beta/${file.name}?key=${API_KEY}`).then((r) => r.json())
  }
  if (file.state !== 'ACTIVE') throw new Error(`file not ACTIVE (${file.state})`)
  return file
}

async function deleteFile(name) {
  try {
    await fetch(`${FILE_BASE}/v1beta/${name}?key=${API_KEY}`, { method: 'DELETE' })
  } catch {
    /* files auto-expire after 48h anyway */
  }
}

async function summarizeWithGemini(file) {
  const url = `${FILE_BASE}/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`
  const body = {
    contents: [
      {
        parts: [
          { file_data: { mime_type: file.mimeType || 'application/pdf', file_uri: file.uri } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const err = new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 500)}`)
    if (res.status === 429) err.quota = true // daily/rate quota exhausted
    throw err
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no text')
  const parsed = JSON.parse(text)
  const summary = (parsed.summary || '').trim()
  const riskTags = Array.isArray(parsed.riskTags)
    ? parsed.riskTags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
    : []
  if (!summary) throw new Error('empty summary')
  return { summary, riskTags }
}

async function main() {
  if (!API_KEY) {
    console.log('⚠️  未设置 GEMINI_API_KEY，跳过 PDF 总结步骤。')
    process.exit(0)
  }

  console.log('='.repeat(60))
  console.log(`法拍报告 PDF → 中文摘要（Gemini ${MODEL}）`)
  console.log('='.repeat(60))

  const all = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const pending = all.filter((a) => a.pdfUrl && !a.summarizedAt)
  console.log(`总记录 ${all.length}，待总结 ${pending.length}，本次最多处理 ${MAX_PER_RUN}`)

  const batch = pending.slice(0, MAX_PER_RUN)
  let ok = 0,
    fail = 0
  const byId = new Map(all.map((a, i) => [a.id, i]))

  for (let i = 0; i < batch.length; i++) {
    const a = batch[i]
    process.stdout.write(`  [${i + 1}/${batch.length}] ${a.address?.slice(0, 45)} ... `)
    let uploadedName = null
    try {
      const pdf = await downloadPdf(a.pdfUrl)
      const file = await uploadPdf(pdf, a.id)
      uploadedName = file.name
      const { summary, riskTags } = await summarizeWithGemini(file)
      const idx = byId.get(a.id)
      all[idx] = { ...all[idx], summary, riskTags, summarizedAt: new Date().toISOString() }
      ok++
      console.log(`✓ ${riskTags.length} 风险标签`)
      // 每条成功后立即落盘，避免中途失败丢进度
      writeFileSync(DATA_PATH, JSON.stringify(all, null, 2), 'utf8')
    } catch (e) {
      fail++
      console.log(`✗ ${e.message}`)
      if (e.quota) {
        // Daily/rate quota hit — no point hammering the API for the rest of
        // the run. Stop now; already-summarized rows are saved, and the next
        // scheduled run resumes the remainder (summarizedAt gating).
        console.log('\n⚠️  Gemini 配额已用尽，本轮提前停止；下次运行自动续做剩余报告。')
        break
      }
    } finally {
      if (uploadedName) await deleteFile(uploadedName)
    }
    if (i < batch.length - 1) await sleep(THROTTLE_MS)
  }

  console.log(`\n完成：成功 ${ok}，失败 ${fail}，剩余未总结 ${pending.length - ok}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  // 不让总结失败拖垮整个 workflow —— 抓取的数据仍然有效
  process.exit(0)
})
