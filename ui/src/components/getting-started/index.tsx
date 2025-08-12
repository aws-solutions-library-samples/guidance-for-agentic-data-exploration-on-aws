import React, { useState } from 'react';
import AppLayout from '@cloudscape-design/components/app-layout';
import { BreadcrumbGroup } from "@cloudscape-design/components";
import HelpPanel from '@cloudscape-design/components/help-panel';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import { ServiceNavigation } from '../side-navigation';
import { GettingStarted } from './content';

export function GettingStartedView() {
  const [toolsOpen, setToolsOpen] = useState(false);

  const breadcrumbItems = [
    { text: "Home", href: "/" },
    { text: "Getting Started", href: "/getting-started" }
  ];

  return (
    <AppLayout
      navigation={<ServiceNavigation />}
      breadcrumbs={false}
      content={<GettingStarted />}
      disableContentPaddings={true}
      toolsHide={true}
      tools={
        <HelpPanel 
          header={<Header variant="h2">Getting Started</Header>}
        >
          <HelpPanelContent />
        </HelpPanel>
      }
      toolsOpen={toolsOpen}
      onToolsChange={({ detail }) => setToolsOpen(detail.open)}
    />
  );
}

const HelpPanelContent = () => (
  <div>
    <Header variant="h2">About Panoptic</Header>
    <p>
    Panoptic is a GenAI powered accelerator that seamlessly unifies and analyzes diverse data streams without traditional ETL barriers and data integration.
    </p>
    <p> It connects internal enterprise data with external factors - from regulatory changes to weather patterns to social sentiment - delivering real-time, actionable insights.
    </p>
    <hr/>
    <h3>Key Features</h3>
    <ul>
      <li>Zero/Low ETL Integration</li>
      <li>Real-time Data Fusion</li>
      <li>Cross-industry Application</li>
      <li>Multi-persona Analytics</li>
      <li>Automated Pattern Recognition</li>
      <li>Synthetic Data Generation</li>   
    </ul>
    <hr/>
    <h4>Learn more</h4>
    <ul>
      <li>
        <Link href="#" external>Documentation</Link>
      </li>
    </ul>
  </div>
);

export default GettingStartedView;
