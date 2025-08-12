describe('Schema Translator Page', () => {
  beforeEach(() => {
    cy.authenticate('/panoptic/e2e-testing')
    cy.visit('/')
    // Navigate to Schema Translator page using side nav
    cy.get('a[href*="schema-translator"]').first().click();
  });

  it('should display the Schema Translator screen with table', () => {
    // Verify main header exists
    cy.contains('Schema Translator History').should('exist');
    
    // Verify table exists and is visible
    cy.get('table').should('exist').and('be.visible');
    
    // Verify key table columns are present
    cy.contains('th', 'Processed').should('exist');
    cy.contains('th', 'Batch ID').should('exist');
    cy.contains('th', 'Relationships').should('exist');
  });

  it('should display help panel with guidance', () => {
    // Verify help panel exists and contains correct content
    cy.get('[data-testid="help-panel"]')
      .should('exist')
      .within(() => {
        cy.contains('Schema Translator Help').should('exist');
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
  it('should load and display data when the screen loads', () => {
    cy.get('table tbody tr').should('have.length.at.least', 1);
    
    cy.contains('8513b034-b2a1-4dc2-a468-c4c524d32b1b').should('exist');
  });

  it('should open and display detail drilldown screen', () => {
    cy.get('table tbody tr').first().within(($f) => {
      cy.get('a').click();
    })
    cy.get('[data-testid="details"]').should('exist').and('be.visible');
  });

});