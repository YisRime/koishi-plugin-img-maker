import { Context, Schema, h } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import {} from '@koishijs/canvas'  // 添加canvas导入
import { readFileSync, existsSync } from 'fs'
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
  // 添加日志记录
  const logger = ctx.logger('img-maker')

  // 检查必要的资源文件
  try {
    const requiredFiles = [
      path.resolve(__dirname, './assets/images/xibao.jpg'),
      path.resolve(__dirname, './assets/images/beibao.jpg'),
      path.resolve(__dirname, '../public/xbbb.html'),
      path.resolve(__dirname, '../public/balogo.html')
    ]

    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        throw new Error(`缺少必要的资源文件: ${file}`)
      }
    }
  } catch (error) {
    logger.error(`资源文件检查失败: ${error.message}`)
    return
  }

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
          let image: Buffer

          if (options.xb || options.bb) {
            const template = options.xb ? 'xibao' : 'beibao'
            const cfg = options.xb ? config.xibao : config.beibao

            // 添加错误处理和日志
            const imagePath = path.resolve(__dirname, `./assets/images/${template}.jpg`)
            const htmlPath = path.resolve(__dirname, '../public/xbbb.html')

            if (!existsSync(imagePath)) {
              throw new Error(`背景图片不存在: ${imagePath}`)
            }
            if (!existsSync(htmlPath)) {
              throw new Error(`HTML模板不存在: ${htmlPath}`)
            }

            const img = readFileSync(imagePath)

            const html = generateHTML({
              text: content,
              fontFamily: cfg.fontFamily,
              fontColor: options.xb ? '#ff0a0a' : '#000500',
              strokeColor: options.xb ? '#ffde00' : '#c6c6c6',
              maxFontSize: cfg.maxFontSize,
              minFontSize: cfg.minFontSize,
              offsetWidth: cfg.offsetWidth,
              img
            })

            // 使用data URI直接加载HTML
            const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
            const result = await takeScreenshot(ctx, dataUri, {
              selector: '.container',
              timeout: 10000,
              maxHeight: 4000
            })

            image = result.image

          } else if (options.balogo) {
            if (!content) return '请提供要生成的内容'

            const result = await takeScreenshot(ctx, `file://${path.resolve(__dirname, '../public/balogo.html')}`, {
              selector: '#output',
              timeout: 10000,
              beforeScreenshot: async (page) => {
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
              }
            })

            image = result.image

          } else if (options.mcpfp) {
            if(!config.mcpfp.enablePfp) return '该指令未启用'
            const player = content || config.mcpfp.initName
            const uuidName = await getUuidNameByName(ctx, player)
            if(!uuidName) return '未找到该玩家'

            const profB64 = await getProfileB64ByUuid(ctx, uuidName.id)
            if(!profB64) return '获取玩家资料失败'

            const skinUrl = getSkinUrlByProfileB64(profB64)
            image = await generatePfpPic(
              ctx,
              config.mcpfp.wallColors,
              config.mcpfp.gradientDirection,
              skinUrl
            )
          } else {
            if (!content) return '请提供要生成的内容'

            const result = await takeScreenshot(ctx, `
              <div style="padding: 20px; background: white;">
                <h1>${escapeHTML(content)}</h1>
              </div>
            `, {
              selector: 'div',
              timeout: 5000
            })

            image = result.image
          }

          if (!image || image.length === 0) {
            throw new Error('生成的图片为空')
          }

          return h.image(image, 'image/png')

        } catch (error) {
          logger.error(`图片生成错误: ${error.message}`)
          return '图片生成失败：' + error.message
        }
      })
}

// 添加截图配置接口
interface ScreenshotOptions {
  selector?: string
  timeout?: number
  maxHeight?: number
  beforeScreenshot?: (page: any) => Promise<void>
}

// 添加通用截图函数
async function takeScreenshot(ctx: Context, url: string, options: ScreenshotOptions = {}) {
  const {
    selector = 'body',
    timeout = 30000,
    maxHeight = 4000,
    beforeScreenshot
  } = options

  const browserContext = await ctx.puppeteer.browser.createBrowserContext()
  const page = await browserContext.newPage()

  try {
    // 设置页面加载超时
    await page.setDefaultNavigationTimeout(timeout)

    // 如果是文件URL，使用文件协议加载
    if (url.startsWith('file://')) {
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout
      })
    } else {
      // 否则设置页面HTML内容
      await page.setContent(url, {
        waitUntil: 'networkidle0',
        timeout
      })
    }

    // 等待选择器出现
    await page.waitForSelector(selector, { timeout })

    // 执行截图前的自定义处理
    if (beforeScreenshot) {
      await beforeScreenshot(page)
    }

    // 获取目标元素
    const element = await page.$(selector)
    if (!element) {
      throw new Error(`未找到元素: ${selector}`)
    }

    // 获取元素尺寸
    const box = await element.boundingBox()
    if (!box) {
      throw new Error('无法获取元素尺寸')
    }

    // 限制截图高度
    const height = Math.min(box.height, maxHeight)

    // 截取图片
    const image = await element.screenshot({
      type: 'png',
      clip: {
        x: box.x,
        y: box.y,
        width: box.width,
        height
      }
    })

    return {
      image,
      truncated: box.height > maxHeight
    }

  } finally {
    await page.close()
    await browserContext.close()
  }
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

  // 内联HTML模板，避免文件加载问题
  const template = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        .container {
          position: relative;
          display: inline-block;
        }
        .text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${params.offsetWidth}px;
          font-family: ${params.fontFamily};
          color: ${params.fontColor};
          text-align: center;
          -webkit-text-stroke: 3px ${params.strokeColor};
          font-size: ${params.maxFontSize}px;
          white-space: pre-wrap;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="data:image/jpeg;base64,${params.img.toString('base64')}" />
        <div class="text">${text}</div>
      </div>
      <script>
        const text = document.querySelector('.text');
        while (text.scrollHeight > text.parentElement.clientHeight && text.style.fontSize.replace('px', '') > ${params.minFontSize}) {
          text.style.fontSize = (parseInt(text.style.fontSize) - 1) + 'px';
        }
      </script>
    </body>
    </html>
  `

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
