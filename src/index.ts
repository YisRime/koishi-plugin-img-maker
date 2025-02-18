import { Context, Schema, segment } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { readFileSync } from 'fs'
import path from 'path'

declare class BALogo {
  constructor(options: { options: { fontSize: number, transparent: boolean, haloX: number, haloY: number }, config: { fontSize: number, transparent: boolean, haloX: number, haloY: number } });
  draw(params: { textL: string, textR: string }): Promise<void>;
}

export const name = 'img-maker'
export const inject = {required: ['puppeteer']}

export interface Config {
  xibao: StyleConfig
  beibao: StyleConfig
  balogo: {
    fontSize: number
    transparent: boolean
    haloX: number
    haloY: number
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
    fontFamily: Schema.string().default('"HarmonyOS Sans SC", "Source Han Sans CN", sans-serif'),
    maxFontSize: Schema.number().min(1).default(80),
    minFontSize: Schema.number().min(1).default(38),
    offsetWidth: Schema.number().min(1).default(900)
  }),
  beibao: Schema.object({
    fontFamily: Schema.string().default('"HarmonyOS Sans SC", "Source Han Sans CN", sans-serif'),
    maxFontSize: Schema.number().min(1).default(90),
    minFontSize: Schema.number().min(1).default(38),
    offsetWidth: Schema.number().min(1).default(900)
  }),
  balogo: Schema.object({
    fontSize: Schema.number().default(84),
    transparent: Schema.boolean().default(false),
    haloX: Schema.number().default(-18),
    haloY: Schema.number().default(0)
  })
})

export function apply(ctx: Context, config: Config) {
  ctx.command('make <content:text>')
      .option('xb', '-xb 生成喜报')
      .option('bb', '-bb 生成悲报')
      .option('balogo', '-balogo <right:text> 生成BA风格logo')
      .action(async ({ options, session }, content) => {
        if (!content) return session.send('请提供要生成的内容')

        try {
          if (options.xb) {
            const img = readFileSync(path.resolve(__dirname, './xibao.jpg'))
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
            return session.send(segment.image(image))
          } else if (options.bb) {
            const img = readFileSync(path.resolve(__dirname, './beibao.jpg'))
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
            return session.send(segment.image(image))
          } else if (options.balogo) {
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
            const image = await canvas.screenshot({ type: 'png', omitBackground: true })
            await page.close()
            return session.send(segment.image(`data:image/png;base64,${image.toString('base64')}`))
          }

          const image = await ctx.puppeteer.render(`
            <div style="padding: 20px; background: white;">
              <h1>${content}</h1>
            </div>
          `)
          return session.send(segment.image(image))
        } catch (error) {
          return session.send('图片生成失败：' + error.message)
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
