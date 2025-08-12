describe('Dynamic Favicon', () => {
  beforeEach(() => {
    cy.visit('/'); // Visit your application's root URL
  });

  it('should change favicon when tab visibility changes', () => {
    // Check initial favicon (visible state)
    cy.get('link[rel="icon"]')
      .should('have.attr', 'href')
      .and('include', 'favicon.ico');

      cy.document().then((doc) => {
        const visibilityEvent = new Event('visibilitychange');
        Object.defineProperty(doc, 'hidden', { value: true, writable: true });
        doc.dispatchEvent(visibilityEvent);

        cy.get('link[rel="icon"]')
        .should('have.attr', 'href')
        .and('include', 'favicon-inactive.ico');
      })


    cy.document().then((doc) => {
      const visibilityEvent = new Event('visibilitychange');
      Object.defineProperty(doc, 'hidden', { value: false, writable: true });
      doc.dispatchEvent(visibilityEvent);

      cy.get('link[rel="icon"]')
      .should('have.attr', 'href')
      .and('include', 'favicon.ico');

    })
  });

  it('should create favicon link if none exists', () => {
    // Remove existing favicon if any
    cy.document().then((doc) => {
      const favicon = doc.querySelector('link[rel="icon"]');
      if (favicon) {
        favicon.remove();
      }
    });

    // Trigger a visibility change
    cy.document().then((doc) => {
      const visibilityEvent = new Event('visibilitychange');
      Object.defineProperty(doc, 'hidden', { value: false, writable: true });
      doc.dispatchEvent(visibilityEvent);
      // Check if favicon was created and has correct href
      cy.get('link[rel="icon"]')
        .should('exist')
        .and('have.attr', 'href')
        .and('include', 'favicon.ico');
    });
  });

  it('should handle missing favicon files gracefully', () => {
    // Intercept favicon requests and simulate 404
    cy.intercept('GET', '**/favicon.ico', {
      statusCode: 404,
      body: 'Not Found'
    }).as('faviconRequest');

    cy.intercept('GET', '**/favicon-inactive.ico', {
      statusCode: 404,
      body: 'Not Found'
    }).as('inactiveFaviconRequest');

    // Trigger visibility change and ensure no errors
    cy.window().then((win) => {
      const visibilityEvent = new Event('visibilitychange');
      Object.defineProperty(win.document, 'hidden', { value: true, writable: true });
      win.document.dispatchEvent(visibilityEvent);
    });

    // Check if the application continues to function
    cy.window().then((win) => {
      expect(win.document.querySelector('link[rel="icon"]')).to.exist;
    });
  });

  // Test for different browser families if needed
  it('should work across different browsers', { browser: ['chrome', 'firefox', 'edge'] }, () => {
    if (Cypress.browser.family === 'chromium') {
      // Chromium-specific assertions
      cy.get('link[rel="icon"]')
        .should('have.attr', 'href')
        .and('include', 'favicon.ico');
    } else if (Cypress.browser.name === 'firefox') {
      // Firefox-specific assertions
      cy.get('link[rel="icon"]')
        .should('have.attr', 'href')
        .and('include', 'favicon.ico');
    }
  });
});

describe('validate Home Page',()=> {
  before(()=> {
    cy.authenticate('/panoptic/e2e-testing')
    cy.visit('/')
  })

  it('should have top nav', () => {
      cy.get('[data-testid="top-navigation"]').should('exist');
  })
})