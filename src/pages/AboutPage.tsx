import React from 'react'
import { Mail, Phone, ArrowRight, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { ButtonLink } from '../components/ui/Button'
import { AmbientVideoBg } from '../components/ui/AmbientVideoBg'

/**
 * Contact / About page.
 *
 * Layout rule per DESIGN.md: cards share the same dark surface;
 * brand colors (xiaohongshu pink, wechat green) appear only on logos
 * and the small "前往" link — NEVER as the card background or border.
 * Keeps the page calm and on-brand.
 */

const cardBase =
  'rounded-2xl p-6 flex items-center gap-5 bg-bg-elev-1 border border-white/[0.06] ' +
  'transition-[border-color] duration-base ease-standard hover:border-white/[0.12]'

const overline = 'text-overline text-fg-tertiary mb-1 uppercase'
const labelLg  = 'text-heading-md text-fg-primary'
const meta     = 'text-caption text-fg-tertiary mt-1'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg-base text-fg-primary pt-16">

      {/* Header — with subtle Kaffeehaus video behind the copy.
          Opacity 0.22 keeps the text fully legible. */}
      <div className="relative overflow-hidden px-4 sm:px-6 lg:px-10 pt-12 pb-10 border-b border-white/[0.06]">
        <AmbientVideoBg
          src={[
            '/about/kaffeehaus.mp4',
            '/about/street-twilight.mp4',
            '/contact/apartment-keys.mp4',
            '/contact/kitchen-dawn.mp4',
            '/contact/plant-window.mp4',
          ]}
          opacity={0.22}
          scanlines
          scanlineColor="black"
        />
        {/* Bottom-fade gradient so cards below transition smoothly */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(12,12,12,0.4) 0%, rgba(12,12,12,0.55) 60%, rgba(12,12,12,0.9) 100%)',
          }}
        />
        <div className="relative max-w-prose mx-auto">
          <p className="text-overline text-gold/80 mb-3 uppercase">Contact</p>
          <h1 className="font-serif text-display-lg sm:text-display-xl text-fg-primary mb-2 tracking-tight">
            联系我们
          </h1>
          <p className="text-body text-fg-secondary">
            维也纳房产、法拍、出租，任何疑问请直接联系。
          </p>
        </div>
      </div>

      <div className="max-w-prose mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-3">

        {/* 1. 小红书 */}
        <motion.a
          href="https://www.xiaohongshu.com"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardBase} group cursor-pointer`}
        >
          <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-bg-elev-2">
            <img src="/xiaohongshu-logo.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={overline}>小红书</p>
            <p className={labelLg}>奥匈置业研究所 | CH</p>
            <p className={meta}>搜索账号直接私信</p>
          </div>
          <span className="flex items-center gap-1 text-caption text-fg-tertiary group-hover:text-gold transition-colors duration-base ease-standard">
            前往 <ExternalLink size={11} strokeWidth={1.5} />
          </span>
        </motion.a>

        {/* 2. 微信 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={cardBase}
        >
          <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-bg-elev-2">
            <img src="/wechat-logo.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={overline}>微信</p>
            <p className={labelLg}>扫码添加</p>
            <p className={meta}>长按或扫描二维码</p>
          </div>
          <div className="flex-shrink-0 rounded-lg overflow-hidden bg-white p-1" style={{ width: 80, height: 80 }}>
            <img
              src="/wechat-qr.png"
              alt="微信二维码"
              className="w-full h-full object-contain"
              onError={(e) => {
                const el = e.currentTarget
                el.style.display = 'none'
                const p = el.parentElement!
                p.innerHTML =
                  '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#888;font-size:10px">QR</div>'
              }}
            />
          </div>
        </motion.div>

        {/* 3. 电话 */}
        <motion.a
          href="tel:+436705566666"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardBase} group cursor-pointer`}
        >
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#2F7BF6' }}>
            <Phone size={22} strokeWidth={1.5} color="#FFFFFF" fill="#FFFFFF" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={overline}>电话</p>
            <p className="text-heading-md text-fg-primary tabular group-hover:text-gold transition-colors duration-base ease-standard">
              +43 670 5566666
            </p>
            <p className={meta}>奥地利本地号码</p>
          </div>
        </motion.a>

        {/* 4. 邮件 */}
        <motion.a
          href="mailto:L.ZHANG@VALERTO.IMMO"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardBase} group cursor-pointer`}
        >
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FF9500' }}>
            <Mail size={24} strokeWidth={1.75} color="#FF9500" fill="#FFFFFF" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={overline}>邮件咨询</p>
            <p className="text-heading-md text-gold group-hover:text-gold-hover transition-colors duration-base ease-standard">
              L.ZHANG@VALERTO.IMMO
            </p>
            <p className={meta}>24 小时内回复</p>
          </div>
        </motion.a>

        {/* MONOLAW */}
        <motion.a
          href="https://www.monolaw.at/about-1"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardBase} group cursor-pointer`}
        >
          <div
            className="w-11 h-11 rounded-lg flex-shrink-0 flex items-center justify-center bg-bg-elev-2 border border-white/[0.06]"
          >
            <span className="text-fg-primary font-black text-[10px] tracking-widest leading-none text-center">
              MONO<br />LAW
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={overline}>法律支持</p>
            <p className={labelLg}>MONOLAW</p>
            <p className={meta}>奥地利本地律师事务所 · 房产法律咨询</p>
          </div>
          <span className="flex items-center gap-1 text-caption text-fg-tertiary group-hover:text-gold transition-colors duration-base ease-standard">
            前往 <ExternalLink size={11} strokeWidth={1.5} />
          </span>
        </motion.a>

        {/* Auction CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gold-tint border border-gold-line"
        >
          <div className="flex-1">
            <h3 className="text-heading-lg text-fg-primary mb-1">立即查看法拍房机会</h3>
            <p className="text-body text-fg-secondary">
              60+ 条在拍房源 · 起拍价低至评估价 50%
            </p>
          </div>
          <ButtonLink
            to="/auction"
            variant="primary"
            size="md"
            trailingIcon={<ArrowRight size={13} strokeWidth={1.75} />}
          >
            进入看板
          </ButtonLink>
        </motion.div>

      </div>
    </div>
  )
}
