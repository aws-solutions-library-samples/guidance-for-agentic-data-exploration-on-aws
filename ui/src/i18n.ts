import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(Backend)
  .init({
    load: 'languageOnly',
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'test', // client browser logging
    // debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
