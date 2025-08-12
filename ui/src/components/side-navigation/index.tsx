import React, { useState } from 'react';
import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import BreadcrumbGroup, { BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from "@cloudscape-design/components/icon";
import { useTranslation, Translation, Trans} from 'react-i18next'
import { DocumentationModal } from '../documentation-modal';

export function Breadcrumbs({ items }: { items: BreadcrumbGroupProps.Item[] }) {
  return (
    <Translation>
      {
        (t) => <BreadcrumbGroup items={[
          { text: t('navigation.home'), href: '#/' }, 
          ...items]
        } />
      }
    </Translation>
  );
}

// ServiceNavigation is the Side Navigation component that is used in BasicLayout, CreateForm, ServiceHomepage, and Table flows.
// Implement like this: <ServiceNavigation />
export function ServiceNavigation() {
  // If the provided link is empty, do not redirect pages
  const { t }=useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const genAIicon =  <Icon name="gen-ai"  />
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);

  const items: SideNavigationProps.Item[] = [
    { type: 'link', text: t('navigation.dataExplorer'), href: '#/data-explorer', info: genAIicon},
    {type: 'divider'},
    {
      type: 'section',
      text: t('navigation.dataIngestion'),
      defaultExpanded: true,
      items: [
        { type: 'link', text: t('navigation.dataAnalyzer'), href: '#/data-analyzer'},
        { type: 'link', text: t('navigation.schemaTranslator'), href: '#/schema-translator'},
        { type: 'link', text: t('navigation.graphSchemaEditor'), href: '#/schema-editor' },
        { type: 'link', text: t('navigation.dataClassifier'), href: '#/data-classifier'},
        { type: 'link', text: t('navigation.dataLoader'), href: '#/data-loader'},
      ]
    },
    { type: "divider" },
    { 
      type: 'link', 
      text: t('navigation.documentation'), 
      href: '#documentation', 
      'external': true
    }
  ];  

  const onFollowHandler = (event: CustomEvent<SideNavigationProps.FollowDetail>) => {
    event.preventDefault();
    if (event.detail.href === '#documentation') {
      setIsDocModalVisible(true);
    } else if (event.detail.href) {
      navigate(event.detail.href.substring(1));
    }
  };

  return (
    <>
      <SideNavigation 
        data-testid="side-navigation" 
        header={{ text: t('navigation.home'), href: '#/' }} 
        items={items} 
        activeHref={`#${location.pathname}`} 
        onFollow={onFollowHandler} 
      />
      <DocumentationModal 
        visible={isDocModalVisible} 
        onDismiss={() => setIsDocModalVisible(false)} 
      />
    </>
  );
}

