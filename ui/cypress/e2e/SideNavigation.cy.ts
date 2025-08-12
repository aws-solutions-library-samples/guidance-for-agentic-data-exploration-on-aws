describe('Side Navigation Internationalization', () => {
  beforeEach(() => {
    cy.authenticate('/panoptic/e2e-testing')
    cy.visit('/', {
      onBeforeLoad(win) {
        Object.defineProperty(win.navigator, 'language', {
          value: 'es-ES'
        })
        Object.defineProperty(win.navigator, 'languages', {
          value: ['es-ES']
        })
      }
    }
    )
  })

  it('should display Spanish', () => {
    // Check Spanish translations
    cy.get('[data-testid="side-navigation"]').within(() => {
      cy.contains('Inicio')
      cy.contains('Explorador de Datos')
      cy.contains('Ingesta de Datos')
      cy.contains('Analizador de Datos')
      cy.contains('Traductor de Esquemas')
      cy.contains('Clasificador de Datos')
      cy.contains('Cargador de Datos')
      cy.contains('Editor de Esquemas de Grafos')
      cy.contains('Documentación')
    })
  })
})