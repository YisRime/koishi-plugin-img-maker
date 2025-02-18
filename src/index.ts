import { Context, Schema, h } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import {} from '@koishijs/canvas'  // 添加canvas导入
import { readFileSync } from 'fs'
import path from 'path'

// 添加常量
const BACK_DROP_SHADING = `data:image/png;base64,...` // 背景阴影贴图base64
const NOT_FOUND_PFP = `data:image/png;base64,...`     // 默认头像base64
const PSHADING_20X20 = `data:image/png;base64,...`    // 头像阴影贴图base64
const COLOR_LIST = [
  ["#00cdac", "#02aab0"],
  ["#6a82fb", "#fc5c7d"],
  ["#ffb88c", "#de6262"],
  ["#f45c43", "#eb3349"],
  ["#B5AC49", "#3CA55C"]
]

declare class BALogo {
  constructor(options: { options: { fontSize: number, transparent: boolean, haloX: number, haloY: number }, config: { fontSize: number, transparent: boolean, haloX: number, haloY: number } });
  draw(params: { textL: string, textR: string }): Promise<void>;
}

export const name = 'img-maker'
export const inject = {
  required: ['puppeteer', 'canvas']  // 添加canvas依赖
}

export interface Config {
  xibao: StyleConfig
  beibao: StyleConfig
  balogo: {
    fontSize: number
    transparent: boolean
    haloX: number
    haloY: number
  }
  // 添加mcpfp配置
  mcpfp: {
    initName: string
    enablePfp: boolean
    isShowCape: boolean
    gradientDirection: number
    wallColors: string | {startColor: string, endColor: string}
  }
}

interface StyleConfig {
  fontFamily: string
  maxFontSize: number
  minFontSize: number
  offsetWidth: number
}

export const Config: Schema<Config> = Schema.object({
  xibao: Schema.object({
    fontFamily: Schema.string().default('"HarmonyOS Sans SC", "Source Han Sans CN", sans-serif').description('字体设置'),
    maxFontSize: Schema.number().min(1).default(80).description('最大字号'),
    minFontSize: Schema.number().min(1).default(38).description('最小字号'),
    offsetWidth: Schema.number().min(1).default(900).description('文字区域宽度')
  }).description('喜报样式设置'),
  beibao: Schema.object({
    fontFamily: Schema.string().default('"HarmonyOS Sans SC", "Source Han Sans CN", sans-serif').description('字体设置'),
    maxFontSize: Schema.number().min(1).default(90).description('最大字号'),
    minFontSize: Schema.number().min(1).default(38).description('最小字号'),
    offsetWidth: Schema.number().min(1).default(900).description('文字区域宽度')
  }).description('悲报样式设置'),
  balogo: Schema.object({
    fontSize: Schema.number().default(84).description('字体大小'),
    transparent: Schema.boolean().default(false).description('是否透明背景'),
    haloX: Schema.number().default(-18).description('光晕X轴偏移'),
    haloY: Schema.number().default(0).description('光晕Y轴偏移')
  }).description('BA风格logo设置'),
  mcpfp: Schema.object({
    enablePfp: Schema.boolean().default(false).description('是否启用PFP指令'),
    initName: Schema.string().default('steve').description('默认玩家名称'),
    isShowCape: Schema.boolean().default(false).description('是否显示披风'),
    gradientDirection: Schema.number().min(0).max(7).default(0).description('背景渐变方向(0-7)'),
    wallColors: Schema.union([
      Schema.string().description('预设背景(背景1-背景5)'),
      Schema.object({
        startColor: Schema.string().role('color').description('渐变起始颜色'),
        endColor: Schema.string().role('color').description('渐变结束颜色')
      }).description('自定义颜色')
    ]).default('背景1').description('背景颜色设置')
  }).description('MC玩家头像设置')
})

export function apply(ctx: Context, config: Config) {
  ctx.command('make <content:text>')
      .usage(`支持以下类型：
-xb 生成喜报样式图片
-bb 生成悲报样式图片
-balogo <右侧文本> 生成BA风格logo
-mcpfp 生成MC玩家头像`)
      .option('xb', '-xb 使用喜报模板生成图片')
      .option('bb', '-bb 使用悲报模板生成图片')
      .option('balogo', '-balogo <right:text> 生成蔚蓝档案(BA)风格logo，right为右侧文本')
      .option('mcpfp', '-mcpfp 生成我的世界(Minecraft)玩家头像')
      .example('make -xb 喜报！今天你的女装到了！')
      .example('make -bb 悲报！我的女装被室友发现了！')
      .example('make -balogo 档案 蔚蓝')
      .example('make -mcpfp Notch')
      .action(async ({ options }, content) => {
        try {
          if (options.xb) {
            if (!content) return '请提供要生成的内容'
            const img = readFileSync(path.resolve(__dirname, './assets/images/xibao.jpg'))
            const image = await ctx.puppeteer.render(
              generateHTML({
                text: content,
                fontFamily: config.xibao.fontFamily,
                fontColor: '#ff0a0a',
                strokeColor: '#ffde00',
                maxFontSize: config.xibao.maxFontSize,
                minFontSize: config.xibao.minFontSize,
                offsetWidth: config.xibao.offsetWidth,
                img
              })
            )
            return h('image', { src: `base64://${Buffer.isBuffer(image) ? image.toString('base64') : image}` })
          } else if (options.bb) {
            if (!content) return '请提供要生成的内容'
            const img = readFileSync(path.resolve(__dirname, './assets/images/beibao.jpg'))
            const image = await ctx.puppeteer.render(
              generateHTML({
                text: content,
                fontFamily: config.beibao.fontFamily,
                fontColor: '#000500',
                strokeColor: '#c6c6c6',
                maxFontSize: config.beibao.maxFontSize,
                minFontSize: config.beibao.minFontSize,
                offsetWidth: config.beibao.offsetWidth,
                img
              })
            )
            return h('image', { src: `base64://${Buffer.isBuffer(image) ? image.toString('base64') : image}` })
          } else if (options.balogo) {
            if (!content) return '请提供要生成的内容'
            const page = await ctx.puppeteer.browser.newPage()
            await page.goto(`file://${path.resolve(__dirname, '../public/balogo.html')}`, { waitUntil: 'networkidle0' })
            await page.evaluate(async (inputs, config) => {
              const ba = new BALogo({
                options: {
                  fontSize: config.fontSize,
                  transparent: config.transparent,
                  haloX: config.haloX,
                  haloY: config.haloY
                },
                config
              })
              await ba.draw({ textL: inputs.left, textR: inputs.right })
            }, { left: content, right: options.balogo }, config.balogo)

            const canvas = await page.$('#output')
            // 直接返回Buffer而不是转base64
            const image = await canvas.screenshot({ type: 'png', omitBackground: true })
            await page.close()
            return h('image', { src: `base64://${Buffer.isBuffer(image) ? image.toString('base64') : image}` })
          } else if (options.mcpfp) {
            if(!config.mcpfp.enablePfp) return '该指令未启用'
            const player = content || config.mcpfp.initName
            const uuidName = await getUuidNameByName(ctx, player)
            if(!uuidName) return '未找到该玩家'

            const profB64 = await getProfileB64ByUuid(ctx, uuidName.id)
            if(!profB64) return '获取玩家资料失败'

            const skinUrl = getSkinUrlByProfileB64(profB64)
            const image = await generatePfpPic(
              ctx,
              config.mcpfp.wallColors,
              config.mcpfp.gradientDirection,
              skinUrl
            )
            return h('image', { src: `base64://${Buffer.isBuffer(image) ? image.toString('base64') : image}` })
          }

          if (!content) return '请提供要生成的内容'
          const image = await ctx.puppeteer.render(`
            <div style="padding: 20px; background: white;">
              <h1>${content}</h1>
            </div>
          `)
          return h('image', { src: `base64://${Buffer.isBuffer(image) ? image.toString('base64') : image}` })
        } catch (error) {
          return '图片生成失败：' + error.message
        }
      })
}

function generateHTML(params: {
  text: string,
  fontFamily: string,
  fontColor: string,
  strokeColor: string,
  maxFontSize: number,
  minFontSize: number,
  offsetWidth: number,
  img: Buffer
}) {
  const text = escapeHTML(params.text).replaceAll('\n', '<br/>')
  let template = readFileSync(path.resolve(__dirname, '../public/xbbb.html'), 'utf8')

  // 替换模板中的变量
  template = template
    .replace('var(--font-family)', params.fontFamily)
    .replace('var(--font-color)', params.fontColor)
    .replace('var(--stroke-color)', params.strokeColor)
    .replace('VAR_BACKGROUND_IMAGE', `data:image/png;base64,${params.img.toString('base64')}`)
    .replace('VAR_CONTENT', text)
    .replace('VAR_MAX_FONT_SIZE', params.maxFontSize.toString())
    .replace('VAR_MIN_FONT_SIZE', params.minFontSize.toString())
    .replace('VAR_OFFSET_WIDTH', params.offsetWidth.toString())

  return template
}

function escapeHTML(str: string) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag))
}

// 添加工具函数
async function getUuidNameByName(ctx: Context, name: string) {
  var result = undefined
  var uuid_api = `https://api.mojang.com/users/profiles/minecraft/${name}`
  try {
    result = {}
    var resp_json = await ctx.http.get(uuid_api, {responseType: 'json'})
    result.id = resp_json.id
    result.name = resp_json.name
  } catch (err) {
    console.log('Uuid Not Found...')
    result = undefined
  }
  return result
}

async function getProfileB64ByUuid(ctx: Context, uuid: string) {
  var result = undefined
  var prof_api = `https://sessionserver.mojang.com/session/minecraft/profile/${uuid.replace(/-/g, '')}`
  try {
    var resp_json = await ctx.http.get(prof_api, {responseType: 'json'})
    resp_json.properties.forEach(property => {
      result = property.value
    })
  } catch (err) {
    console.log('Uuid Not Found...')
  }
  return result
}

function getSkinUrlByProfileB64(profileBase64: string) {
  var result = undefined
  try {
    var profile = JSON.parse(Buffer.from(profileBase64, 'base64').toString())
    result = profile.textures.SKIN.url
  } catch (err) {
    console.log('Skin Url Not Found...')
  }
  return result
}

function getBackgroundColors(value: string) {
  switch(value) {
    case '背景1': return COLOR_LIST[0]
    case '背景2': return COLOR_LIST[1]
    case '背景3': return COLOR_LIST[2]
    case '背景4': return COLOR_LIST[3]
    case '背景5': return COLOR_LIST[4]
    default: return COLOR_LIST[0]
  }
}

function getDirectionPos(value: number): [number, number, number, number] {
  switch(value % 8) {
    case 0: return [0, 0, 0, 300]
    case 1: return [300, 0, 0, 300]
    case 2: return [300, 0, 0, 0]
    case 3: return [300, 300, 0, 0]
    case 4: return [0, 300, 0, 0]
    case 5: return [0, 300, 300, 0]
    case 6: return [0, 0, 300, 0]
    case 7: return [0, 0, 300, 300]
  }
}

async function generatePfpPic(ctx: Context, wall: string | string[] | { startColor: string, endColor: string }, direction = 0, skin?: string) {
  // 减小画布尺寸
  var scale = 8 // 进一步减小尺寸
  var canvas = await ctx.canvas.createCanvas(20 * scale, 20 * scale)
  var ctx2d = canvas.getContext('2d')
  ctx2d.imageSmoothingEnabled = false

  // 绘制背景
  const gradient = ctx2d.createLinearGradient(...getDirectionPos(direction))
  const colors = typeof wall === 'string'
    ? getBackgroundColors(wall)
    : (Array.isArray(wall)
      ? wall
      : [(wall as { startColor: string, endColor: string }).startColor, (wall as { startColor: string, endColor: string }).endColor])
  gradient.addColorStop(0, colors[0])
  gradient.addColorStop(1, colors[1])
  ctx2d.fillStyle = gradient
  ctx2d.fillRect(0, 0, 160, 160) // 减小背景尺寸

  // 绘制阴影
  const shading = await ctx.canvas.loadImage(PSHADING_20X20)
  const back_drop = await ctx.canvas.loadImage(BACK_DROP_SHADING)
  ctx2d.drawImage(back_drop, 0, 0, 20 * scale, 20 * scale)

  if (!skin) {
    const failed = await ctx.canvas.loadImage(NOT_FOUND_PFP)
    ctx2d.drawImage(failed, 0, 0, 150, 150) // 减小默认图尺寸
    ctx2d.fillStyle = '#000000'
    ctx2d.fillRect(40, 150, 80, 160 - 150)
    ctx2d.drawImage(shading, 0, 0, 20 * scale, 20 * scale)
    // 返回Buffer而不是base64
    return canvas.toBuffer('image/png')
  }

  // 绘制皮肤
  ctx2d.drawImage(shading, 0, 0, 20 * scale, 20 * scale)
  // 返回Buffer而不是base64
  return canvas.toBuffer('image/png')
}
