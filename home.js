// Home page enhancements
let currentSlide = 0;
let isAnimating = false;

function moveCarousel(direction) {
    if (isAnimating) return;
    
    const carousel = document.getElementById('offers-carousel');
    const track = carousel.querySelector('.offers-track');
    const cards = track.querySelectorAll('.offer-card');
    
    if (cards.length <= 1) return;
    
    isAnimating = true;
    
    // Calculate next slide index
    let nextSlide = currentSlide + direction;
    if (nextSlide < 0) nextSlide = cards.length - 1;
    if (nextSlide >= cards.length) nextSlide = 0;
    
    // Update transform
    track.style.transform = `translateX(-${nextSlide * 100}%)`;
    
    // Update current slide
    currentSlide = nextSlide;
    
    // Update button states
    updateNavButtons();
    
    // Reset animation lock after transition
    setTimeout(() => {
        isAnimating = false;
    }, 500);
}

function updateNavButtons() {
    const prevBtn = document.querySelector('.nav-btn.prev');
    const nextBtn = document.querySelector('.nav-btn.next');
    const carousel = document.getElementById('offers-carousel');
    const cards = carousel.querySelectorAll('.offer-card');
    
    if (cards.length <= 1) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }
    
    // Enable/disable buttons based on position
    prevBtn.disabled = false;
    nextBtn.disabled = false;
}

// Stats counter animation
function animateStats() {
    const stats = document.querySelectorAll('.stat-number');
    
    stats.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        const duration = 2000; // 2 seconds
        const increment = target / (duration / 16); // 60fps
        let current = 0;
        
        const counter = setInterval(() => {
            current += increment;
            stat.textContent = Math.floor(current);
            
            if (current >= target) {
                stat.textContent = target;
                clearInterval(counter);
            }
        }, 16);
    });
}

// Newsletter form submission
function handleNewsletterSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('newsletter-email').value;
    
    // Here you would typically send this to your backend
    console.log('Newsletter signup:', email);
    
    // Show success message
    const form = event.target;
    form.innerHTML = '<p class="success-message">Thank you for subscribing! 🎉</p>';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Start stats animation when section is in view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateStats();
                observer.unobserve(entry.target);
            }
        });
    });

    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        observer.observe(statsSection);
    }
});

// Auto-advance carousel
setInterval(() => {
    moveCarousel(1);
}, 5000);