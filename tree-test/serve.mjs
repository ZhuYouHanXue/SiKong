import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PORT = Number(process.env.PORT || 4573)
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://x').pathname)
    if (pathname === '/') pathname = '/tree-test/index.html'
    const file = join(root, pathname)
    const data = await readFile(file)
    const type = MIME[extname(file)] || 'application/octet-stream'
    response.writeHead(200, { 'Content-Type': type })
    response.end(data)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('not found')
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`tree-test: http://127.0.0.1:${PORT}/tree-test/index.html`)
})
