import { createRoot } from 'react-dom/client';
import App from './components/App';
import '@cloudscape-design/global-styles/index.css';
import './i18n';

async function enableMocking() {
    if (process.env.NODE_ENV !== 'development' ||
        import.meta.env.VITE_USE_MOCKS !== 'true'
    ) {
      return
    }
    const { worker } = await import('../mocks/browser')
    return worker.start()
  }
  
enableMocking()
    .then(()=>createRoot(document.getElementById('root')!).render(<App />))
    .catch((e)=>console.error(e));