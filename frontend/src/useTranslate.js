import { useLanguage } from './LanguageContext'

export default function useTranslate() {
  const { language } = useLanguage()

  return (translations) => {
    // Fallback logic: return selected language, or English, or ??? if missing
    return translations[language] || translations.en || '???'
  }
}
