/**
 * MotionOrchestrator Presentation - JavaScript Controller
 * Features: Slide navigation, Mermaid rendering, Speaker notes, Progress tracking
 */

(function() {
    'use strict';

    // ===== Password Protection =====
    const PASSWORD = 'doordash';
    const passwordOverlay = document.getElementById('password-overlay');
    const presentationContent = document.getElementById('presentation-content');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const passwordError = document.getElementById('password-error');

    function checkPassword() {
        const entered = passwordInput.value;
        if (entered === PASSWORD) {
            // Hide overlay, show presentation
            passwordOverlay.classList.add('hidden');
            presentationContent.style.display = 'block';
            // Initialize presentation
            initPresentation();
        } else {
            passwordError.textContent = 'Incorrect password. Please try again.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    // Password submit button click
    passwordSubmit.addEventListener('click', checkPassword);

    // Password input enter key
    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkPassword();
        }
    });

    // ===== State =====
    let currentSlide = 1;
    let totalSlides = 0;
    let speakerNotesVisible = false;

    // ===== DOM Elements =====
    const slidesContainer = document.querySelector('.slides-container');
    const slides = document.querySelectorAll('.slide');
    const progressFill = document.querySelector('.progress-fill');
    const currentSlideEl = document.querySelector('.current-slide');
    const totalSlidesEl = document.querySelector('.total-slides');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const speakerNotesPanel = document.querySelector('.speaker-notes-panel');
    const speakerNotesContent = document.querySelector('.speaker-notes-content');
    const closeNotesBtn = document.querySelector('.close-notes');

    // ===== Initialize Presentation (called after password verified) =====
    function initPresentation() {
        totalSlides = slides.length;
        totalSlidesEl.textContent = totalSlides;

        // Set up event listeners
        setupEventListeners();

        // Check for hash in URL
        const hash = window.location.hash;
        if (hash && hash.startsWith('#slide-')) {
            const slideNum = parseInt(hash.replace('#slide-', ''), 10);
            if (slideNum >= 1 && slideNum <= totalSlides) {
                goToSlide(slideNum);
            }
        } else {
            goToSlide(1);
        }

    }

    // ===== Event Listeners =====
    function setupEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', handleKeydown);

        // Button navigation
        prevBtn.addEventListener('click', prevSlide);
        nextBtn.addEventListener('click', nextSlide);

        // Close speaker notes
        closeNotesBtn.addEventListener('click', toggleSpeakerNotes);

        // Click navigation on slides
        slidesContainer.addEventListener('click', handleSlideClick);

        // Touch support
        let touchStartX = 0;
        let touchEndX = 0;

        slidesContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        slidesContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;

            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    nextSlide();
                } else {
                    prevSlide();
                }
            }
        }

        // Hash change
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash;
            if (hash && hash.startsWith('#slide-')) {
                const slideNum = parseInt(hash.replace('#slide-', ''), 10);
                if (slideNum >= 1 && slideNum <= totalSlides && slideNum !== currentSlide) {
                    goToSlide(slideNum);
                }
            }
        });
    }

    // ===== Keyboard Handler =====
    function handleKeydown(e) {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
            case ' ':
            case 'PageDown':
                e.preventDefault();
                nextSlide();
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'PageUp':
                e.preventDefault();
                prevSlide();
                break;
            case 'Home':
                e.preventDefault();
                goToSlide(1);
                break;
            case 'End':
                e.preventDefault();
                goToSlide(totalSlides);
                break;
            case 'n':
            case 'N':
                e.preventDefault();
                toggleSpeakerNotes();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'Escape':
                if (speakerNotesVisible) {
                    toggleSpeakerNotes();
                }
                break;
        }
    }

    // ===== Click Handler =====
    function handleSlideClick(e) {
        // Don't navigate if clicking on a link, button, or code block
        if (e.target.closest('a, button, pre, code, .mermaid, video')) {
            return;
        }

        const rect = slidesContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;

        // Click on left third goes back, right two-thirds goes forward
        if (clickX < width / 3) {
            prevSlide();
        } else {
            nextSlide();
        }
    }

    // ===== Navigation Functions =====
    function nextSlide() {
        if (currentSlide < totalSlides) {
            goToSlide(currentSlide + 1);
        }
    }

    function prevSlide() {
        if (currentSlide > 1) {
            goToSlide(currentSlide - 1);
        }
    }

    function goToSlide(slideNum) {
        if (slideNum < 1 || slideNum > totalSlides) {
            return;
        }

        // Update current slide
        slides.forEach((slide, index) => {
            slide.classList.remove('active');
            if (index + 1 === slideNum) {
                slide.classList.add('active');
            }
        });

        currentSlide = slideNum;

        // Update UI
        updateProgress();
        updateSlideCounter();
        updateSpeakerNotes();
        updateHash();
    }

    // ===== UI Updates =====
    function updateProgress() {
        const progress = (currentSlide / totalSlides) * 100;
        progressFill.style.width = `${progress}%`;
    }

    function updateSlideCounter() {
        currentSlideEl.textContent = currentSlide;
    }

    function updateHash() {
        history.replaceState(null, null, `#slide-${currentSlide}`);
    }

    function updateSpeakerNotes() {
        const activeSlide = document.querySelector('.slide.active');
        const notes = activeSlide.querySelector('.speaker-notes');

        if (notes) {
            speakerNotesContent.innerHTML = notes.innerHTML;
        } else {
            speakerNotesContent.innerHTML = '<p>No speaker notes for this slide.</p>';
        }
    }

    // ===== Speaker Notes Toggle =====
    function toggleSpeakerNotes() {
        speakerNotesVisible = !speakerNotesVisible;
        speakerNotesPanel.classList.toggle('hidden', !speakerNotesVisible);

        if (speakerNotesVisible) {
            updateSpeakerNotes();
        }
    }

    // ===== Fullscreen Toggle =====
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // ===== Start =====
    // Presentation init is now called after password verification via initPresentation()

})();
