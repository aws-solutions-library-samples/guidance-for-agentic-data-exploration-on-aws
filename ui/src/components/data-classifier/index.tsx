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
import { ETLLoaderItem } from './types';
import { DataClassificationDetailComponent } from './detail';
import { useNavigate } from 'react-router-dom';
import { useScreenQuery } from '../../hooks/screen-query';
import Pagination from '@cloudscape-design/components/pagination';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import RadioGroup from '@cloudscape-design/components/radio-group';
import Icon from '@cloudscape-design/components/icon';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Toggle from '@cloudscape-design/components/toggle';

interface EdgeData {
  matching_edges: string[];
  edge_definitions: string[];
}

// Table preferences type
interface TablePreferences {
  pageSize: number;
  wrapLines: boolean;
  stripedRows: boolean;
  contentDensity: 'comfortable' | 'compact';
  visibleColumns: string[];
}

// Helper function to format edges for display
const formatEdges = (edgesString: string): string => {
  try {
    const edges: EdgeData = JSON.parse(edgesString);
    
    return edges.matching_edges
      .map((edge, index) => {
        const definition = edges.edge_definitions[index];
        return `${edge}\n(${definition})`;
      })
      .join('\n\n');
  } catch (error) {
    console.error('Error parsing edges:', error);
    return 'Invalid edge format';
  }
};

const fallbackRender = ({error, resetErrorBoundary}:FallbackProps) => { 
  console.error('error in Data Explorer', error);   
  return (
    <Alert data-testid="alert" 
      type="error"
      header="Something went wrong"
      action={<Button onClick={resetErrorBoundary}>Reset Conversation</Button>}>
        {error.message}
    </Alert>
  );
}
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
export function ETLLoaderTable(props:{ items: ETLLoaderItem[], loading: boolean, onRefresh?: () => void }) {
  const navigate = useNavigate();
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [preferences, setPreferences] = useState<TablePreferences>({
    pageSize: 20,
    wrapLines: true,
    stripedRows: true,
    contentDensity: 'comfortable',
    visibleColumns: ['timestamp', 'file_name', 'row_count', 'edge_count', 'status_code', 'status_message']
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
      cell: (item: ETLLoaderItem) => {
        const date = new Date(item.timestamp);
        return date.toLocaleString('en-US');
      },
      sortingField: 'timestamp',
      minWidth: 180,
    },
    {
      id: 'file_name',
      header: 'File Name',
      cell: (item: ETLLoaderItem) => <Link><div onClick={()=>navigate(item.id)}>{item.file_name}</div></Link>,
      sortingField: 'file_name',
      minWidth: 160,
      width: 200,
    },
    {
      id: 'row_count',
      header: 'Rows',
      cell: (item: ETLLoaderItem) => item.row_count,
      sortingField: 'row_count',
      minWidth: 90,
    },
    {
      id: 'edge_count',
      header: 'Edges',
      cell: (item: ETLLoaderItem) => item.edge_count,
      sortingField: 'edge_count',
      minWidth: 100,
    },
    {
      id: 'status_code',
      header: 'Status',
      cell: (item: ETLLoaderItem) => (
        <StatusIndicator type={item.status_code == 200 ? "success" : "error"}>
          {item.status_code}
        </StatusIndicator>
      ),
      sortingField: 'status_code',
      minWidth: 110,
    },
    {
      id: 'status_message',
      header: 'Message',
      cell: (item: ETLLoaderItem) => item.status_message,
      sortingField: 'status_message',
      minWidth: 260,
      width: 360,
    },
  ];  

  const { items: collectionItems, actions, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } = 
    useCollection(props.items, {
      filtering: {
        empty: 'No data classifer log items match the filters',
        noMatch: 'No matches found',
      },
      selection: {},
      sorting: { defaultState: { sortingColumn: columnDefinitions[0], isDescending: true } },
      pagination: { pageSize: preferences.pageSize },
      propertyFiltering: {
        filteringProperties: [
          {
            key: 'file_name',
            operators: [':', '!:', '=', '!='],
            propertyLabel: 'File Name',
            groupValuesLabel: 'File Name values',
          },
          {
            key: 'status_code',
            operators: [':', '!:', '=', '!='],
            propertyLabel: 'Status Code',
            groupValuesLabel: 'Status Code values',
          },          
          {
            key: 'node_label',
            operators: [':', '!:', '=', '!='],
            propertyLabel: 'Node Label',
            groupValuesLabel: 'Node Label values',
          },
          {
            key: 'row_count',
            operators: ['>', '>=', '<', '<=', '=', '!='],
            propertyLabel: 'Rows',
            groupValuesLabel: 'Rows values',
          },
          {
            key: 'edge_count',
            operators: ['>', '>=', '<', '<=', '=', '!='],
            propertyLabel: 'Edges',
            groupValuesLabel: 'Edges values',
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
        empty={<EmptyState title="No items found" subtitle="" />}
        loading={props.loading}
        stripedRows={preferences.stripedRows}
        wrapLines={preferences.wrapLines}
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
            Data Classifier Log
          </Header>
        }
        filter={
          <PropertyFilter 
            data-type="property-filter" 
            {...propertyFilterProps} 
            i18nStrings={{
              filteringAriaLabel: "Filter data classifier items",
              dismissAriaLabel: "Dismiss",
              filteringPlaceholder: "Search data classifier items",
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

export default function DataClassificationScreen() {
  const [flashbarItems, setFlashbarItems] = useState<FlashbarProps.MessageDefinition[]>([])

  const { data, dataDetail, isLoading, isLoadingDetail, screenName, selectedItem, refetch } 
    = useScreenQuery<ETLLoaderItem>();

  const breadcrumbs = [
    { text: 'Data Classification', href: `#/${screenName}` },
    ...(selectedItem && dataDetail ? [
      { text: dataDetail.file_name, 
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
              (<DataClassificationDetailComponent item={dataDetail!} />) : 
                (isLoadingDetail ?
                   (<Alert data-testid="alert" type="info">Loading...</Alert>) :
                  (<Alert data-testid="alert" type="error">No data found</Alert>)
                )
           )
          : (
          <ErrorBoundary fallbackRender={fallbackRender}>
            <ETLLoaderTable loading={isLoading} items={data||[]} onRefresh={refetch}>
            </ETLLoaderTable>
          </ErrorBoundary>
          )
        )}
        tools={
          <HelpPanel data-testid="help-panel"
            header={<Header variant="h2">Help Panel</Header>}
          >
            <div>help goes here</div>
          </HelpPanel>
        }            
    />
    </div>
  );

}


