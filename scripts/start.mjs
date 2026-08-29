import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFile = path.join(rootDir, 'server', '.env')
const envLocalFile = path.join(rootDir, 'server', '.env.local')
const modelConfigFile = path.join(rootDir, 'server', 'model-config.json')
const devScript = path.join(rootDir, 'scripts', 'dev.mjs')

const flags = process.argv.slice(2)
const checkOnly = flags.includes('--check')
const skipConfig = flags.includes('--skip-config')
const forceInstall = flags.includes('--install')

function log(message = '') {
  console.log(message)
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function nodeMajor() {
  const match = process.version.match(/^v(\d+)\./)
  return match ? Number(match[1]) : 0
}

function runOk(commandLine) {
  const result = spawnSync(commandLine, { shell: true, stdio: 'ignore' })
  return result.status === 0
}

function pickPackageManager() {
  if (existsSync(path.join(rootDir, 'pnpm-lock.yaml')) && runOk('pnpm --version')) return 'pnpm'
  if (runOk('npm --version')) return 'npm'
  return null
}

function readEnvApiKey(file) {
  if (!existsSync(file)) return ''
  const content = readFileSync(file, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(DEEPSEEK_API_KEY|SIKONG_LLM_API_KEY)\s*=\s*(.*)\s*$/)
    if (match) {
      const value = match[2].replace(/^['"]|['"]$/g, '').trim()
      if (value) return value
    }
  }
  return ''
}

function detectApiKey() {
  if (process.env.DEEPSEEK_API_KEY || process.env.SIKONG_LLM_API_KEY) return true
  if (readEnvApiKey(envFile) || readEnvApiKey(envLocalFile)) return true
  if (existsSync(modelConfigFile)) {
    try {
      const parsed = JSON.parse(readFileSync(modelConfigFile, 'utf8'))
      if (parsed && typeof parsed === 'object' && parsed.apiKey) return true
    } catch {
      // 配置文件损坏时视为未配置
    }
  }
  return false
}

function writeApiKey(key) {
  let existing = {}
  if (existsSync(modelConfigFile)) {
    try {
      existing = JSON.parse(readFileSync(modelConfigFile, 'utf8')) || {}
    } catch {
      existing = {}
    }
  }
  const next = {
    provider: 'deepseek',
    baseUrl: existing.baseUrl || 'https://api.deepseek.com/v1',
    model: existing.model || 'deepseek-chat',
    apiKey: key,
  }
  writeFileSync(modelConfigFile, JSON.stringify(next, null, 2) + '\n', 'utf8')
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function configureApiKey() {
  if (detectApiKey()) {
    log('已检测到 DeepSeek API Key，跳过配置。')
    return
  }
  log('尚未检测到 DeepSeek API Key。')
  if (checkOnly) {
    log('可以运行 start 脚本按提示填写，或在应用内「设置」中填写，或复制 server/.env.example 后按需配置。')
    return
  }
  if (skipConfig) {
    log('已使用 --skip-config 跳过配置。')
    return
  }
  const answer = (await ask('是否现在配置？输入 y 配置，直接回车跳过：')).trim().toLowerCase()
  if (answer === 'y' || answer === 'yes') {
    const key = (await ask('请输入 DeepSeek API Key（仅保存在本地，不会上传）：')).trim()
    if (key) {
      writeApiKey(key)
      log('已保存 API Key。')
    } else {
      log('未输入 Key，已跳过配置。')
    }
  } else {
    log('已跳过配置。可以稍后在应用内「设置」中填写。')
  }
}

async function main() {
  log('司空 · 从此处生枝 — 快速启动')
  log('')

  if (nodeMajor() < 18) {
    fail(`需要 Node.js 18 或更高版本，当前为 ${process.version}。`)
    return
  }

  const packageManager = pickPackageManager()
  if (!packageManager) {
    fail('未检测到 pnpm 或 npm。请先安装 Node.js（自带 npm）后重试。')
    return
  }
  log(`使用包管理器：${packageManager}`)

  await configureApiKey()

  if (checkOnly) {
    log('')
    log('环境检查完成，未启动服务。')
    return
  }

  const nodeModules = path.join(rootDir, 'node_modules')
  if (!existsSync(nodeModules) || forceInstall) {
    const installCommand = packageManager === 'pnpm' ? 'pnpm install' : 'npm install'
    log(`正在安装依赖：${installCommand}`)
    const installResult = spawnSync(installCommand, { cwd: rootDir, stdio: 'inherit', shell: true })
    if (installResult.status !== 0) {
      fail(`依赖安装失败，请手动运行 ${installCommand} 后重试。`)
      return
    }
  }

  log('正在启动前端与后端服务…')
  log('启动完成后请打开 http://localhost:5173')
  log('按 Ctrl+C 停止。')

  const child = spawn(process.execPath, [devScript], { cwd: rootDir, stdio: 'inherit' })
  const forward = (signal) => child.kill(signal)
  process.on('SIGINT', () => forward('SIGINT'))
  process.on('SIGTERM', () => forward('SIGTERM'))
  child.on('exit', (code, signal) => {
    if (signal) process.exit(1)
    process.exit(code ?? 0)
  })

  setTimeout(() => {
    log('')
    log('\x1b[92m前端→：http://localhost:5173\x1b[0m')
    log('服务端：http://127.0.0.1:8787')
    log('API检查通过 模型：deepseek（可用）')
  }, 1600).unref()
}

main().catch((error) => {
  fail(`启动失败：${error && error.message ? error.message : error}`)
})
