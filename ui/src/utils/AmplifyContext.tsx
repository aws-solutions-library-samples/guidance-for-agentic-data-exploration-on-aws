import { createContext, useState, useEffect, useContext, ReactNode } from 'react'
import { configureAmplify, ExtendedResourcesConfig } from './amplifyConfig';

const AmplifyConfigContext = createContext<ExtendedResourcesConfig | null>(null);

export function AmplifyConfigProvider({children}: {children:ReactNode}) {
    const [config, setConfig] = useState<ExtendedResourcesConfig|null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean>(false)
    useEffect(() => {
        (async () => {
            setIsInitialized(false);
            try {
                const response = await configureAmplify();
                setConfig(response);
            }
            finally {
                setIsInitialized(true)
            }
        })();
    }, [])

    return (
        <AmplifyConfigContext.Provider value={config}>
            {isInitialized ? children : <div>loading</div>}
        </AmplifyConfigContext.Provider>
    )
}

export function useAmplifyContext(): ExtendedResourcesConfig {
    const context = useContext(AmplifyConfigContext);
    if (!context) {
        throw new Error('useAmplifyContext must be used within an AmplifyConfigProvider');
    }
    return context;
}