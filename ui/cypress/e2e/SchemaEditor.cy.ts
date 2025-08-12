describe('Schema Editor', () => {
    beforeEach(() => {
      cy.authenticate('/panoptic/e2e-testing')
      cy.visit('/')
      // Navigate to schema editor page using side nav
      cy.get('a[href*="schema-editor"]').first().click();
    });
  
    it('should display the Schema Editor screen with editor and preview', () => {
        cy.get('[data-testid="schema-editor-header"]').should('exist');
        cy.get('[data-testid="schema-editor-container"]').should('exist');
        cy.get('[data-testid="schema-preview-panel"]').should('exist');
    });
  
    it('should load and display schema content', () => {
        cy.get('[data-testid="schema-editor-textarea"]')
            .should('exist')
            .and('not.be.empty');
        
        cy.get('[data-testid="graph-preview-container"]')
            .should('exist')
            .and('be.visible');
    });

  
    it('should save schema changes successfully', () => {
        const testSchema = '[TestNode1]—(RELATES_TO)→[TestNode2]';
        
        cy.get('[data-testid="schema-editor-textarea"]')
            .clear()
            .type(testSchema);

        cy.get('[data-testid="schema-save-button"]').click();

        cy.get('[data-testid="schema-notification"]')
            .contains('Schema saved successfully')
            .should('be.visible');
    });
  
    it('should show validation errors for invalid schema', () => {
      const invalidSchema = 'Invalid Schema Format';
      
      // Type invalid schema
      cy.get('[data-testid="schema-editor"]')
        .find('textarea')
        .clear()
        .type(invalidSchema);
  
      // Click save button
      cy.get('[data-testid="save-schema-button"]').click();
  
      // Verify error notification
      cy.get('[data-testid="flashbar"]')
        .contains('Schema validation failed')
        .should('be.visible');
    });
  
    it('should update graph preview when split panel is resized', () => {
      // Verify initial render
      cy.get('[data-testid="graph-preview"]').should('be.visible');
      
      // Trigger split panel resize
      cy.get('[data-testid="split-panel"]')
        .trigger('mousedown')
        .trigger('mousemove', { clientY: 400 })
        .trigger('mouseup');
  
      // Verify graph preview updates
      cy.get('[data-testid="graph-preview"]')
        .should('have.css', 'height')
        .and('not.equal', '0px');
    });
  
    it('should persist schema changes after page reload', () => {
      const testSchema = '[PersistNode1]—(CONNECTS_TO)→[PersistNode2]';
      
      // Type and save new schema
      cy.get('[data-testid="schema-editor"]')
        .find('textarea')
        .clear()
        .type(testSchema);
      
      cy.get('[data-testid="save-schema-button"]').click();
      
      // Reload page
      cy.reload();
      
      // Verify content persisted
      cy.get('[data-testid="schema-editor"]')
        .find('textarea')
        .should('have.value', testSchema);
    });
  
    it('should handle help panel toggle', () => {
      // Open help panel
      cy.get('[data-testid="tools-toggle"]').click();
      
      // Verify help content
      cy.get('[data-testid="help-panel"]')
        .should('be.visible')
        .and('contain', 'Schema Editor Help');
    });
  });
  