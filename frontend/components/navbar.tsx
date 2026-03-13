"use client"

import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'
import { Button } from '@/components/ui/button'

const languages = [
  { code: 'en' as const, label: 'English' },
  { code: 'gu' as const, label: 'ગુજરાતી' },
  { code: 'hi' as const, label: 'हिंदी' },
]

export function Navbar() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 glass"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-primary font-serif text-lg sm:text-xl font-semibold">
                {t.nav.subtitle}
              </span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-foreground font-serif text-lg font-medium tracking-wide">
                {t.nav.title}
              </h1>
            </div>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center gap-1 sm:gap-2 p-1 rounded-lg bg-secondary/50 border border-border">
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant="ghost"
                size="sm"
                onClick={() => setLanguage(lang.code)}
                className={`
                  rounded-md px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-all duration-300
                  ${language === lang.code 
                    ? 'bg-primary text-background' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }
                `}
              >
                {lang.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </motion.nav>
  )
}
