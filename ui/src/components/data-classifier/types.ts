export interface ETLLoaderItem {
    id: string;
    timestamp: string;
    edges: string;
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
  