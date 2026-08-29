import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')

const quote = (value) => `"${String(value)}"`

const jobs = [
  { name: 'web', command: process.execPath, args: [viteBin], cwd: rootDir },
  { name: 'server', command: process.execPath, args: ['--watch', 'server/server.mjs'], cwd: rootDir },
]

let shuttingDown = false
const children = jobs.map((job) => {
  // 通过系统 shell 拉起子进程：Windows 中文/空格路径 + Defender 下可避免 spawn EPERM。
  const commandLine = [job.command, ...job.args].map(quote).join(' ')
  const child = spawn(commandLine, {
    cwd: job.cwd,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  })
  child.on('exit', (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) {
      console.error(`[dev] ${job.name} 已退出：${signal || code}`)
      shutdown(code || 1)
    }
  })
  return child
})

function killTree(child) {
  if (!child?.pid || child.killed) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    return
  }
  child.kill('SIGTERM')
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) killTree(child)
  setTimeout(() => process.exit(exitCode), 250).unref()
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
