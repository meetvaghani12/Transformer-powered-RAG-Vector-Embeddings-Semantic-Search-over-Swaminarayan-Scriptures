"use client"

import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'
import { Sparkles } from 'lucide-react'

interface SuggestedQuestionsProps {
  onSelectQuestion: (question: string) => void
}

export function SuggestedQuestions({ onSelectQuestion }: SuggestedQuestionsProps) {
  const { t } = useLanguage()

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="px-4 sm:px-6 pb-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground text-sm font-medium">
          {t.suggestions.title}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {t.suggestions.questions.map((question, index) => (
          <motion.button
            key={index}
            variants={itemVariants}
            onClick={() => onSelectQuestion(question)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground bg-secondary border border-border hover:border-primary/30 hover:text-foreground transition-all duration-300"
          >
            {question}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
