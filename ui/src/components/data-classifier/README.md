# ETL Loader Component

A Cloudscape-based component for displaying and navigating ETL loader data.

## Features

- Sortable columns
- Multi-select functionality
- Filtering capabilities
- Pagination
- Full-page table layout
- Property-based filtering for Node Label, File Name, and Edge Count

## Usage

```tsx
import { ETLLoaderTable } from './components/etl-loader';

function YourComponent() {
  const items = [/* your ETL loader items */];
  
  return (
    <ETLLoaderTable items={items} />
  );
}
```

## Props

| Prop    | Type              | Description                    |
|---------|------------------|--------------------------------|
| items   | ETLLoaderItem[]  | Array of ETL loader data items |

## Data Structure

Each item in the `items` array should conform to the `ETLLoaderItem` interface:

```typescript
interface ETLLoaderItem {
  id: string;
  timestamp: string;
  edges: {
    matching_edges: string[];
  };
  edge_count: number;
  edge_output_key: string;
  file_name: string;
  new_headers: string[];
  node_label: string;
  original_headers: string[];
  output_key: string;
  row_count: number;
  unique_id: string;
  status_code: number;
  status_message: string;
}
```
