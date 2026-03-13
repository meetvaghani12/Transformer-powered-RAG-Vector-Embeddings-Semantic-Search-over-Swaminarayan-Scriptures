"use client"

import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'

export function Footer() {
  const { t } = useLanguage()

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="py-8 px-4 border-t border-border"
    >
      <div className="max-w-7xl mx-auto text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
            <span className="text-foreground font-serif text-xs font-semibold">VIE</span>
          </div>
        </div>
        <p className="text-muted-foreground text-sm font-medium">
          {t.footer.text}
        </p>
        <p className="text-muted-foreground/50 text-xs mt-2">
          © {new Date().getFullYear()} Vachanamrut Intelligence Engine
        </p>
      </div>
    </motion.footer>
  )
}
