import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Header from '@cloudscape-design/components/header';
import AppLayout from '@cloudscape-design/components/app-layout';
import Flashbar, { FlashbarProps } from '@cloudscape-design/components/flashbar';
import PropertyFilter from '@cloudscape-design/components/property-filter';
import HelpPanel from '@cloudscape-design/components/help-panel';
import { Breadcrumbs } from '../side-navigation';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { useState, useEffect } from 'react';
import { ServiceNavigation } from '../side-navigation';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import { Link } from '@cloudscape-design/components';
import { SchemaTranslatorItem } from './types';
import { SchemaTranslatorDetailComponent } from './detail';
import { useNavigate } from 'react-router-dom';
import { useScreenQuery } from '../../hooks/screen-query';
import Pagination from '@cloudscape-design/components/pagination';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import RadioGroup from '@cloudscape-design/components/radio-group';
import Icon from '@cloudscape-design/components/icon';

function EmptyState({title, subtitle}:{ title:string, subtitle:string }) {
  return (
    <Box textAlign="center" color="inherit">
      <Box variant="strong" textAlign="center" color="inherit">
        {title}
      </Box>
      <Box variant="p" padding={{ bottom: 's' }} color="inherit">
        {subtitle}
      </Box>
    </Box>
  );
}

// Pagination preferences type
interface PaginationPreferences {
  pageSize: number;
}

const fallbackRender = ({error, resetErrorBoundary}:FallbackProps) => { 
  console.error('error in Schema Translator', error);   
  return (
    <Alert data-testid="alert" 
      type="error"
      header="Something went wrong"
      action={<Button onClick={resetErrorBoundary}>Reset</Button>}>
        {error.message}
    </Alert>
  );
}

export function SchemaTranslatorTable(props:{ items: SchemaTranslatorItem[], loading: boolean, onRefresh?: () => void }) {
  const navigate = useNavigate();
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [preferences, setPreferences] = useState<PaginationPreferences>({
    pageSize: 20
  });
  
  const handleRefresh = () => {
    if (props.onRefresh) {
      props.onRefresh();
      setLastRefreshTime(new Date());
    }
  };

  // Reset to first page when items change
  useEffect(() => {
    setCurrentPageIndex(1);
  }, [props.items]);
  const columnDefinitions = [
    {
      id: 'timestamp',
      header: 'Processed',
      cell: (item: SchemaTranslatorItem) => {
        const date = new Date(item.timestamp);
        return date.toLocaleString('en-US');
      },
      sortingField: 'timestamp',
      minWidth: 200,
      width: 220,
    },
    {
      id: 'id',
      header: 'Batch ID',
      cell: (item: SchemaTranslatorItem) => <Link><div onClick={()=>navigate(item.id)}>{item.id}</div></Link>,
      sortingField: 'startTime',
      minWidth: 360,
    },
    {
      id: 'results',
      header: 'Relationships',
      cell: (item: SchemaTranslatorItem) => {
        const numLines = (item.results || '').split('\n').length;
        return numLines;
      },
      minWidth: 140,
      width: 160,
    },
  ];  

  const { items: collectionItems, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } = 
    useCollection(props.items, {
      filtering: {
        empty: 'No schema translator items match the filters',
        noMatch: 'No matches found',
      },
      selection: {},
      sorting: { defaultState: { sortingColumn: columnDefinitions[0], isDescending: true } },
      pagination: { pageSize: preferences.pageSize },
      propertyFiltering: {
        filteringProperties: [
          {
            key: 'id',
            operators: [':', '!:', '=', '!='],
            propertyLabel: 'Batch ID',
            groupValuesLabel: 'Batch ID values',
          },
        ],
      },
    });

  return (
    <>
      <Table
        trackBy={collectionProps.trackBy}
        selectedItems={collectionProps.selectedItems}
        sortingColumn={collectionProps.sortingColumn}
        sortingDescending={collectionProps.sortingDescending}
        onSortingChange={collectionProps.onSortingChange}
        onSelectionChange={collectionProps.onSelectionChange}
        columnDefinitions={columnDefinitions}
        items={collectionItems}
        empty={<EmptyState title="No items found" subtitle="No schema translator items match the criteria" />}
        loading={props.loading}
        stripedRows
        header={
          <Header
            counter={`(${filteredItemsCount})`}
            variant="awsui-h1-sticky"
            actions={
              <Box float="right">
                {lastRefreshTime && (
                  <Box color="text-status-inactive" float="left" padding={{ right: 'xs' }} fontSize="body-s" textAlign="right">
                    Last refreshed:<br/>{lastRefreshTime.toLocaleString()}
                  </Box>
                )}
                <Button
                    iconName="refresh"
                    onClick={handleRefresh}
                    loading={props.loading}
                    ariaLabel="Refresh data"
                  />
              </Box>
            }
          >
            Schema Translator History
          </Header>
        }
        filter={<PropertyFilter data-type="property-filter" {...propertyFilterProps} />}
        pagination={
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <Pagination 
              {...paginationProps}
              ariaLabels={{
                nextPageLabel: 'Next page',
                previousPageLabel: 'Previous page',
                pageLabel: pageNumber => `Page ${pageNumber} of all pages`
              }}
            />
            <Box color="text-body-secondary" padding={{left: 'xs', right: 'xs'}} display="inline-block">|</Box>
            <div 
              style={{
                color: 'var(--color-text-body-secondary)', 
                display: 'inline-block', 
                paddingTop: '6px',
                cursor: 'pointer'
              }}
              onClick={() => setPreferencesVisible(true)}
              aria-label="Preferences"
            >
              <Icon
                name="settings"
                size="small"
                variant="normal"
               
              />
            </div>
          </SpaceBetween>
        }
        stickyHeader
        enableKeyboardNavigation
        resizableColumns
        variant="full-page"
        wrapLines
      />

      <Modal
        visible={preferencesVisible}
        onDismiss={() => setPreferencesVisible(false)}
        header="Preferences"
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setPreferencesVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setPreferencesVisible(false)}>
                Confirm
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField
          label="Page size"
          description="Select the number of items to display on each page"
        >
          <RadioGroup
            value={preferences.pageSize.toString()}
            items={[
              { value: "10", label: "10 records per page" },
              { value: "20", label: "20 records per page" },
              { value: "50", label: "50 records per page" }
            ]}
            onChange={({ detail }) => {
              setPreferences({
                ...preferences,
                pageSize: parseInt(detail.value)
              });
              // Reset to first page when changing page size
              setCurrentPageIndex(1);
            }}
          />
        </FormField>
      </Modal>
    </>
  );
}

export default function SchemaTranslatorScreen() {
  const [flashbarItems, setFlashbarItems] = useState<FlashbarProps.MessageDefinition[]>([])

  const { data, dataDetail, isLoading, isLoadingDetail, screenName, selectedItem, refetch } 
    = useScreenQuery<SchemaTranslatorItem>();

  const breadcrumbs = [
    { text: 'Schema Translator', href: `#/${screenName}` },
    ...(selectedItem && dataDetail ? [
      { text: dataDetail.id, 
        href: `#/${screenName}/${selectedItem}` 
      }] : [])
  ]

  return (
    <div>
    <AppLayout
        breadcrumbs={<Breadcrumbs items={breadcrumbs} />}
        navigation={<ServiceNavigation />}
        notifications={<Flashbar data-testid="flashbar" items={flashbarItems} />}
        content={
          (selectedItem ?
            ( dataDetail ? 
              (<SchemaTranslatorDetailComponent item={dataDetail!} />) : 
                (isLoadingDetail ?
                   (<Alert data-testid="alert" type="info">Loading...</Alert>) :
                  (<Alert data-testid="alert" type="error">No data found</Alert>)
                )
           )
          : (
          <ErrorBoundary fallbackRender={fallbackRender}>
            <SchemaTranslatorTable loading={isLoading} items={data||[]} onRefresh={refetch}>
            </SchemaTranslatorTable>
          </ErrorBoundary>
          )
        )}
        tools={
          <HelpPanel data-testid="help-panel"
            header={<Header variant="h2">Schema Translator Help</Header>}
          >
            <div>
              <p>The Schema Translator screen shows the history of schema translator operations.</p>
              <p>Click on a file to view detailed information about the analysis.</p>
            </div>
          </HelpPanel>
        }            
    />
    </div>
  );
}


