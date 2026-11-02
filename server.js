const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const root = __dirname

function loadProjectEnv() {
  const envPaths = [path.join(root, '.env.development.local'), '/vercel/share/.env.project']
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue
    const contents = fs.readFileSync(envPath, 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match || process.env[match[1]]) continue
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

loadProjectEnv()
// Load project-managed variables before any serverless handler is required.
const port = Number(process.env.PORT || 3000)
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch { reject(new Error('Invalid JSON body')) }
    })
    request.on('error', reject)
  })
}

async function handleApi(request, response, pathname, searchParams) {
  const handlerPath = path.resolve(root, `.${pathname}.js`)
  if (!handlerPath.startsWith(path.resolve(root, './api')) || !fs.existsSync(handlerPath)) return false
  try {
    request.query = Object.fromEntries(searchParams.entries())
    request.body = request.method === 'GET' ? {} : await parseRequestBody(request)
    const handler = require(handlerPath)
    await handler(request, response)
  } catch (error) {
    console.error(`[v0] API route failed: ${pathname}`, error)
    if (!response.headersSent) {
      response.statusCode = 500
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ error: 'API route failed.' }))
    }
  }
  return true
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  const requestedPath = decodeURIComponent(url.pathname)
  if (requestedPath.startsWith('/api/')) {
    const handled = await handleApi(request, response, requestedPath, url.searchParams)
    if (handled) return
  }
  const safePath = requestedPath === '/' ? '/index.html' : requestedPath
  const directPath = path.resolve(root, `.${safePath}`)
  const publicPath = path.resolve(root, `./public${safePath}`)
  const filePath = fs.existsSync(directPath) ? directPath : publicPath

  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  fs.createReadStream(filePath).pipe(response)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`DAVPAY preview server listening on ${port}`)
})
