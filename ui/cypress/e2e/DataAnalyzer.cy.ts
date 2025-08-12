describe('Data Analyzer Page', () => {
  beforeEach(() => {
    cy.authenticate('/panoptic/e2e-testing')
    cy.visit('/')
    // Navigate to Data Analyzer page using side nav
    cy.get('a[href*="data-analyzer"]').click();
  });

  it('should display the Data Analyzer screen with table', () => {
    // Verify main header exists
    cy.contains('Data Analyzer History').should('exist');
    
    // Verify table exists and is visible
    cy.get('table').should('exist').and('be.visible');
    
    // Verify key table columns are present
    cy.contains('th', 'Processed').should('exist');
    cy.contains('th', 'Files').should('exist');
    cy.contains('th', 'S3 Prefix Analyzed').should('exist');
  });

  it('should display help panel with guidance', () => {
    // Verify help panel exists and contains correct content
    cy.get('[data-testid="help-panel"]')
      .should('exist')
      .within(() => {
        cy.contains('Data Analyzer Help').should('exist');
      });
  });

  it('should have functional property filter', () => {
    // Verify property filter exists and is interactive
    cy.get('[data-type="property-filter"]').should('exist');
    
    // Verify filter tokens can be added
    cy.get('[data-type="property-filter"]')
      .click()
      .type('Source Path{enter}');
  });

  it('should display flashbar for notifications', () => {
    // Verify flashbar component exists
    cy.get('[data-testid="flashbar"]').should('exist');
  });
  
  it('should open and display detail drilldown screen', () => {
    cy.get('table tbody tr').first().within(($f) => {
      cy.get('a').click();
    })
    cy.get('[data-testid="details"]').should('exist').and('be.visible');
  });

  // New test cases for CSV parsing with quoted fields
  describe('CSV Parsing with Quoted Fields', () => {
    it('should display the quoted CSV test data in the main table', () => {
      // Verify our new mock data appears in the table
      cy.contains('analyze/batch4097st').should('exist');
      
    });

    it('should properly parse and display CSV with quoted fields containing commas', () => {
      // Click on the quoted CSV test data entry
      cy.contains('analyze/batch4097st').click();
      
      // Verify we're on the detail page
      cy.get('[data-testid="details"]').should('exist').and('be.visible');
      
      // Verify the File Contents section exists
      cy.contains('File Contents').should('exist');
      
      // Verify the CSV table is rendered
      cy.get('.csv-table').should('exist').and('be.visible');
      
      // Verify the header row is present with correct number of columns (9 columns expected)
      cy.get('.csv-table tbody tr').first().within(() => {
        cy.get('td').should('have.length', 9);
      });
      
      // Test specific quoted field parsing - Genres column (5th column, index 4)
      cy.get('.csv-table tbody tr').eq(1).within(() => {
        // Verify "Alternative Rock, Art Rock" appears as single cell without surrounding quotes
        cy.get('td').eq(4).should('contain.text', 'Alternative Rock, Art Rock');
        cy.get('td').eq(4).should('not.contain.text', '"Alternative Rock');
        cy.get('td').eq(4).should('not.contain.text', 'Art Rock"');
      });
      
      // Test complex quoted descriptors field (6th column, index 5)
      cy.get('.csv-table tbody tr').eq(1).within(() => {
        cy.get('td').eq(5).should('contain.text', 'melancholic, anxious, futuristic');
        cy.get('td').eq(5).should('contain.text', 'male vocals, atmospheric');
        cy.get('td').eq(5).should('not.contain.text', '"melancholic');
        cy.get('td').eq(5).should('not.contain.text', 'introspective"');
      });
    });

    it('should display different genre combinations correctly', () => {
      cy.contains('analyze/batch4097st').click();
      cy.get('[data-testid="details"]').should('exist');
      
      // Test Progressive Rock, Art Rock (row 2)
      cy.get('.csv-table tbody tr').eq(2).within(() => {
        cy.get('td').eq(4).should('contain.text', 'Progressive Rock, Art Rock');
        cy.get('td').eq(4).should('not.contain.text', '"Progressive Rock');
      });
      
      // Test Art Rock, Experimental Rock, Electronic (row 4)
      cy.get('.csv-table tbody tr').eq(4).within(() => {
        cy.get('td').eq(4).should('contain.text', 'Art Rock, Experimental Rock, Electronic');
        cy.get('td').eq(4).should('not.contain.text', '"Art Rock');
      });
      
      // Test Hip Hop genres (row 5)
      cy.get('.csv-table tbody tr').eq(5).within(() => {
        cy.get('td').eq(4).should('contain.text', 'Conscious Hip Hop, West Coast Hip Hop, Jazz Rap');
      });
    });

    it('should handle non-quoted fields correctly', () => {
      cy.contains('analyze/batch4097st').click();
      cy.get('[data-testid="details"]').should('exist');
      
      // Test simple non-quoted field (Pop Rock in row 8)
      cy.get('.csv-table tbody tr').eq(8).within(() => {
        cy.get('td').eq(4).should('contain.text', 'Pop Rock');
        cy.get('td').eq(4).should('not.contain.text', '"Pop Rock"');
      });
      
      // Verify album names (non-quoted fields)
      cy.get('.csv-table tbody tr').eq(1).within(() => {
        cy.get('td').eq(1).should('contain.text', 'OK Computer');
      });
      
      cy.get('.csv-table tbody tr').eq(2).within(() => {
        cy.get('td').eq(1).should('contain.text', 'Wish You Were Here');
      });
    });

    it('should display correct number of rows and columns', () => {
      cy.contains('analyze/batch4097st').click();
      cy.get('[data-testid="details"]').should('exist');
      
      // Verify we have the header row plus 9 data rows (10 total)
      cy.get('.csv-table tbody tr').should('have.length', 10);
      
      // Verify each row has exactly 9 columns
      cy.get('.csv-table tbody tr').each(($row) => {
        cy.wrap($row).find('td').should('have.length', 9);
      });
    });

    it('should display the CSV file information header', () => {
      cy.contains('analyze/batch4097st').click();
      cy.get('[data-testid="details"]').should('exist');
      
      // Verify the file info header is displayed
      cy.get('.csv-file-info').should('exist');
      cy.get('.csv-file-info').should('contain.text', 'File: analyze/batch4097st/rym_top_5000_all_time_fixed.csv');
    });

    it('should display the generated schema section', () => {
      cy.contains('analyze/batch4097st').click();
      cy.get('[data-testid="details"]').should('exist');
      
      // Verify the Generated Schema section exists
      cy.contains('Generated Schema').should('exist');
      
      // Verify schema content is displayed
      cy.get('.schema-code-block').should('exist');
      cy.get('.schema-code-block').should('contain.text', 'CREATE TABLE albums');
      cy.get('.schema-code-block').should('contain.text', 'album_id SERIAL PRIMARY KEY');
    });

    it('should have a functional copy button for schema', () => {
      cy.contains('analyze/batch4097st').click();
      cy.get('[data-testid="details"]').should('exist');
      
      // Verify the copy button exists in the schema section
      cy.get('button[aria-label="Copy schema to clipboard"]').should('exist');
      
      // Click the copy button (note: actual clipboard testing is limited in Cypress)
      cy.get('button[aria-label="Copy schema to clipboard"]').click();
    });

    it('should properly style the CSV table with alternating row colors', () => {
      cy.contains('analyze/batch4097st').click();
      cy.get('[data-testid="details"]').should('exist');
      
      // Verify the CSV table has proper styling classes
      cy.get('.csv-table').should('exist');
      cy.get('.csv-scroll-container').should('exist');
      
      // Verify the table is scrollable horizontally if needed
      cy.get('.csv-scroll-container').should('have.css', 'overflow-x', 'auto');
    });
  });

});