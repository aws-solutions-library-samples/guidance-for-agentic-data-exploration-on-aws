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
import { Link, StatusIndicator } from '@cloudscape-design/components';
import { BulkLoadData } from './types';
import { DataLoaderDetailComponent } from './detail';
import { useNavigate } from 'react-router-dom';
import { useScreenQuery } from '../../hooks/screen-query';
import Pagination from '@cloudscape-design/components/pagination';
import { determineLoadStatus, getStatusType, parseLoaderResponse } from './utils';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import RadioGroup from '@cloudscape-design/components/radio-group';
import Icon from '@cloudscape-design/components/icon';
import Checkbox from '@cloudscape-design/components/checkbox';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Toggle from '@cloudscape-design/components/toggle';

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
interface TablePreferences {
  pageSize: number;
  wrapLines: boolean;
  stripedRows: boolean;
  contentDensity: 'comfortable' | 'compact';
  visibleColumns: string[];
}

const fallbackRender = ({error, resetErrorBoundary}:FallbackProps) => { 
  console.error('error in Data Loader', error);   
  return (
    <Alert data-testid="alert" 
      type="error"
      header="Something went wrong"
      action={<Button onClick={resetErrorBoundary}>Reset</Button>}>
        {error.message}
    </Alert>
  );
}

export function DataLoaderTable(props:{ items: BulkLoadData[], loading: boolean, onRefresh?: () => void }) {
  const navigate = useNavigate();
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [preferences, setPreferences] = useState<TablePreferences>({
    pageSize: 20,
    wrapLines: true,
    stripedRows: true,
    contentDensity: 'comfortable',
    visibleColumns: ['startTime', 'sourcePath', 'loadStatus', 'totalRecords', 'timeSpent']
  });
  
  // Process items to ensure they have parsed responses
  const processedItems = props.items.map(item => {
    if (!item.parsedResponse && item.loaderResponse) {
      const parsedResponse = parseLoaderResponse(item);
      if (parsedResponse) {
        return { ...item, parsedResponse };
      }
    }
    return item;
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
      id: 'startTime',
      header: 'Start Time',
      cell: (item: BulkLoadData) => {
        const date = new Date(item.startTime);
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return localDate.toLocaleString('en-US');      
      },
      sortingField: 'startTime',
      minWidth: 180,
      width: 200,
    },
    {
      id: 'sourcePath',
      header: 'Source Path',
      cell: (item: BulkLoadData) => (
        <Link>
          <div 
            onClick={()=>navigate(item.loadId)}
            style={{ 
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%'
            }}
            title={item.sourcePath} // Show full path on hover
          >
            {item.sourcePath}
          </div>
        </Link>
      ),
      sortingField: 'sourcePath',
      minWidth: 200,
      width: 260,
    },
    {
      id: 'loadStatus',
      header: 'Status',
      cell: (item: BulkLoadData) => {
        // Get the actual status using the shared utility function
        const displayStatus = determineLoadStatus(item);
        
        return (
          <StatusIndicator 
            type={getStatusType(displayStatus)}
            colorOverride={displayStatus === 'LOAD_COMPLETED' ? 'green' : 
                          displayStatus === 'LOAD_COMPLETE_W_ERRORS' ? 'yellow' : undefined}
          >
            {displayStatus}
          </StatusIndicator>
        );
      },
      sortingField: 'loadStatus',
      minWidth: 140,
      width: 220,
    },
    {
      id: 'totalRecords',
      header: 'Records',
      cell: (item: BulkLoadData) => item.totalRecords,
      sortingField: 'totalRecords',
      minWidth: 120,
      width: 120,
    },
    {
      id: 'timeSpent',
      header: 'Load Time(s)',
      cell: (item: BulkLoadData) => item.timeSpent,
      sortingField: 'timeSpent',
      minWidth: 110,
      width: 110,
    },
  ];  

  const { items: collectionItems, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } = 
    useCollection(processedItems, {
      filtering: {
        empty: 'No data loader items match the filters',
        noMatch: 'No matches found',
      },
      selection: {},
      sorting: { defaultState: { sortingColumn: columnDefinitions[0], isDescending: true } },
      pagination: { pageSize: preferences.pageSize },
      propertyFiltering: {
        filteringProperties: [
          {
            key: 'sourcePath',
            operators: [':', '!:', '=', '!='],
            propertyLabel: 'Source Path',
            groupValuesLabel: 'Source Path values',
          },
          {
            key: 'loadStatus',
            operators: [':', '!:', '=', '!='],
            propertyLabel: 'Status',
            groupValuesLabel: 'Status values',
          },
          {
            key: 'totalRecords',
            operators: ['>', '>=', '<', '<=', '=', '!='],
            propertyLabel: 'Total Records',
            groupValuesLabel: 'Total Records values',
          },
          {
            key: 'timeSpent',
            operators: ['>', '>=', '<', '<=', '=', '!='],
            propertyLabel: 'Time Spent',
            groupValuesLabel: 'Time Spent values',
          },
        ],
      },
    });

  return (
    <>
      <Table
        {...collectionProps}
        columnDefinitions={columnDefinitions}
        items={collectionItems}
        empty={<EmptyState title="No items found" subtitle="No data loader items match the criteria" />}
        loading={props.loading}
        stripedRows={preferences.stripedRows}
        contentDensity={preferences.contentDensity}
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
            Data Loader Status
          </Header>
        }
        filter={
          <PropertyFilter 
            data-type="property-filter" 
            {...propertyFilterProps} 
            i18nStrings={{
              filteringAriaLabel: "Filter data loader items",
              dismissAriaLabel: "Dismiss",
              filteringPlaceholder: "Search data loader items",
              groupValuesText: "Values",
              groupPropertiesText: "Properties",
              operatorsText: "Operators",
              operationAndText: "and",
              operationOrText: "or",
              operatorLessText: "Less than",
              operatorLessOrEqualText: "Less than or equal",
              operatorGreaterText: "Greater than",
              operatorGreaterOrEqualText: "Greater than or equal",
              operatorContainsText: "Contains",
              operatorDoesNotContainText: "Does not contain",
              operatorEqualsText: "Equals",
              operatorDoesNotEqualText: "Does not equal",
              editTokenHeader: "Edit filter",
              propertyText: "Property",
              operatorText: "Operator",
              valueText: "Value",
              cancelActionText: "Cancel",
              applyActionText: "Apply",
              allPropertiesLabel: "All properties",
              tokenLimitShowMore: "Show more",
              tokenLimitShowFewer: "Show fewer",
              clearFiltersText: "Clear filters",
              removeTokenButtonAriaLabel: token => `Remove token ${token}`,
              enteredTextLabel: value => `Use: "${value}"`
            }}
          />
        }
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
        wrapLines={preferences.wrapLines}
        columnDisplay={columnDefinitions.map(col => ({
          id: col.id,
          visible: preferences.visibleColumns.includes(col.id)
        }))}
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
        <ColumnLayout columns={2}>
          <SpaceBetween size="l">
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
            
            <FormField
              label="Content density"
              description="Select the density of the table content"
            >
              <RadioGroup
                value={preferences.contentDensity}
                items={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" }
                ]}
                onChange={({ detail }) => {
                  setPreferences({
                    ...preferences,
                    contentDensity: detail.value as 'comfortable' | 'compact'
                  });
                }}
              />
            </FormField>
          </SpaceBetween>
          
          <SpaceBetween size="l">
            <FormField
              label="Table appearance"
              description="Customize how the table appears"
            >
              <SpaceBetween size="s">
                <Toggle
                  checked={preferences.wrapLines}
                  onChange={({ detail }) => {
                    setPreferences({
                      ...preferences,
                      wrapLines: detail.checked
                    });
                  }}
                >
                  Wrap lines
                </Toggle>
                <Toggle
                  checked={preferences.stripedRows}
                  onChange={({ detail }) => {
                    setPreferences({
                      ...preferences,
                      stripedRows: detail.checked
                    });
                  }}
                >
                  Striped rows
                </Toggle>
              </SpaceBetween>
            </FormField>
            
            <FormField
              label="Visible columns"
              description="Select which columns to display in the table"
            >
              <SpaceBetween size="s">
                {columnDefinitions.map(column => (
                  <Toggle
                    key={column.id}
                    checked={preferences.visibleColumns.includes(column.id)}
                    onChange={({ detail }) => {
                      const newVisibleColumns = detail.checked
                        ? [...preferences.visibleColumns, column.id]
                        : preferences.visibleColumns.filter(id => id !== column.id);
                      
                      setPreferences({
                        ...preferences,
                        visibleColumns: newVisibleColumns
                      });
                    }}
                  >
                    {column.header}
                  </Toggle>
                ))}
              </SpaceBetween>
            </FormField>
          </SpaceBetween>
        </ColumnLayout>
      </Modal>
    </>
  );
}

export default function DataLoaderScreen() {
  const [flashbarItems, setFlashbarItems] = useState<FlashbarProps.MessageDefinition[]>([])

  const { data, dataDetail, isLoading, isLoadingDetail, screenName, selectedItem, refetch } 
    = useScreenQuery<BulkLoadData>();

  const breadcrumbs = [
    { text: 'Data Loader', href: `#/${screenName}` },
    ...(selectedItem && dataDetail ? [
      { text: dataDetail.sourcePath, 
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
              (<DataLoaderDetailComponent item={dataDetail!} />) : 
                (isLoadingDetail ?
                   (<Alert data-testid="alert" type="info">Loading...</Alert>) :
                  (<Alert data-testid="alert" type="error">No data found</Alert>)
                )
           )
          : (
          <ErrorBoundary fallbackRender={fallbackRender}>
            <DataLoaderTable loading={isLoading} items={data||[]} onRefresh={refetch}>
            </DataLoaderTable>
          </ErrorBoundary>
          )
        )}
        tools={
          <HelpPanel data-testid="help-panel"
            header={<Header variant="h2">Data Loader Help</Header>}
          >
            <div>
              <p>The Data Loader screen shows the status of bulk data loading operations.</p>
              <p>Click on a source path to view detailed information about the load operation.</p>
            </div>
          </HelpPanel>
        }            
    />
    </div>
  );
}