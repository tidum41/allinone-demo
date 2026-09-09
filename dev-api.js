import { createServer } from 'http'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import handler from './api/categorize.js'

function loadEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), name)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (key && process.env[key] == null) process.env[key] = value
    }
  }
}

loadEnvFiles()

const PORT = Number(process.env.API_PORT || 3001)

function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  })
  res.end(json)
}

function adapt(req, rawBody) {
  let parsed = {}
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      parsed = {}
    }
  }
  return {
    method: req.method,
    headers: req.headers,
    body: parsed,
  }
}

function adaptRes(res) {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      send(res, this.statusCode || 200, data)
    },
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return
  }

  const url = req.url?.split('?')[0]
  if (url === '/api/categorize' || url === '/categorize') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      await handler(adapt(req, body), adaptRes(res))
    } catch (e) {
      console.error(e)
      send(res, 500, { error: 'Internal server error' })
    }
    return
  }

  send(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
