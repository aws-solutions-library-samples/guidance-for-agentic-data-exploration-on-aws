import { DataAnalyzerItem } from './types';
import { Header, Container, SpaceBetween } from '@cloudscape-design/components';
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import 'highlight.js/styles/github.css';
import hljs from 'highlight.js';
import sql from 'highlight.js/lib/languages/sql';
import { useEffect, useRef, useMemo } from 'react';
import './data-analyzer.css'; // Import custom CSS for styling

// Register SQL language
hljs.registerLanguage('sql', sql);

export function DataAnalyzerDetailComponent ({ item }:{ item: DataAnalyzerItem }) {
    const csvContentRef = useRef<HTMLDivElement>(null);
    const schemaRef = useRef<HTMLElement>(null);
    
    // Function to trim leading blank lines from a string
    const trimLeadingBlankLines = (text: string): string => {
        if (!text) return '';
        return text.replace(/^\s*\n+/, '');
    };

    // Function to clean CSV cell content (remove surrounding quotes)
    const cleanCellContent = (cell: string): string => {
        if (!cell) return '';
        const trimmed = cell.trim();
        // Remove surrounding quotes if they exist
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed.slice(1, -1);
        }
        return trimmed;
    };

    // Extract file names from results
    const fileNames = useMemo(() => {
        if (!item.results) return [];
        
        const lines = item.results.split('\n');
        const fileNameLines = lines.filter(line => line.trim().startsWith('File:'));
        
        return fileNameLines.map(line => {
            // Extract just the file name part after "File: "
            const fileName = line.trim().substring(6).trim();
            return fileName;
        });
    }, [item.results]);
    
    const mainItems = [
        {
            label: "Analysis Completed",
            value: new Date(item.timestamp).toLocaleString()
        },
        {
            label: "Batch ID",
            value: item.id
        },  
        {
            label: "Analysis Source Prefix",
            value: item.file_name
        },
        {
            label: "File Count",
            value: item.file_count
        },
    ];

    // Determine if content is CSV format by checking for comma-separated values and newlines
    const isCSVContent = item.results && 
        typeof item.results === 'string' &&
        item.results.includes(',') && 
        item.results.includes('\n') && 
        item.results.split('\n').length > 1;

    // Function to parse CSV line respecting quoted fields
    const parseCSVLine = (line: string): string[] => {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                // Handle escaped quotes (double quotes)
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i += 2;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                result.push(current.trim());
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }
        
        // Add the last field
        result.push(current.trim());
        
        return result;
    };

    // Parse CSV content and organize by file sections
    const fileSections = useMemo(() => {
        if (!isCSVContent || !item.results) return [];
        
        const lines = item.results.split('\n').filter(line => line.trim() !== '');
        const sections = [];
        
        let currentFileInfo = '';
        let currentData = [];
        
        // Process each line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // If this is a file header line
            if (line.includes('File:')) {
                // If we already have data from a previous file, save it
                if (currentData.length > 0) {
                    sections.push({
                        fileInfo: currentFileInfo,
                        data: currentData
                    });
                    currentData = [];
                }
                
                // Start a new file section
                currentFileInfo = line.trim();
            } else {
                // Add data line to current section using proper CSV parsing
                currentData.push(parseCSVLine(line));
            }
        }
        
        // Add the last section if it has data
        if (currentData.length > 0) {
            sections.push({
                fileInfo: currentFileInfo,
                data: currentData
            });
        }
        
        return sections;
    }, [item.results, isCSVContent]);

    // Apply highlighting after component mounts or updates
    useEffect(() => {
        // Highlight code in text content
        if (!isCSVContent && csvContentRef.current) {
            const codeElements = csvContentRef.current.querySelectorAll('pre code');
            codeElements.forEach((block) => {
                hljs.highlightElement(block as HTMLElement);
            });
        }
        
        // Highlight schema code with SQL syntax
        if (schemaRef.current && item.schema) {
            // Force re-highlighting when schema changes
            schemaRef.current.textContent = typeof item.schema === 'string' 
                ? trimLeadingBlankLines(item.schema) 
                : trimLeadingBlankLines(JSON.stringify(item.schema, null, 2));
            
            hljs.highlightElement(schemaRef.current);
        }
    }, [item.results, isCSVContent, item.schema]);

    // Render content based on whether it's CSV or not
    const renderContent = () => {
        if (isCSVContent && fileSections.length > 0) {
            return (
                <div className="csv-content-wrapper">
                    {fileSections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="csv-file-section">
                            {section.fileInfo && (
                                <div className="csv-file-info">
                                    <strong>{section.fileInfo}</strong>
                                </div>
                            )}
                            <div className="csv-scroll-container">
                                <table className="csv-table">
                                    <tbody>
                                        {section.data.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {row.map((cell, cellIndex) => (
                                                    <td key={cellIndex} tabIndex={-1}>
                                                        {cleanCellContent(cell)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            );
        } else {
            // For non-CSV content, preserve line breaks
            return (
                <div ref={csvContentRef} className="text-content">
                    {item.results && typeof item.results === 'string' ? 
                        item.results.split('\n').map((line, index) => (
                            <div key={index} className="text-line">
                                {line}
                            </div>
                        )) 
                        : <div>No results available</div>
                    }
                </div>
            );
        }
    };

    return (
        <div data-testid="details">
            <SpaceBetween size="m">
                <Header variant='h1'>
                    {item.file_name}
                </Header>   
                <ColumnLayout columns={1} variant="text-grid">
                    <Container header={<Header variant='h2'>File Details</Header>}>
                        <KeyValuePairs columns={2} items={mainItems} />                        
                        {fileNames.length > 0 && (
                            <div className="file-names-container">
                                <div className="file-names-pillbox">
                                    {fileNames.map((fileName, index) => (
                                        <span key={index} className="file-name-pill">
                                            {fileName}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Container>
                </ColumnLayout>
                {item.schema && (
                    <ColumnLayout columns={1} variant="text-grid">
                        <Container header={
                            <Header variant='h2' 
                                actions={
                                    
                                    <Button
                                        iconName="copy"
                                        ariaLabel="Copy schema to clipboard"
                                        onClick={() => {
                                            if (item.schema) {
                                                const schemaText = typeof item.schema === 'string' 
                                                    ? trimLeadingBlankLines(item.schema) 
                                                    : trimLeadingBlankLines(JSON.stringify(item.schema, null, 2));
                                                navigator.clipboard.writeText(schemaText)
                                                    .then(() => {
                                                        // Optional: Add visual feedback
                                                        const btn = document.querySelector('[aria-label="Copy schema to clipboard"]');
                                                        if (btn) {
                                                            btn.setAttribute('data-copied', 'true');
                                                            setTimeout(() => {
                                                                btn.removeAttribute('data-copied');
                                                            }, 2000);
                                                        }
                                                    })
                                                    .catch(err => console.error('Failed to copy: ', err));
                                            }
                                        }}
                                    />
                                }
                            >
                                Generated Schema
                            </Header>
                        }>
                            <Box>
                                <Box padding={{top: 'xs'}} className="schema-container">
                                    <pre className="schema-code-block">
                                        <code 
                                            className="language-sql"
                                            ref={schemaRef}
                                        ></code>
                                    </pre>
                                </Box>
                            </Box>
                        </Container>
                    </ColumnLayout>
                )}
                <ColumnLayout columns={1} variant="text-grid">
                    <Container header={<Header variant='h3'>File Contents</Header>}>
                        <Box>
                            <Box padding={{top: 'xs'}} className="results-container">
                                {renderContent()}
                            </Box>
                        </Box>
                    </Container>
                </ColumnLayout>
            </SpaceBetween>
        </div>
    );
}
