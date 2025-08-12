import { useEffect, useState } from 'react';
import { Route, Routes, HashRouter } from 'react-router-dom';
import { I18nProvider, I18nProviderProps, importMessages } from '@cloudscape-design/components/i18n';
import { GettingStartedView } from './getting-started';
import { GraphSchemaEditor } from './schema-editor';
import { HeaderNavigation } from './top-navigation';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AmplifyConfigProvider } from '../utils/AmplifyContext';
import { Authenticator, Theme, ThemeProvider } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css';
import DataClassificationScreen from './data-classifier';
import DataLoaderScreen from './data-loader';
import DataAnalyzerScreen from './data-analyzer';
import { DataExplorerBouncer, DataExplorerV2 } from './data-explorer-v2';
import SchemaTranslatorScreen from './schema-translator';
import UserProfileView from './user-profile';

const logo = "/images/panoptic-b.png";

// Custom theme
const theme: Theme = {
  name: 'custom-theme',
  tokens: {
    components: {
      authenticator: {
        router: {
          borderWidth: '1px',
          borderStyle: 'solid',
          backgroundColor: '{colors.white}',
        },
      },
    },
  },
};

// Custom components configuration
const components = {
  Header() {
    return (
      <div style={{ 
        padding: '10px 0',
        textAlign: 'center'
      }}>
        <img alt="Panoptic logo" src={logo}
          style={{ width: '300px', paddingTop: '100px', paddingBottom: '20px' }}
        />
      </div>
    );
  },
  Footer() {
    return (
      <div style={{ 
        textAlign: 'center',
        padding: '40px 0',
        fontSize: '10px'
      }}>
        © {new Date().getFullYear()} Amazon Web Services
      </div>
    );
  },
};

// Custom form fields configuration
const formFields = {
  signIn: {
    username: {
      placeholder: 'Enter your email',
      label: 'Email',
    },
    password: {
      placeholder: 'Enter your password',
      label: 'Password',
    },
  },
};

function useDynamicFavicon() {
  useEffect(() => {
    // Find the favicon link element
    // Function to update favicon based on page visibility
    function updateFavicon() {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    
      // If no favicon is found, create one
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      
      if (favicon) {
        favicon.href = `/favicon${document.hidden ? '-inactive' : ''}.ico`;
      }
    }
    
    // Set initial favicon
    updateFavicon();
    
    // Add event listener for visibility change
    document.addEventListener("visibilitychange", updateFavicon);
    
    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener("visibilitychange", updateFavicon);
    };
  }, []);
}

//https://stackoverflow.com/questions/673905/how-can-i-determine-a-users-locale-within-the-browser
function determineLocale(): string {
  const intl = window.Intl;
  if (intl !== undefined) {
      return intl.NumberFormat().resolvedOptions().locale;
  }
  const languages = navigator.languages as (string[] | undefined);
  if (languages !== undefined && languages.length > 0) {
      return languages[0];
  }
  return navigator.language ?? "en-US";
}

const locale = determineLocale();

function App() {
  const [messages,setMessages] = useState<readonly I18nProviderProps.Messages[]>([]);

  useEffect(() => {
    importMessages(locale).then((messages) => setMessages(messages))
  }, [locale]);

  useDynamicFavicon();

    return (
      <AmplifyConfigProvider>
      <I18nProvider locale={locale} messages={messages}>
      <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
      <Authenticator 
        hideSignUp={true}
        components={components}
        formFields={formFields}
        >
        {({ user, signOut }) => (
          <>
          <HeaderNavigation user={user} signOut={signOut}/>
          <HashRouter>
            <Routes>
              <Route path="/" element={<GettingStartedView />} />
              <Route path="/data-explorer">
                <Route index element={<DataExplorerBouncer />} />
                <Route path=":sessionId" element={<DataExplorerV2 />} />
              </Route>
              <Route path="/schema-editor" element={<GraphSchemaEditor/>}/>
              <Route path="/data-analyzer">
                <Route index element={<DataAnalyzerScreen/>}/>
                <Route path=":id" element={<DataAnalyzerScreen/>}/>
              </Route> 
              <Route path="/schema-translator">
                <Route index element={<SchemaTranslatorScreen/>}/>
                <Route path=":id" element={<SchemaTranslatorScreen/>}/>
              </Route> 
              <Route path="/data-classifier">
                <Route index element={<DataClassificationScreen/>}/>
                <Route path=":id" element={<DataClassificationScreen/>}/>
              </Route>
              <Route path="/data-loader">
                <Route index element={<DataLoaderScreen/>}/>
                <Route path=":id" element={<DataLoaderScreen/>}/>
              </Route> 
              <Route path="/profile" element={<UserProfileView />} />
            </Routes>
          </HashRouter>
          </>
        )}
      </Authenticator>
      <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      </ThemeProvider>
      </I18nProvider>
      </AmplifyConfigProvider>
    );
  }
  export default App;

