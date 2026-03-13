"use client"

import { createContext, useContext, useState, ReactNode } from 'react'

type Language = 'en' | 'gu' | 'hi'

interface Translations {
  nav: {
    title: string
    subtitle: string
  }
  hero: {
    title: string
    subtitle: string
    description: string
    startChat: string
  }
  chat: {
    placeholder: string
    send: string
    typing: string
    source: string
    sourceTitle: string
  }
  suggestions: {
    title: string
    questions: string[]
  }
  footer: {
    text: string
    disclaimer: string
  }
}

const translations: Record<Language, Translations> = {
  en: {
    nav: {
      title: "AksharAI",
      subtitle: "Transformer-powered RAG · Vector Embeddings · Semantic Search over Swaminarayan Scriptures",
    },
    hero: {
      title: "Ask Life Questions.",
      subtitle: "Receive Wisdom from Vachanamrut.",
      description: "Experience divine guidance through authentic scriptures. Our AI draws from Vachanamrut and Swamini Vato to provide timeless spiritual wisdom for modern life.",
      startChat: "Begin Your Journey",
    },
    chat: {
      placeholder: "Ask a question about life, spirituality, or inner peace...",
      send: "Send",
      typing: "Contemplating wisdom",
      source: "View Scriptural Source",
      sourceTitle: "Scriptural Source",
    },
    suggestions: {
      title: "Seek Wisdom On",
      questions: [
        "How to control anger?",
        "How to find peace in life?",
        "What does Vachanamrut say about ego?",
        "How to remain calm during problems?",
        "How to live a spiritual life?",
      ],
    },
    footer: {
      text: "Wisdom from Vachanamrut and Swamini Vato",
      disclaimer: "AI-generated responses based on Vachanamrut and Swamini Vato scriptures",
    },
  },
  gu: {
    nav: {
      title: "વચનામૃત ઇન્ટેલિજન્સ એન્જિન",
      subtitle: "VIE",
    },
    hero: {
      title: "જીવન વિશે પ્રશ્નો પૂછો.",
      subtitle: "વચનામૃતમાંથી જ્ઞાન મેળવો.",
      description: "પ્રામાણિક શાસ્ત્રો દ્વારા દૈવી માર્ગદર્શન અનુભવો. અમારું AI વચનામૃત અને સ્વામીની વાટોમાંથી આધુનિક જીવન માટે કાલાતીત આધ્યાત્મિક જ્ઞાન પ્રદાન કરે છે.",
      startChat: "તમારી યાત્રા શરૂ કરો",
    },
    chat: {
      placeholder: "જીવન, આધ્યાત્મિકતા અથવા આંતરિક શાંતિ વિશે પ્રશ્ન પૂછો...",
      send: "મોકલો",
      typing: "જ્ઞાન વિચારી રહ્યું છે",
      source: "શાસ્ત્રીય સ્ત્રોત જુઓ",
      sourceTitle: "શાસ્ત્રીય સ્ત્રોત",
    },
    suggestions: {
      title: "જ્ઞાન મેળવો",
      questions: [
        "ગુસ્સો કેવી રીતે કાબૂમાં રાખવો?",
        "જીવનમાં શાંતિ કેવી રીતે મેળવવી?",
        "વચનામૃત અહંકાર વિશે શું કહે છે?",
        "મુશ્કેલીઓમાં શાંત કેવી રીતે રહેવું?",
        "આધ્યાત્મિક જીવન કેવી રીતે જીવવું?",
      ],
    },
    footer: {
      text: "વચનામૃત અને સ્વામીની વાટોમાંથી જ્ઞાન",
      disclaimer: "વચનામૃત અને સ્વામીની વાટો શાસ્ત્રો પર આધારિત AI-જનરેટેડ જવાબો",
    },
  },
  hi: {
    nav: {
      title: "वचनामृत इंटेलिजेंस इंजन",
      subtitle: "VIE",
    },
    hero: {
      title: "जीवन के प्रश्न पूछें।",
      subtitle: "वचनामृत से ज्ञान प्राप्त करें।",
      description: "प्रामाणिक शास्त्रों के माध्यम से दिव्य मार्गदर्शन का अनुभव करें। हमारा AI वचनामृत और स्वामीनी वाटो से आधुनिक जीवन के लिए कालातीत आध्यात्मिक ज्ञान प्रदान करता है।",
      startChat: "अपनी यात्रा शुरू करें",
    },
    chat: {
      placeholder: "जीवन, आध्यात्मिकता या आंतरिक शांति के बारे में प्रश्न पूछें...",
      send: "भेजें",
      typing: "ज्ञान पर विचार कर रहा है",
      source: "शास्त्रीय स्रोत देखें",
      sourceTitle: "शास्त्रीय स्रोत",
    },
    suggestions: {
      title: "ज्ञान प्राप्त करें",
      questions: [
        "क्रोध पर नियंत्रण कैसे करें?",
        "जीवन में शांति कैसे पाएं?",
        "वचनामृत अहंकार के बारे में क्या कहता है?",
        "समस्याओं में शांत कैसे रहें?",
        "आध्यात्मिक जीवन कैसे जिएं?",
      ],
    },
    footer: {
      text: "वचनामृत और स्वामीनी वाटो से ज्ञान",
      disclaimer: "वचनामृत और स्वामीनी वाटो शास्त्रों पर आधारित AI-जनरेटेड प्रतिक्रियाएं",
    },
  },
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
