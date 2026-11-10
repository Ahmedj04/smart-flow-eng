/* ============================================
   SMART FLOW ENGINEERING - MAIN JAVASCRIPT
   ============================================ */

/* ============================================
   GOOGLE ANALYTICS (GA4) INJECTION
   ============================================ */
(function() {
    const GA_ID = 'G-9G8R74PQFF';

    // 1. Inject the external gtag.js script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    // 2. Initialize dataLayer and gtag function
    window.dataLayer = window.dataLayer || [];
    function gtag() {
        window.dataLayer.push(arguments);
    }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', GA_ID);
})();

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // ===== MOBILE MENU TOGGLE =====
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
        
        // Close mobile menu when clicking a link (but not dropdown triggers on mobile)
        const navItems = navLinks.querySelectorAll('a:not(.dropdown-trigger)');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navLinks.classList.remove('active');
                if (mobileMenuBtn.querySelector('i')) {
                    mobileMenuBtn.querySelector('i').classList.add('fa-bars');
                    mobileMenuBtn.querySelector('i').classList.remove('fa-times');
                }
            });
        });
    }
    
    // ===== MOBILE DROPDOWN TOGGLE (Services & Sectors) =====
    const dropdowns = document.querySelectorAll('.dropdown');
    
    function handleMobileDropdowns() {
        if (window.innerWidth <= 992) {
            dropdowns.forEach(dropdown => {
                const trigger = dropdown.querySelector('.dropdown-trigger');
                if (trigger) {
                    // Remove existing event listeners to avoid duplicates
                    const newTrigger = trigger.cloneNode(true);
                    trigger.parentNode.replaceChild(newTrigger, trigger);
                    
                    newTrigger.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Close other dropdowns
                        dropdowns.forEach(d => {
                            if (d !== dropdown && d.classList.contains('active')) {
                                d.classList.remove('active');
                            }
                        });
                        
                        // Toggle current dropdown
                        dropdown.classList.toggle('active');
                    });
                }
            });
        } else {
            // On desktop, ensure no dropdowns are accidentally left active
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    }
    
    // Initialize mobile dropdown handling
    handleMobileDropdowns();
    
    // Close dropdowns when clicking outside (for mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
            if (!e.target.closest('.dropdown')) {
                dropdowns.forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        }
    });
    
    // Handle window resize - reset dropdown states
    window.addEventListener('resize', () => {
        handleMobileDropdowns();
        if (window.innerWidth > 992) {
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
    
    // ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // ===== STICKY NAVIGATION SHADOW =====
    const nav = document.querySelector('nav');
    if (nav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                nav.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
            } else {
                nav.style.boxShadow = 'none';
            }
        });
    }
    
    // ===== INTERSECTION OBSERVER FOR FADE-IN ANIMATIONS =====
    const animatedElements = document.querySelectorAll('.animate-on-scroll, .service-card, .why-card, .industry-card, .support-card, .cert-card, .sector-hero-card');
    
    if (animatedElements.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
        
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'all 0.6s ease';
            observer.observe(el);
        });
    }
    
    // ===== DYNAMIC YEAR IN FOOTER =====
    const yearSpan = document.querySelector('.current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    // ===== BACK TO TOP BUTTON =====
    const createBackToTop = () => {
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        btn.className = 'back-to-top';
        btn.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 45px;
            height: 45px;
            background: linear-gradient(135deg, #0B2B5E, #00A3B2);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        document.body.appendChild(btn);
        
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                btn.style.opacity = '1';
                btn.style.visibility = 'visible';
            } else {
                btn.style.opacity = '0';
                btn.style.visibility = 'hidden';
            }
        });
    };
    
    createBackToTop();
    
    // ===== ACTIVE NAVIGATION LINK HIGHLIGHTING =====
    const normalizeNavPath = pathname => pathname
        .replace(/\/+$/, '')
        .replace(/\.html$/, '')
        .replace(/\/index$/, '') || '/';
    const currentPath = normalizeNavPath(window.location.pathname);
    const navLinksAll = Array.from(document.querySelectorAll('.nav-links a'));

    // Clear hardcoded highlights before selecting one current navigation item.
    navLinksAll.forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
    });

    const sectionPages = {
        '/kosmek-products': '/services',
        '/manufacturing': '/sectors',
        '/packaging': '/sectors',
        '/food-beverage': '/sectors',
        '/water-wastewater': '/sectors',
        '/blog/automation-health-check-downtime-obsolescence-uk-manufacturing': '/blog',
        '/blog/industrial-automation-services-uk': '/blog',
        '/blog/factory-automation-reliability': '/blog',
        '/blog/plc-upgrade-services-modernising-control-systems': '/blog'
    };
    const sectionPath = sectionPages[currentPath] || currentPath;
    const currentLink = navLinksAll.find(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || link.classList.contains('quote-nav-btn')) {
            return false;
        }
        const target = new URL(href, window.location.origin + '/');
        return target.origin === window.location.origin &&
            normalizeNavPath(target.pathname) === sectionPath;
    });

    // A service detail belongs to its dropdown's main navigation section.
    const activeLink = currentLink?.closest('.dropdown')?.querySelector('.dropdown-trigger') || currentLink;
    if (activeLink) {
        activeLink.classList.add('active');
        const targetPath = normalizeNavPath(new URL(activeLink.getAttribute('href'), window.location.origin + '/').pathname);
        activeLink.setAttribute('aria-current', targetPath === currentPath ? 'page' : 'location');
    }
     (function() {
    const tooltip = document.getElementById('whatsappTooltip');
    if (tooltip) {
      setTimeout(() => {
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
          if (tooltip && tooltip.parentNode) {
            tooltip.style.display = 'none';
          }
        }, 500);
      }, 5000);
    }
  })();
});
