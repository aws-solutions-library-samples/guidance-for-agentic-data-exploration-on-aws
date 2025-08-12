describe('Data Explorer Page', () => {
    beforeEach(() => {
        cy.authenticate('/panoptic/e2e-testing')
        cy.visit('/')
        cy.get('a[href*="data-explorer"]').first().click();
      // Visit the data explorer page
    });
  
    it('should display Messages component', () => {
      // Verify the Messages component exists using the data-testid
      cy.get('[data-testid="messages"]')
        .should('exist')
        .and('be.visible');
    });

    it('should have functional file upload capability', () => {
      // Check if file input exists
      cy.get('input[type="file"]')
        .should('exist')
        .selectFile('cypress/fixtures/test.csv', { force: true })
        .then(() => {
          // Verify file is uploaded
          cy.get('[data-testid="data-loader-submit-btn"]')
            .should('exist')
            .and('be.visible');
        });
      

      });
  
    it('should display help panel with correct content', () => {
      // Verify help panel exists
      cy.get('[data-testid="help-panel"]')
        .should('exist')
        .within(() => {
          cy.contains('h2', 'Data Explorer');
          cy.contains('Getting Started');
          cy.contains('Use the Data Explorer to analyze and interact with your data');
        });
    });

    it('should submit a chat request and display response', () => {
      // Type a message in the prompt input
      cy.get('[aria-label="Prompt input"]')
        .find('textarea')
        .should('exist')
        .type('test question{enter}');

      // Verify the user message appears
      cy.get('[data-testid="messages"]')
        .contains('test question')
        .should('be.visible');

      // Verify response is displayed
      cy.get('[data-testid="messages"]')
        .find('p')
        .contains('This is a test response')
        .should('be.visible');
    });
  });