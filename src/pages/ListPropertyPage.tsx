import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, Check, ShieldCheck, TrendingUp, Languages,
  Camera, FileText, Users, Sparkles, ArrowLeft,
} from 'lucide-react'
import { AmbientVideoBg } from '../components/ui/AmbientVideoBg'

const SERVICES = [
  { icon: <TrendingUp size={17} />, title: '市场评估与定价', desc: '基于维也纳各区实时成交数据，给出合理估价区间与定价策略。' },
  { icon: <Camera size={17} />, title: '专业房源包装', desc: '专业摄影、户型图、视频呈现，让您的房产在第一眼吸引买家/租客。' },
  { icon: <Languages size={17} />, title: '双向客源', desc: '中文圈层（小红书 / 微信）+ 维也纳本地市场（justimmo / willhaben）双向推广，覆盖华人买家与本地客户。' },
  { icon: <Users size={17} />, title: '看房与谈判', desc: '我们安排预约、陪同看房、协助价格谈判，您只需等待签约。' },
  { icon: <FileText size={17} />, title: '中德文合同支持', desc: '与本地律所合作（MONOLAW），中文解读合同、保障交易安全。' },
  { icon: <ShieldCheck size={17} />, title: '后续过户与税务', desc: '协助完成产权过户、土地登记、土地交易税申报等流程。' },
]

export default function ListPropertyPage() {
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'rent' ? 'rent' : 'sale'
  const [mode, setMode] = useState<'sale' | 'rent'>(initialMode)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    setMode(searchParams.get('mode') === 'rent' ? 'rent' : 'sale')
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrMsg(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      name:    fd.get('name')        || '',
      contact: fd.get('contact')     || '',
      email:   fd.get('email')       || '',
      message: fd.get('description') || '',
      address: fd.get('address')     || '',
      source:  mode === 'sale' ? '业主委托·出售' : '业主委托·出租',
      _honeypot: fd.get('website')   || '',
    }
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) setSent(true)
      else setErrMsg(data.error || '提交失败，请稍后重试')
    } catch (err) {
      console.error(err)
      setErrMsg('网络错误，请稍后重试')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-base text-fg-primary pt-16">

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-10 pt-14 pb-12 border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <Link to="/"
            className="inline-flex items-center gap-1.5 text-caption text-fg-tertiary hover:text-gold transition-colors duration-base ease-standard mb-8">
            <ArrowLeft size={12} strokeWidth={1.5} /> 返回首页
          </Link>
          <p className="text-overline text-gold/80 mb-3 uppercase">For Property Owners</p>
          <h1 className="font-serif text-display-lg sm:text-display-xl lg:text-display-2xl text-fg-primary mb-5 tracking-tight">
            业主委托 · <span className="text-gold">出售 / 出租</span>
          </h1>
          <p className="text-body-lg text-fg-secondary max-w-prose">
            维也纳或奥地利房产，从市场评估到交易完成的一站式服务 — 同时面向华人客户与本地市场。
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-content mx-auto">
          <div className="mb-12">
            <p className="text-overline text-gold/80 mb-3 uppercase">Services</p>
            <h2 className="font-serif text-display-lg text-fg-primary">
              我们能为您做什么
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl p-6 bg-bg-elev-1 border border-white/[0.06] transition-[border-color] duration-base ease-standard hover:border-white/[0.12]"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-gold-tint border border-gold-line">
                  <span className="text-gold">{s.icon}</span>
                </div>
                <h3 className="text-heading-md text-fg-primary mb-1.5">{s.title}</h3>
                <p className="text-body text-fg-secondary">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="form" className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-10 bg-bg-elev-1 border-t border-white/[0.06]">
        {/* Ambient sunlit-apartment video behind the form — same treatment as homepage contact section. */}
        <AmbientVideoBg
          src={[
            '/contact/lucky-cat-gold.mp4',
            '/about/stadtpark-autumn.mp4',
          ]}
          opacity={0.42}
          scanlines
          scanlineColor="black"
          videoStyles={[
            { transform: 'translateX(12%)' },
            {},
          ]}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(19,19,19,0.2) 0%, rgba(19,19,19,0.32) 50%, rgba(12,12,12,0.68) 100%)',
          }}
        />
        <div className="relative max-w-prose mx-auto">
          <div className="mb-10">
            <p className="text-overline text-gold/80 mb-3 uppercase">Free Consultation</p>
            <h2 className="font-serif text-display-lg text-fg-primary mb-3">
              提交委托信息
            </h2>
            <p className="text-body text-fg-secondary">填写下方表单，我们将在 24 小时内与您联系。</p>
          </div>

          <div className="rounded-2xl p-7 sm:p-8 bg-bg-base border border-white/[0.06]">
            {sent ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-gold-tint border border-gold-line">
                  <Check size={24} strokeWidth={1.75} className="text-gold" />
                </div>
                <h3 className="text-heading-lg text-fg-primary mb-2">提交成功</h3>
                <p className="text-body text-fg-secondary">我们会尽快与您联系。</p>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* honeypot for bots */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off"
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

                {/* Sale / Rent toggle */}
                <div>
                  <label className="block text-overline text-fg-tertiary mb-2 uppercase">需求类型</label>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-bg-elev-2 border border-white/[0.06]">
                    {([['sale', '出售房产'], ['rent', '出租房产']] as const).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setMode(k)}
                        className={[
                          'py-2.5 rounded-md text-body font-semibold',
                          'transition-[background,color] duration-base ease-standard',
                          'active:scale-[0.98]',
                          mode === k
                            ? 'bg-gold text-bg-base'
                            : 'bg-transparent text-fg-secondary hover:text-fg-primary',
                        ].join(' ')}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="mode" value={mode === 'sale' ? '出售' : '出租'} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="姓名" name="name" type="text" placeholder="您的姓名" required />
                  <Field label="电话 / 微信" name="contact" type="tel" placeholder="电话或微信号" required />
                </div>
                <Field label="邮箱" name="email" type="email" placeholder="your@email.com" required />
                <Field label="房产地址或所在区域" name="address" type="text" placeholder="如：1190 Wien, Döbling 或具体街道地址" required />

                <div>
                  <label className="block text-overline text-fg-tertiary mb-2 uppercase">房产简介</label>
                  <textarea name="description" rows={5} required
                    placeholder={`例如：3 室公寓，95 m²，2020 年装修，带阳台${mode === 'rent' ? '；期望月租金 €1,500' : '；期望售价 €550,000'}`}
                    className="w-full rounded-md px-4 py-3 text-body text-fg-primary placeholder:text-fg-disabled bg-bg-elev-2 border border-white/[0.08] outline-none resize-none transition-[border-color] duration-base ease-standard focus:border-gold-line"
                  />
                </div>

                {errMsg && (
                  <div className="text-caption text-danger px-4 py-2.5 rounded-md border border-danger/30" style={{ background: 'rgba(248,113,113,0.08)' }}>
                    {errMsg}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className={[
                    'w-full py-3.5 rounded-lg text-body-lg font-semibold',
                    'flex items-center justify-center gap-2',
                    'transition-[background,opacity,transform] duration-base ease-standard',
                    'active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
                    loading
                      ? 'bg-gold/40 text-bg-base cursor-not-allowed active:scale-100'
                      : 'bg-gold text-bg-base hover:bg-gold-hover',
                  ].join(' ')}>
                  {loading ? '提交中…' : <>提交委托 <ArrowRight size={16} strokeWidth={1.75} /></>}
                </button>

                <p className="text-center text-caption text-fg-tertiary pt-1">
                  您的信息将被严格保密，仅用于本次咨询。
                </p>
              </form>
            )}
          </div>

          {/* Alt contact */}
          <div className="mt-6 text-center text-caption text-fg-tertiary">
            或通过{' '}
            <Link to="/about" className="text-gold hover:underline underline-offset-4">
              微信 / 电话 / 邮件
            </Link>
            {' '}直接联系。
          </div>
        </div>
      </section>
    </div>
  )
}

function Field({ label, name, type, placeholder, required }: {
  label: string; name: string; type: string; placeholder: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-overline text-fg-tertiary mb-2 uppercase">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md px-4 py-3 text-body text-fg-primary placeholder:text-fg-disabled bg-bg-elev-2 border border-white/[0.08] outline-none transition-[border-color] duration-base ease-standard focus:border-gold-line"
      />
    </div>
  )
}
