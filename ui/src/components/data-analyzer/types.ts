export interface DataAnalyzerItem {
    id: string;
    timestamp: string;
    file_name: string;
    file_count?: number;
    results?: string;
    schema?: string;
}
  