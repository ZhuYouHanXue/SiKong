import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')

const jobs = [
  { name: 'web', command: process.execPath, args: [viteBin], cwd: rootDir },
  { name: 'server', command: process.execPath, args: ['--watch', 'server/server.mjs'], cwd: rootDir },
]

let shuttingDown = false
const children = jobs.map((job) => {
  const child = spawn(job.command, job.args, {
    cwd: job.cwd,
    env: process.env,
    stdio: 'inherit',
  })
  child.on('exit', (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) {
      console.error(`[dev] ${job.name} 已退出：${signal || code}`)
      shutdown(code || 1)
    }
  })
  return child
})

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  setTimeout(() => process.exit(exitCode), 250).unref()
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
