// Hamburger Menu Functionality
function toggleSideMenu() {
    console.log('toggleSideMenu called'); // Debug log
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('sideMenuOverlay');
    
    console.log('sideMenu:', sideMenu); // Debug log
    console.log('overlay:', overlay); // Debug log
    
    if (sideMenu && overlay) {
        const isActive = sideMenu.classList.contains('active');
        console.log('isActive:', isActive); // Debug log
        
        if (isActive) {
            closeSideMenu();
        } else {
            openSideMenu();
        }
    } else {
        console.error('Side menu or overlay not found!');
    }
}

function openSideMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('sideMenuOverlay');
    
    if (sideMenu && overlay) {
        sideMenu.classList.add('active');
        overlay.classList.add('active');
        document.body.classList.add('menu-open');
    }
}

function closeSideMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('sideMenuOverlay');
    
    if (sideMenu && overlay) {
        sideMenu.classList.remove('active');
        overlay.classList.remove('active');
        document.body.classList.remove('menu-open');
    }
}

// Close side menu with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeSideMenu();
    }
});

// Initialize icons when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for feather to be available
    setTimeout(function() {
        if (typeof feather !== 'undefined' && typeof DOMPurify !== 'undefined') {
            // Initialize hamburger menu icon
            const hamburgerIcon = document.getElementById('hamburger-icon');
            if (hamburgerIcon) {
                hamburgerIcon.innerHTML = DOMPurify.sanitize(feather.icons.menu.toSvg({ width: 24, height: 24 }));
            }
            
            const closeIcon = document.getElementById('close-icon');
            if (closeIcon) {
                closeIcon.innerHTML = DOMPurify.sanitize(feather.icons.x.toSvg({ width: 20, height: 20 }));
            }
            
            const sideUserIcon = document.getElementById('side-user-icon');
            if (sideUserIcon) {
                sideUserIcon.innerHTML = DOMPurify.sanitize(feather.icons.user.toSvg({ width: 20, height: 20 }));
            }
            
            // Initialize menu item icons
            const iconMappings = {
                'explorer-icon': 'zap',
                'feedback-icon': 'message-square',
                'schema-icon': 'database',
                'analyzer-icon': 'bar-chart-2',
                'translator-icon': 'shuffle',
                'etl-icon': 'layers',
                'loader-icon': 'upload',
                'profile-icon': 'user',
                'logout-icon': 'log-out'
            };
            
            Object.entries(iconMappings).forEach(([id, iconName]) => {
                const element = document.getElementById(id);
                if (element && feather.icons[iconName]) {
                    element.innerHTML = DOMPurify.sanitize(feather.icons[iconName].toSvg({ width: 18, height: 18 }));
                }
            });
            
        }
    }, 100);
});